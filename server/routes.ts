import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { z } from "zod";
import {
  insertInvestmentSchema,
  insertTransactionSchema,
  inviteCodes,
  ranks,
  userRankAchievements,
  insertRankSchema,
  insertUserRankAchievementSchema,
  type User,
  type Investment,
  type Transaction,
  type Rank,
  type UserRankAchievement,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";
import nodemailer from "nodemailer";
import { storage } from "./storage";

const scryptAsync = promisify(scrypt);

// Helper function to compare passwords
async function comparePasswords(
  supplied: string,
  stored: string,
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hashedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hashedBuf.toString("hex")}.${salt}`;
}

import { registerAdminRoutes } from "./admin-routes";
import { registerBSCRoutes } from "./bsc-routes";
import { notifications, users, transactions, investments, referrals } from "@shared/schema";
import { sql, sum, and } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes FIRST
  setupAuth(app);
  // Register admin routes
  registerAdminRoutes(app);
  // Register BSC blockchain routes
  registerBSCRoutes(app);

  // API routes - all prefixed with /api

  // Welcome code endpoint
  app.get("/api/welcome-code", async (req, res) => {
    try {
      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create welcome invite code
      const welcomeCode = await db.insert(inviteCodes).values({
        code,
        createdById: 1, // System user
      }).returning();
      
      res.json({ code: welcomeCode[0].code });
    } catch (error) {
      console.error("Error getting welcome code:", error);
      res.status(500).json({ error: "Failed to get welcome code" });
    }
  });

  // Get crypto prices using CoinGecko API (more reliable, no regional restrictions)
  app.get("/api/crypto/prices", async (req, res) => {
    // Fallback data with realistic prices
    const getFallbackPrices = () => [
      { symbol: "BTC", name: "Bitcoin", price: 95420.50, change24h: 2.34, exchange: "COINGECKO" },
      { symbol: "ETH", name: "Ethereum", price: 3285.75, change24h: 1.87, exchange: "COINGECKO" },
      { symbol: "BNB", name: "BNB", price: 635.20, change24h: -0.45, exchange: "COINGECKO" },
      { symbol: "XRP", name: "XRP", price: 2.15, change24h: 3.21, exchange: "COINGECKO" },
      { symbol: "ADA", name: "Cardano", price: 0.98, change24h: 1.15, exchange: "COINGECKO" },
      { symbol: "SOL", name: "Solana", price: 185.40, change24h: 4.52, exchange: "COINGECKO" },
      { symbol: "DOGE", name: "Dogecoin", price: 0.32, change24h: -1.23, exchange: "COINGECKO" },
      { symbol: "AVAX", name: "Avalanche", price: 38.75, change24h: 2.08, exchange: "COINGECKO" },
    ];

    try {
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const coinGeckoRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,ripple,cardano,solana,dogecoin,avalanche-2&vs_currencies=usd&include_24hr_change=true",
        { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      clearTimeout(timeout);

      if (!coinGeckoRes.ok) {
        console.warn(`CoinGecko API returned status ${coinGeckoRes.status}, using fallback data`);
        return res.json(getFallbackPrices());
      }

      const coinGeckoData = await coinGeckoRes.json();

      const formatPrice = (price: number) => Number(price.toFixed(2));
      const prices = [];

      // Map CoinGecko IDs to symbols
      const cryptoMapping: { [key: string]: { symbol: string; name: string } } = {
        bitcoin: { symbol: "BTC", name: "Bitcoin" },
        ethereum: { symbol: "ETH", name: "Ethereum" },
        binancecoin: { symbol: "BNB", name: "BNB" },
        ripple: { symbol: "XRP", name: "XRP" },
        cardano: { symbol: "ADA", name: "Cardano" },
        solana: { symbol: "SOL", name: "Solana" },
        dogecoin: { symbol: "DOGE", name: "Dogecoin" },
        "avalanche-2": { symbol: "AVAX", name: "Avalanche" },
      };

      // Process CoinGecko data
      Object.entries(coinGeckoData).forEach(([id, data]: [string, any]) => {
        const crypto = cryptoMapping[id];
        if (crypto && data.usd) {
          prices.push({
            symbol: crypto.symbol,
            name: crypto.name,
            price: formatPrice(data.usd),
            change24h: data.usd_24h_change ? parseFloat(data.usd_24h_change.toFixed(2)) : 0,
            exchange: "COINGECKO",
          });
        }
      });

      // If we got valid data, return it
      if (prices.length > 0) {
        console.log(`Successfully fetched ${prices.length} crypto prices from CoinGecko`);
        res.json(prices);
      } else {
        console.warn("CoinGecko returned empty data, using fallback");
        res.json(getFallbackPrices());
      }
    } catch (error: any) {
      console.error("Error fetching crypto prices from CoinGecko:", error.message);
      console.log("Using fallback crypto prices");
      
      // Return fallback data with COINGECKO exchange so it displays
      res.json(getFallbackPrices());
    }
  });

  // Get investment plans
  app.get("/api/investment/plans", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      const userDepositAmount = user ? parseFloat(user.rechargeAmount.toString()) : 0;

      // Single investment plan with 3% daily returns
      const plans = [
        {
          id: "basic-trading",
          name: "Hana AI Trading",
          minAmount: 10,
          maxAmount: 100000,
          dailyRate: 3.0,
          description: "Earn 3% daily on your deposits",
        },
      ];

      res.json(plans);
    } catch (err) {
      console.error("Error fetching investment plans:", err);
      res.status(500).json({ error: "Failed to fetch investment plans" });
    }
  });

  // Create new investment - protected route
  app.post("/api/investment", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      console.log("Investment data received:", req.body);

      // Trading is now available 7 days a week (Monday to Sunday)

      // Validate request data
      const { amount, plan, dailyRate } = req.body;
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      const userBalance = parseFloat(user.totalAssets.toString());

      if (typeof amount !== "number" || amount < 10) {
        return res
          .status(400)
          .json({ error: "Investment amount must be at least $10" });
      }

      if (typeof plan !== "string" || !plan) {
        return res.status(400).json({ error: "Investment plan is required" });
      }

      if (typeof dailyRate !== "number" || dailyRate <= 0) {
        return res
          .status(400)
          .json({ error: "Daily rate must be a positive number" });
      }

      // Validate single plan (3% daily rate)
      if (plan !== "basic-trading") {
        return res.status(400).json({ error: "Invalid investment plan selected" });
      }

      if (dailyRate !== 3.0) {
        return res.status(400).json({
          error: `Invalid daily rate. Expected 3%`
        });
      }

      // Validate investment amount against user's deposit amount
      const userDepositAmount = parseFloat(user.rechargeAmount.toString());
      if (amount > userDepositAmount) {
        return res.status(400).json({
          error: "Investment amount cannot exceed your deposit amount",
        });
      }

      // Verify the user has enough funds

      if (!user) return res.status(404).send("User not found");

      if (userDepositAmount < amount) {
        return res.status(400).json({ error: "Insufficient deposit amount for this investment" });
      }

      // Check if user has made an investment in the last 24 hours
      if (user.lastInvestmentDate) {
        const lastInvestment = new Date(user.lastInvestmentDate);
        const currentTime = new Date();
        const timeDifference = currentTime.getTime() - lastInvestment.getTime();
        const hoursDifference = timeDifference / (1000 * 60 * 60);

        if (hoursDifference < 24) {
          const timeRemaining = Math.ceil(24 - hoursDifference);
          return res.status(400).json({
            error: `You can only create one investment every 24 hours. Please try again in ${timeRemaining} hour${timeRemaining === 1 ? "" : "s"}.`,
          });
        }
      }

      // Create the investment with correct data structure
      const investmentToCreate = {
        amount: amount,
        plan: plan,
        dailyRate: dailyRate,
        userId: req.user!.id,
        status: "Active",
      };

      const investment = await storage.createInvestment(investmentToCreate);

      // Calculate immediate profit based on selected plan's daily rate
      const instantProfitPercentage = dailyRate / 100; // Convert percentage to decimal
      const instantProfit = amount * instantProfitPercentage;
      
      // Only update profit-related fields, not total assets
      const currentProfitAssets = parseFloat(user.profitAssets.toString());
      await storage.updateUser(req.user!.id, {
        profitAssets: (
          currentProfitAssets + instantProfit
        ).toString(),
        todayEarnings: (
          parseFloat(user.todayEarnings.toString()) + instantProfit
        ).toString(),
        withdrawableAmount: (
          parseFloat(user.withdrawableAmount.toString()) + instantProfit
        ).toString(),
        lastInvestmentDate: new Date(),
      });

      // Create profit transaction record for the instant profit
      const profitTransaction = {
        userId: user.id,
        type: "Profit" as const,
        amount: instantProfit.toString(),
        status: "Completed" as const,
        txHash: null,
      };

      await storage.createTransaction(profitTransaction);

      // Commission is now only given on first deposit

      // Return investment with the profit info
      res.status(201).json({
        ...investment,
        instantProfit: instantProfit,
      });
    } catch (err) {
      console.error("Investment creation error:", err);
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Get user investments - protected route
  app.get("/api/investment", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    const investments = await storage.getInvestmentsByUserId(req.user!.id);
    res.json(investments);
  });

  // Get user referrals - protected route
  app.get("/api/referrals", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    const referrals = await storage.getReferralsByReferrerId(req.user!.id);
    res.json(referrals);
  });

  // Get user referrals by tier - protected route
  app.get("/api/referrals/tier/:tier", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const tier = req.params.tier;
      const userId = req.user!.id;

      // Get referrals for specific tier
      const tierReferrals = await db
        .select({
          id: referrals.id,
          referredId: referrals.referredId,
          level: referrals.level,
          commission: referrals.commission,
          createdAt: referrals.createdAt,
          username: users.username,
          email: users.email,
          totalAssets: users.totalAssets,
          rechargeAmount: users.rechargeAmount,
          commissionAssets: users.commissionAssets,
        })
        .from(referrals)
        .innerJoin(users, eq(users.id, referrals.referredId))
        .where(and(eq(referrals.referrerId, userId), eq(referrals.level, tier)))
        .orderBy(desc(referrals.createdAt));

      // Get deposit amounts for each referred user
      const referralDetails = [];
      for (const referral of tierReferrals) {
        const userTransactions = await db
          .select({ amount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, referral.referredId),
              eq(transactions.type, "Deposit"),
              eq(transactions.status, "Completed")
            )
          );

        const totalDeposits = userTransactions[0]?.amount || 0;

        referralDetails.push({
          ...referral,
          totalDeposits: totalDeposits,
          displayName: referral.username || referral.email || `User${referral.referredId}`,
        });
      }

      res.json(referralDetails);
    } catch (error) {
      console.error("Error fetching tier referrals:", error);
      res.status(500).json({ error: "Failed to fetch tier referrals" });
    }
  });

  // Get referral summary by tiers - protected route
  app.get("/api/referrals/summary", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const userId = req.user!.id;

      // Get counts for each tier
      const tierCounts = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(referrals).where(and(eq(referrals.referrerId, userId), eq(referrals.level, "1"))),
        db.select({ count: sql<number>`COUNT(*)` }).from(referrals).where(and(eq(referrals.referrerId, userId), eq(referrals.level, "2"))),
        db.select({ count: sql<number>`COUNT(*)` }).from(referrals).where(and(eq(referrals.referrerId, userId), eq(referrals.level, "3"))),
        db.select({ count: sql<number>`COUNT(*)` }).from(referrals).where(and(eq(referrals.referrerId, userId), eq(referrals.level, "4"))),
      ]);

      const summary = {
        tier1: tierCounts[0][0]?.count || 0,
        tier2: tierCounts[1][0]?.count || 0,
        tier3: tierCounts[2][0]?.count || 0,
        tier4: tierCounts[3][0]?.count || 0,
        total: (tierCounts[0][0]?.count || 0) + (tierCounts[1][0]?.count || 0) + (tierCounts[2][0]?.count || 0) + (tierCounts[3][0]?.count || 0)
      };

      res.json(summary);
    } catch (error) {
      console.error("Error fetching referral summary:", error);
      res.status(500).json({ error: "Failed to fetch referral summary" });
    }
  });

  // Create transaction (deposit/withdrawal) - protected route
  app.post("/api/transaction", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const transactionData = insertTransactionSchema.parse(req.body);

      // Handle different transaction types
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      if (transactionData.type === "Withdrawal") {
        // Check sufficient funds for withdrawal
        if (
          parseFloat(user.totalAssets.toString()) <
          parseFloat(transactionData.amount.toString())
        ) {
          return res.status(400).send("Insufficient funds for withdrawal");
        }

        // Update user assets for withdrawal - only deduct from withdrawable amount
        await storage.updateUser(req.user!.id, {
          withdrawableAmount: (
            parseFloat(user.withdrawableAmount.toString()) -
            parseFloat(transactionData.amount.toString())
          ).toString(),
        });
      } else if (transactionData.type === "Deposit") {
        const newTotalAssets = (
          parseFloat(user.totalAssets.toString()) +
          parseFloat(transactionData.amount.toString())
        ).toString();

        // Update deposit amount only - no quantitative assets
        await storage.updateUser(req.user!.id, {
          rechargeAmount: (
            parseFloat(user.rechargeAmount.toString()) +
            parseFloat(transactionData.amount.toString())
          ).toString(),
        });
      }

      // Create the transaction record with correct data structure
      const transactionToCreate = {
        amount: transactionData.amount,
        type: transactionData.type,
        status: transactionData.status,
        txHash: transactionData.txHash ?? null,
        userId: req.user!.id,
        network: transactionData.network,
        address: transactionData.address,
      };
      const transaction = await storage.createTransaction(transactionToCreate);

      res.status(201).json(transaction);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Get user transactions - protected route
  app.get("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    // Get query parameters for filtering
    const { type, status, startDate, endDate } = req.query;

    // Build filter object
    const filter: any = { userId: req.user!.id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate) filter.createdAt = { gte: new Date(startDate as string) };
    if (endDate)
      filter.createdAt = {
        ...filter.createdAt,
        lte: new Date(endDate as string),
      };

    const transactions = await storage.getTransactionsByUserId(
      req.user!.id,
      filter,
    );

    // Calculate totals
    const totals = transactions.reduce(
      (acc, tx) => {
        const amount = parseFloat(tx.amount.toString());
        if (tx.status === "Completed") {
          if (tx.type === "Deposit") acc.totalDeposits += amount;
          else if (tx.type === "Withdrawal") acc.totalWithdrawals += amount;
          else if (tx.type === "Profit") acc.totalProfits += amount;
        }
        return acc;
      },
      { totalDeposits: 0, totalWithdrawals: 0, totalProfits: 0 },
    );

    res.json({ transactions, totals });
  });

  // Check for pending withdrawal transactions - protected route
  app.get("/api/withdrawal/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const userTransactions = await storage.getTransactionsByUserId(req.user!.id);
      
      // Find pending withdrawal transactions (including related fees)
      const pendingWithdrawals = userTransactions.filter(tx => 
        tx.status === "Pending" && 
        (tx.type === "Withdrawal" || tx.type === "Withdrawal Fee" || tx.type === "Gas Fee")
      );

      // Group by main withdrawal transaction
      const mainPendingWithdrawal = pendingWithdrawals.find(tx => tx.type === "Withdrawal");
      
      if (mainPendingWithdrawal) {
        // Find related fee transactions created around the same time
        const relatedFees = pendingWithdrawals.filter(tx => 
          tx.type !== "Withdrawal" && 
          Math.abs(new Date(tx.createdAt).getTime() - new Date(mainPendingWithdrawal.createdAt).getTime()) < 60000 // Within 1 minute
        );

        res.json({
          hasPendingWithdrawal: true,
          pendingWithdrawal: {
            id: mainPendingWithdrawal.id,
            amount: mainPendingWithdrawal.amount,
            address: mainPendingWithdrawal.address,
            createdAt: mainPendingWithdrawal.createdAt,
            status: mainPendingWithdrawal.status,
            relatedFees: relatedFees.map(fee => ({
              type: fee.type,
              amount: fee.amount
            }))
          }
        });
      } else {
        res.json({
          hasPendingWithdrawal: false,
          pendingWithdrawal: null
        });
      }
    } catch (error) {
      console.error("Error checking withdrawal status:", error);
      res.status(500).json({ error: "Failed to check withdrawal status" });
    }
  });

  // Verify and store invite code
  app.post("/api/invite-code/verify", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Invite code is required" });
      }

      // Check if code already exists
      const existingCode = await storage.getInviteCode(code);
      if (!existingCode) {
        // Generate a new code if none exists
        const newCode = await storage.createInviteCode({
          code: code,
          createdById: 1,
        });
        if (!newCode) {
          throw new Error("Failed to create invite code");
        }
      }
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error verifying invite code:", err);
      res.status(500).json({ error: "Failed to verify invite code" });
    }
  });

  // Generate invite code - protected route
  app.post("/api/invite-code", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      // Generate a random 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create new invite code and update user's codes
      const [inviteCode] = await Promise.all([
        db.insert(inviteCodes).values({
          code,
          createdById: req.user!.id,
        }).returning(),
        db.update(users).set({
          inviteCode: code,
          referralCode: code,
          updatedAt: new Date(),
        }).where(eq(users.id, req.user!.id)),
      ]);

      // Return the updated data
      res.json({
        ...inviteCode[0],
        inviteCode: code,
        referralCode: code,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Get my invite codes - protected route
  app.get("/api/invite-codes", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      // Query invite codes by createdById
      const codes = await db
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.createdById, req.user!.id));

      res.json(codes);
    } catch (err) {
      console.error("Error fetching invite codes:", err);
      res.status(500).json({ error: "Failed to fetch invite codes" });
    }
  });

  // Reset password route
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      // Find user by reset token and check if it's still valid
      const userResult = await db.select().from(users).where(eq(users.resetToken, token));
      const user = userResult[0];

      if (
        !user ||
        !user.resetTokenExpiry ||
        new Date() > new Date(user.resetTokenExpiry)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset token" });
      }

      // Hash the new password
      const salt = randomBytes(16).toString("hex");
      const hashedPassword = (await scryptAsync(password, salt, 64)) as Buffer;
      const newHashedPassword = `${hashedPassword.toString("hex")}.${salt}`;

      // Update user's password and clear reset token
      await db.update(users).set({
        password: newHashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));

      res.json({ message: "Password reset successful" });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Forgot password route
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      // Find user by email
      const userResult = await db.select().from(users).where(eq(users.email, email));
      const user = userResult[0];

      if (user) {
        // Generate reset token
        const resetToken = randomBytes(32).toString("hex");
        const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

        // Store reset token and expiry in the database
        await db.update(users).set({
          resetToken: resetToken,
          resetTokenExpiry: resetExpiry,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        // Create nodemailer transporter with SMTP
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: Boolean(true), // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        // Send reset email
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: email,
          subject: "Password Reset Request",
          html: `
            <h1>Password Reset</h1>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <a href="${process.env.APP_URL}/reset-password?token=${resetToken}">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request this reset, please ignore this email.</p>
          `,
        });
      }

      // Always return success to prevent email enumeration
      res.json({
        message:
          "If an account exists with this email, you will receive reset instructions",
      });
    } catch (err) {
      console.error("Password reset error:", err);
      res.status(500).json({ error: "Failed to process password reset" });
    }
  });

  // Get user account information - protected route
  app.get("/api/account", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const userResult = await db.select().from(users).where(eq(users.id, req.user!.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");

      // Get investments, transactions, and referrals
      const investmentResults = await db.select().from(investments).where(eq(investments.userId, user.id));
      const transactionResults = await db.select().from(transactions).where(eq(transactions.userId, user.id));
      const referralResults = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt));

      // Calculate total earnings and other statistics
      const totalInvested = investmentResults.reduce(
        (sum, inv) => sum + parseFloat(inv.amount.toString()),
        0,
      );
      const currentBalance = parseFloat(user.totalAssets.toString());
      const totalProfit = parseFloat(user.profitAssets.toString());

      // Calculate proper asset values according to new formula
      const depositAmount = parseFloat(user.rechargeAmount.toString());
      const profitAssets = parseFloat(user.profitAssets.toString());
      const withdrawableAmount = parseFloat(user.withdrawableAmount.toString());
      const calculatedTotalAssets = depositAmount + profitAssets;

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          telegram: user.telegram,
          referralCode: user.referralCode,
          totalAssets: calculatedTotalAssets.toString(),
          rechargeAmount: user.rechargeAmount, // Deposit Amount
          profitAssets: user.profitAssets, // Total profits generated
          withdrawableAmount: user.withdrawableAmount, // Referral bonuses + ranking bonus + daily profits
          todayEarnings: user.todayEarnings,
          yesterdayEarnings: user.yesterdayEarnings,
          lastInvestmentDate: user.lastInvestmentDate,
          createdAt: user.createdAt,
          notifications: userNotifications,
        },
        stats: {
          totalInvested,
          currentBalance: calculatedTotalAssets,
          totalProfit,
          activeInvestments: investmentResults.filter(
            (inv) => inv.status === "Active",
          ).length,
          referralsCount: referralResults.length,
        },
      });
    } catch (err) {
      console.error("Error fetching account info:", err);
      res.status(500).json({ error: "Failed to fetch account information" });
    }
  });

  // Update account information - protected route
  app.patch("/api/account", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { email, phone, telegram } = req.body;
      const userData: Partial<User> = {};

      if (email) userData.email = email;
      if (phone) userData.phone = phone;
      if (telegram) userData.telegram = telegram;

      await db.update(users).set(userData).where(eq(users.id, req.user!.id));
      const updatedUserResult = await db.select().from(users).where(eq(users.id, req.user!.id));
      const updatedUser = updatedUserResult[0];
      if (!updatedUser) return res.status(404).send("User not found");

      // Return user without sensitive data
      const { password, securityPassword, ...userWithoutPasswords } =
        updatedUser;
      res.json(userWithoutPasswords);
    } catch (err) {
      console.error("Error updating account:", err);
      res.status(500).json({ error: "Failed to update account information" });
    }
  });

  // Get upline information - protected route
  app.get("/api/upline", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const userResult = await db.select().from(users).where(eq(users.id, req.user!.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");

      // Check if user has an upline (referrer)
      if (!user.referrerId) {
        return res.json({ upline: null });
      }

      // Get upline user information
      const uplineResult = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, user.referrerId));

      const upline = uplineResult[0];
      if (!upline) {
        return res.json({ upline: null });
      }

      res.json({
        upline: {
          id: upline.id,
          username: upline.username,
          email: upline.email,
          createdAt: upline.createdAt,
        },
      });
    } catch (err) {
      console.error("Error fetching upline info:", err);
      res.status(500).json({ error: "Failed to fetch upline information" });
    }
  });

  // Get dashboard statistics - protected route
  app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const userResult = await db.select().from(users).where(eq(users.id, req.user!.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");

      const investmentResults = await db.select().from(investments).where(eq(investments.userId, user.id));
      const activeInvestments = investmentResults.filter(
        (inv) => inv.status === "Active",
      );
      const referralResults = await db.select().from(referrals).where(eq(referrals.referrerId, user.id));

      res.json({
        totalAssets: user.totalAssets,
        rechargeAmount: user.rechargeAmount, // Deposit amount only
        profitAssets: user.profitAssets,
        todayEarnings: user.todayEarnings,
        yesterdayEarnings: user.yesterdayEarnings,
        commissionToday: user.commissionToday,
        activeInvestmentsCount: activeInvestments.length,
        referralsCount: referralResults.length,
      });
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Salary scheduler removed - all bonuses are now immediately available for withdrawal

  // Delete unfunded accounts after 24 hours - automated cleanup
  app.post("/api/cleanup-unfunded-accounts", async (req, res) => {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Get all users
      const allUsers = await storage.getAllUsers();
      let deletedCount = 0;
      
      for (const user of allUsers) {
        // Skip admin accounts
        if (user.isAdmin) continue;
        
        // Check if account was created more than 24 hours ago
        const createdAt = new Date(user.createdAt);
        if (createdAt > twentyFourHoursAgo) continue;
        
        // Check if user has any deposits
        const userTransactions = await db.select().from(transactions).where(eq(transactions.userId, user.id));
        const hasDeposits = userTransactions.some(
          (tx) => tx.type === "Deposit" && tx.status === "Completed"
        );
        
        // Delete user if no deposits after 24 hours
        if (!hasDeposits) {
          // Delete user's transactions first
          await db.delete(transactions).where(eq(transactions.userId, user.id));
          // Delete user's investments
          await db.delete(investments).where(eq(investments.userId, user.id));
          // Delete user's notifications
          await db.delete(notifications).where(eq(notifications.userId, user.id));
          // Delete user
          await db.delete(users).where(eq(users.id, user.id));
          deletedCount++;
          console.log(`Deleted unfunded account: ${user.username} (ID: ${user.id})`);
        }
      }
      
      res.json({
        success: true,
        message: `Deleted ${deletedCount} unfunded accounts`,
        deletedCount,
      });
    } catch (err) {
      console.error("Error cleaning up unfunded accounts:", err);
      res.status(500).json({ error: "Failed to cleanup unfunded accounts" });
    }
  });

  // Simulate daily earnings - protected route
  app.post("/api/simulate-earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      // Trading is now available 7 days a week (Monday to Sunday)
      
      const allUsers = await storage.getAllUsers();
      
      for (const user of allUsers) {
        const investments = await storage.getInvestmentsByUserId(user.id);
        const activeInvestments = investments.filter(
          (inv) => inv.status === "Active",
        );

        let totalEarnings = 0;

        // Calculate earnings for each active investment
        for (const investment of activeInvestments) {
          const dailyRate = parseFloat(investment.dailyRate.toString()) / 100;
          const amount = parseFloat(investment.amount.toString());
          const dailyEarning = amount * dailyRate;
          totalEarnings += dailyEarning;
        }

        // Update user's earnings
        await storage.updateUser(user.id, {
          yesterdayEarnings: user.todayEarnings.toString(),
          todayEarnings: totalEarnings.toString(),
          profitAssets: (
            parseFloat(user.profitAssets.toString()) + totalEarnings
          ).toString(),
          withdrawableAmount: (
            parseFloat(user.withdrawableAmount.toString()) + totalEarnings
          ).toString(),
        });

        // Create profit transaction record
        if (totalEarnings > 0) {
          const profitTransaction: Omit<Transaction, "id" | "createdAt"> = {
            userId: user.id,
            type: "Profit",
            amount: totalEarnings.toString(),
            status: "Completed",
            txHash: null,
            address: null,
            reason: "Daily trading profit",
            network: null,
            fee: null,
            processingTime: null,
            completionTime: null,
          };
          await storage.createTransaction(profitTransaction);
        }
      }

      res.json({
        success: true,
        message: "Daily earnings calculated for all users",
      });
    } catch (err) {
      console.error("Error simulating earnings:", err);
      res.status(500).json({ error: "Failed to simulate earnings" });
    }
  });

  // Apply for Country Representative
  app.post("/api/apply-country-rep", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      // Check if user already applied or is already a Country Rep
      if (user.countryRepStatus === "pending") {
        return res.status(400).json({
          message: "You have already applied for Country Representative status",
        });
      }

      if (user.isCountryRep) {
        return res.status(400).json({
          message: "You are already a Country Representative",
        });
      }

      // Check team volume requirement ($1M)
      const totalTeamVolume = parseFloat(user.totalVolumeGenerated.toString());
      
      if (totalTeamVolume < 1000000) {
        return res.status(400).json({
          message: `You need to reach $1,000,000 in Team Volume to apply for Country Representative. Current volume: $${totalTeamVolume.toLocaleString()}`,
          currentVolume: totalTeamVolume,
          requiredVolume: 1000000,
        });
      }

      await storage.updateUser(user.id, {
        countryRepStatus: "pending",
      });

      res.json({ 
        message: "Country Representative application submitted successfully! Your application is under review.",
        teamVolume: totalTeamVolume,
      });
    } catch (err) {
      console.error("Error applying for Country Rep:", err);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Delete notification endpoint
  app.delete("/api/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const notificationId = parseInt(req.params.id);
      await db
        .delete(notifications)
        .where(eq(notifications.id, notificationId));
      res.status(200).json({ message: "Notification deleted successfully" });
    } catch (err) {
      console.error("Error deleting notification:", err);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Get user profile - protected route
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      // Get referrals with referred user details
      const referrals = await storage.getReferralsByReferrerId(user.id);
      const referralDetails = [];

      for (const referral of referrals) {
        const referredUser = await storage.getUser(referral.referredId);
        if (referredUser) {
          // Get user's total deposits
          const userTransactions = await storage.getTransactionsByUserId(
            referredUser.id,
          );
          const totalDeposits = userTransactions
            .filter((tx) => tx.type === "Deposit" && tx.status === "Completed")
            .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

          referralDetails.push({
            id: referral.id,
            level: referral.level,
            commission: referral.commission,
            totalDeposits: totalDeposits,
            referredUser: {
              id: referredUser.id,
              username: referredUser.username,
              createdAt: referredUser.createdAt,
            },
          });
        }
      }

      // Return user profile data
      const { password, securityPassword, ...userWithoutPasswords } = user;
      res.json({
        profile: userWithoutPasswords,
        referrals: referralDetails,
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      res.status(500).json({ error: "Failed to fetch profile information" });
    }
  });


  // Update user's referral code
  app.put("/api/user/referral-code", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { referralCode } = req.body;
      const updatedUser = await storage.updateUser(req.user.id, {
        referralCode,
        updatedAt: new Date(),
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error updating referral code:", err);
      res.status(500).json({ message: "Failed to update referral code" });
    }
  });

  // Change password - protected route
  app.post("/api/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      });

      const { currentPassword, newPassword } = schema.parse(req.body);

      // Get user from database
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      // Verify current password
      const isCurrentPasswordValid = await comparePasswords(
        currentPassword,
        user.password,
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password in database
      await storage.updateUser(req.user!.id, {
        password: hashedNewPassword,
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create transaction (deposit/withdrawal) - protected route
  app.post("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const schema = z.object({
        type: z.enum(["Deposit", "Withdrawal"]),
        amount: z.number().min(0.01),
        status: z.enum(["Pending", "Completed", "Failed"]),
        network: z.string().optional(),
        address: z.string().optional(),
        fee: z.number().optional(),
        txHash: z.string().optional(),
      });

      const transactionData = schema.parse(req.body);

      // Handle different transaction types
      const userResult = await db.select().from(users).where(eq(users.id, req.user!.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");

      const existingTransactions = await db.select().from(transactions).where(eq(transactions.userId, req.user!.id));
      const completedDeposits = existingTransactions.filter(
        (t) => t.type === "Deposit" && t.status === "Completed",
      );

      if (transactionData.type === "Deposit") {
        // Check for minimum deposit
        if (transactionData.amount < 10) {
          return res.status(400).json({
            message: "Minimum deposit amount is $10",
          });
        }
        
        // Check for maximum deposit
        if (transactionData.amount > 10) {
          return res.status(400).json({
            message: "Maximum deposit amount is $10",
          });
        }
        
        // Calculate deposit fee (fixed $2 admin fee)
        const depositAmount = transactionData.amount;
        const platformFee = 2; // Fixed $2 fee
        const netDepositAmount = depositAmount - platformFee; // Amount after fee deduction
        
        // Update user's rechargeAmount (deposit amount) with net amount
        const currentRechargeAmount = parseFloat(user.rechargeAmount.toString());
        const newRechargeAmount = (currentRechargeAmount + netDepositAmount).toString();
        
        // Update user's total assets with net deposit amount
        const currentTotalAssets = parseFloat(user.totalAssets.toString());
        const newTotalAssets = (currentTotalAssets + netDepositAmount).toString();
        
        await db.update(users).set({
          totalAssets: newTotalAssets,
          rechargeAmount: newRechargeAmount,
        }).where(eq(users.id, req.user!.id));
      } else if (transactionData.type === "Withdrawal") {
        // Withdrawals are available every day

        // Check for minimum withdrawal
        if (transactionData.amount < 2) {
          return res.status(400).json({
            message: "Minimum withdrawal amount is $2",
          });
        }

        // Calculate fixed $1 withdrawal fee
        const withdrawalFee = 1; // Fixed $1 fee
        const totalAmount = transactionData.amount + withdrawalFee;

        // Check sufficient funds for withdrawal (including $1 fee)
        if (parseFloat(user.totalAssets.toString()) < totalAmount) {
          return res
            .status(400)
            .json({ message: "Insufficient funds for withdrawal (including $1 fee)" });
        }

        // For withdrawals, we only check the balance but don't deduct it yet
        // The balance will be deducted when the withdrawal is approved by admin
      }

      // Create the transaction record with correct data structure
      const transactionToCreate = {
        amount: transactionData.amount.toString(),
        type: transactionData.type,
        status: "Pending",
        network: transactionData.network,
        address: transactionData.address,
        fee: transactionData.type === "Withdrawal" ? "1" : "0",
        processingTime: null,
        completionTime: null,
        reason: null,
        txHash: transactionData.txHash || null,
        userId: req.user!.id,
      };

      // Deposit balance update is handled above in the validation section

      const transactionResult = await db.insert(transactions).values(transactionToCreate).returning();
      const transaction = transactionResult[0];

      // Create transaction history entry
      await db.insert(transactionHistory).values({
        transactionId: transaction.id,
        status: "Pending",
        timestamp: new Date(),
        details: `${transactionData.type} transaction created`,
      });

      const response: any = {
        success: true,
        transaction,
      };

      // Add bonus info if applicable
      if (
        transactionData.type === "Deposit" &&
        completedDeposits.length === 0
      ) {
        response.welcomeBonus = {
          amount: (transactionData.amount * 0.1).toFixed(2),
          percentage: "10%",
        };
      }

      res.status(201).json(response);
    } catch (err) {
      console.error("Error creating transaction:", err);
      res.status(400).json({ message: (err as Error).message });
    }
  });

  // This endpoint has been moved to the top of the file

  // Mark notification as read
  app.post("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const notificationId = req.params.id;
      const userId = req.user!.id;

      // Update the notification's read status
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Initialize rank system with predefined ranks
  app.post("/api/admin/initialize-ranks", async (req, res) => {
    // Temporarily removed auth check for initialization

    try {
      const predefinedRanks = [
        { name: "Manager", requiredVolume: "3000", incentiveAmount: "150", incentiveDescription: "$150 bonus", order: 1 },
        { name: "Leader", requiredVolume: "7000", incentiveAmount: "250", incentiveDescription: "$250 bonus", order: 2 },
        { name: "Ambassador", requiredVolume: "15000", incentiveAmount: "1000", incentiveDescription: "$1,000 bonus", order: 3 },
        { name: "Director", requiredVolume: "20000", incentiveAmount: "3000", incentiveDescription: "$3,000 + Apple watch", order: 4 },
        { name: "Executive", requiredVolume: "50000", incentiveAmount: "5000", incentiveDescription: "$5,000 + Laptop", order: 5 },
        { name: "Vice Chairman", requiredVolume: "100000", incentiveAmount: "10000", incentiveDescription: "$10,000 Bonus + A car reward", order: 6 },
        { name: "Chairman", requiredVolume: "500000", incentiveAmount: "20000", incentiveDescription: "$20,000 Bonus + A trip to UK", order: 7 },
        { name: "President", requiredVolume: "1000000", incentiveAmount: "30000", incentiveDescription: "$30,000 bonus + A House", order: 8 },
      ];

      // Insert ranks if they don't exist
      for (const rank of predefinedRanks) {
        const existing = await db.select().from(ranks).where(eq(ranks.name, rank.name));
        if (existing.length === 0) {
          await db.insert(ranks).values(rank);
        }
      }

      res.json({ success: true, message: "Ranks initialized successfully" });
    } catch (error) {
      console.error("Error initializing ranks:", error);
      res.status(500).json({ error: "Failed to initialize ranks" });
    }
  });

  // Get all ranks
  app.get("/api/ranks", async (req, res) => {
    try {
      const allRanks = await db.select().from(ranks).orderBy(ranks.order);
      res.json(allRanks);
    } catch (error) {
      console.error("Error fetching ranks:", error);
      res.status(500).json({ error: "Failed to fetch ranks" });
    }
  });

  // Calculate and update user volume and rank
  async function calculateUserVolume(userId: number): Promise<{ totalVolume: number, directVolume: number, indirectVolume: number }> {
    // Get all referrals for this user
    const referrals = await storage.getReferralsByReferrerId(userId);
    
    // Calculate direct volume (Level 1 referrals)
    const directReferralIds = referrals
      .filter(ref => ref.level === "1")
      .map(ref => ref.referredId);
    
    let directVolume = 0;
    for (const referralId of directReferralIds) {
      const referralUser = await storage.getUser(referralId);
      if (referralUser) {
        directVolume += parseFloat(referralUser.rechargeAmount.toString());
      }
    }
    
    // Calculate indirect volume (Level 2, 3, and 4 referrals)
    const indirectReferralIds = referrals
      .filter(ref => ["2", "3", "4"].includes(ref.level))
      .map(ref => ref.referredId);
    
    let indirectVolume = 0;
    for (const referralId of indirectReferralIds) {
      const referralUser = await storage.getUser(referralId);
      if (referralUser) {
        indirectVolume += parseFloat(referralUser.rechargeAmount.toString());
      }
    }
    
    // Total volume = Direct volume + Indirect volume
    const totalVolume = directVolume + indirectVolume;
    
    return { totalVolume, directVolume, indirectVolume };
  }

  async function getDownlineInvestments(userId: number): Promise<number> {
    // Get all referrals across all tiers for this user
    const allReferrals = await db
      .select({
        referredId: referrals.referredId,
        level: referrals.level
      })
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    let totalDownlineInvestment = 0;

    for (const referral of allReferrals) {
      // Get referral's total deposits
      const referralInvestments = await db
        .select({ amount: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, referral.referredId), 
            eq(transactions.type, "Deposit"),
            eq(transactions.status, "Completed")
          )
        );

      const referralAmount = parseFloat(referralInvestments[0]?.amount?.toString() || "0");
      totalDownlineInvestment += referralAmount;
    }

    return totalDownlineInvestment;
  }

  // Check and update user rank
  app.get("/api/check-rank/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const userId = parseInt(req.params.userId);
      const volumeData = await calculateUserVolume(userId);

      // Update user's total volume
      await db
        .update(users)
        .set({ totalVolumeGenerated: Number(volumeData.totalVolume).toFixed(2) })
        .where(eq(users.id, userId));

      // Get all ranks ordered by required volume (descending)
      const allRanks = await db.select().from(ranks).orderBy(desc(sql`CAST(${ranks.requiredVolume} AS DECIMAL)`));

      // Find the highest rank the user qualifies for
      let newRank = "none";
      let qualifiedRank: Rank | null = null;

      for (const rank of allRanks) {
        if (volumeData.totalVolume >= parseFloat(rank.requiredVolume)) {
          newRank = rank.name;
          qualifiedRank = rank;
          break;
        }
      }

      // Get user's current rank
      const user = await db.select().from(users).where(eq(users.id, userId));
      const currentRank = user[0]?.currentRank || "none";

      // If user achieved a new rank
      if (newRank !== currentRank && qualifiedRank) {
        // Update user's current rank
        await db
          .update(users)
          .set({ currentRank: newRank })
          .where(eq(users.id, userId));

        // Check if user already received this rank's incentive
        const existingAchievement = await db
          .select()
          .from(userRankAchievements)
          .where(and(
            eq(userRankAchievements.userId, userId),
            eq(userRankAchievements.rankName, newRank)
          ));

        // If no existing achievement, create one and pay incentive
        if (existingAchievement.length === 0) {
          await db.insert(userRankAchievements).values({
            userId,
            rankName: newRank,
            incentivePaid: true,
            incentiveAmount: qualifiedRank.incentiveAmount,
            volumeAtAchievement: Number(volumeData.totalVolume).toFixed(2),
          });

          // Add incentive to user's withdrawable balance
          const incentiveAmount = parseFloat(qualifiedRank.incentiveAmount);
          const currentWithdrawable = parseFloat(user[0]?.withdrawableAmount || "0");
          
          await db
            .update(users)
            .set({ 
              withdrawableAmount: (currentWithdrawable + incentiveAmount).toFixed(2),
              totalAssets: (parseFloat(user[0]?.totalAssets || "0") + incentiveAmount).toFixed(2)
            })
            .where(eq(users.id, userId));

          // Create transaction record for the incentive
          await db.insert(transactions).values({
            userId,
            type: "Rank Incentive",
            amount: qualifiedRank.incentiveAmount,
            status: "Completed",
            reason: `Rank achievement: ${newRank}`,
          });

          res.json({ 
            success: true, 
            newRank, 
            incentivePaid: true, 
            incentiveAmount: qualifiedRank.incentiveAmount,
            totalVolume: volumeData.totalVolume,
            directVolume: volumeData.directVolume,
            indirectVolume: volumeData.indirectVolume
          });
        } else {
          res.json({ 
            success: true, 
            newRank, 
            incentivePaid: false, 
            message: "Rank updated but incentive already claimed",
            totalVolume: volumeData.totalVolume,
            directVolume: volumeData.directVolume,
            indirectVolume: volumeData.indirectVolume
          });
        }
      } else {
        res.json({ 
          success: true, 
          currentRank, 
          noRankChange: true, 
          totalVolume: volumeData.totalVolume,
          directVolume: volumeData.directVolume,
          indirectVolume: volumeData.indirectVolume
        });
      }
    } catch (error) {
      console.error("Error checking user rank:", error);
      res.status(500).json({ error: "Failed to check user rank" });
    }
  });

  // Get user's rank achievements
  app.get("/api/user/rank-achievements", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const userId = req.user!.id;
      const achievements = await db
        .select()
        .from(userRankAchievements)
        .where(eq(userRankAchievements.userId, userId))
        .orderBy(desc(userRankAchievements.achievedAt));

      res.json(achievements);
    } catch (error) {
      console.error("Error fetching rank achievements:", error);
      res.status(500).json({ error: "Failed to fetch rank achievements" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
