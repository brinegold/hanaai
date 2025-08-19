import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { SalaryScheduler } from "./salary-scheduler";
import { setupAuth } from "./auth";
import { z } from "zod";
import {
  insertInvestmentSchema,
  insertTransactionSchema,
  inviteCodes,
  type User,
  type Investment,
  type Transaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";
import nodemailer from "nodemailer";

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

import { registerAdminRoutes } from "./admin-routes";
import { notifications } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Register admin routes
  registerAdminRoutes(app);
  // Set up authentication routes
  setupAuth(app);

  // API routes - all prefixed with /api

  // Welcome code endpoint
  app.get("/api/welcome-code", async (req, res) => {
    try {
      const welcomeCode = await storage.createWelcomeInviteCode();
      res.json({ code: welcomeCode.code });
    } catch (error) {
      console.error("Error getting welcome code:", error);
      res.status(500).json({ error: "Failed to get welcome code" });
    }
  });

  // Get crypto prices from multiple exchanges
  app.get("/api/crypto/prices", async (req, res) => {
    try {
      const [binanceRes, okxRes, huobiRes, coinbaseRes] = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/24hr"),
        fetch(
          "https://www.okx.com/api/v5/market/tickers?instType=SPOT&instId=BTC-USDT,ETH-USDT,BNB-USDT,XRP-USDT,ADA-USDT,SOL-USDT,DOGE-USDT,AVAX-USDT",
        ),
        fetch("https://api.huobi.pro/market/tickers"),
        fetch("https://api.coinbase.com/v2/exchange-rates"),
      ]);

      const [binanceData, okxData, huobiData, coinbaseData] = await Promise.all(
        [binanceRes.json(), okxRes.json(), huobiRes.json(), coinbaseRes.json()],
      );

      const formatPrice = (price: number) => Number(price.toFixed(2));
      const prices = [];

      // Process Binance data
      try {
        // Check if Binance response indicates a restriction
        if (
          binanceData?.code === 0 &&
          binanceData?.msg?.includes("restricted location")
        ) {
          console.log("Binance API not available in current region");
        } else {
          const binanceSymbols = [
            "BTC",
            "ETH",
            "BNB",
            "XRP",
            "ADA",
            "SOL",
            "DOGE",
            "AVAX",
          ];
          const binanceDataArr = Array.isArray(binanceData) ? binanceData : [];

          binanceDataArr
            .filter((item: any) => {
              const symbolMatch = binanceSymbols.find(
                (sym) => item?.symbol === `${sym}USDT`,
              );
              return item && item.symbol && symbolMatch;
            })
            .forEach((item: any) => {
              const change24h = item.priceChangePercent
                ? parseFloat(item.priceChangePercent)
                : 0;
              prices.push({
                symbol: item.symbol.replace("USDT", ""),
                name: getCryptoName(item.symbol.replace("USDT", "")),
                price: formatPrice(parseFloat(item.lastPrice || "0")),
                change24h: change24h,
                exchange: "BINANCE",
              });
            });
        }
      } catch (error) {
        console.error("Error processing Binance data:", error);
      }

      // Process OKX data
      try {
        const okxDataArr = okxData?.data || [];
        okxDataArr.forEach((item: any) => {
          if (item.instId && item.instId.includes("-USDT")) {
            prices.push({
              symbol: item.instId.split("-")[0],
              name: getCryptoName(item.instId.split("-")[0]),
              price: formatPrice(parseFloat(item.last)),
              change24h: parseFloat(
                (
                  ((parseFloat(item.last) - parseFloat(item.open24h)) /
                    parseFloat(item.open24h)) *
                  100
                ).toFixed(2),
              ),
              exchange: "OKX",
            });
          }
        });
      } catch (error) {
        console.error("Error processing OKX data:", error);
      }

      // Process Huobi data
      try {
        const huobiDataArr = huobiData?.data || [];
        huobiDataArr
          .filter(
            (item: any) => item && item.symbol && item.symbol.endsWith("usdt"),
          )
          .forEach((item: any) => {
            let change24h = 0;
            if (item.close && item.open) {
              const close = parseFloat(item.close);
              const open = parseFloat(item.open);
              if (!isNaN(close) && !isNaN(open) && open !== 0) {
                change24h = parseFloat(
                  (((close - open) / open) * 100).toFixed(2),
                );
              }
            }
            prices.push({
              symbol: item.symbol.replace("usdt", "").toUpperCase(),
              name: getCryptoName(
                item.symbol.replace("usdt", "").toUpperCase(),
              ),
              price: formatPrice(parseFloat(item.close || "0")),
              change24h: change24h,
              exchange: "HUOBI",
            });
          });
      } catch (error) {
        console.error("Error processing Huobi data:", error);
      }

      // Process Coinbase data
      try {
        const relevantSymbols = [
          "BTC",
          "ETH",
          "BNB",
          "XRP",
          "ADA",
          "SOL",
          "DOGE",
          "AVAX",
        ];
        const usdRate = parseFloat(coinbaseData.data.rates.USD);

        relevantSymbols.forEach((symbol) => {
          if (coinbaseData.data.rates[symbol]) {
            prices.push({
              symbol,
              name: getCryptoName(symbol),
              price: formatPrice(
                1 / (parseFloat(coinbaseData.data.rates[symbol]) * usdRate),
              ),
              change24h: 0,
              exchange: "COINBASE",
            });
          }
        });
      } catch (error) {
        console.error("Error processing Coinbase data:", error);
      }

      res.json(prices);

      function getCryptoName(symbol: string): string {
        const names: { [key: string]: string } = {
          BTC: "Bitcoin",
          ETH: "Ethereum",
          BNB: "Binance Coin",
          XRP: "Ripple",
          ADA: "Cardano",
          SOL: "Solana",
          DOGE: "Dogecoin",
          AVAX: "Avalanche",
        };
        return names[symbol] || symbol;
      }
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      res.status(500).json({ error: "Failed to fetch crypto prices" });
    }
  });

  // Get investment plans
  app.get("/api/investment/plans", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      const userBalance = user ? parseFloat(user.totalAssets.toString()) : 0;

      // Always show both plans
      const plans = [
        {
          id: "vip1",
          name: "VIP 1",
          minAmount: userBalance >= 50 ? userBalance : 50,
          maxAmount: 500000,
          dailyRate: 1.5,
          vipLevel: 1,
          description: `Earn 1.5% daily on your investment (Min $50)`,
        },
        {
          id: "vip2",
          name: "VIP 2",
          minAmount: userBalance < 50 ? userBalance : 10,
          maxAmount: 49,
          dailyRate: 1.5,
          vipLevel: 2,
          description: `Earn 1.5% daily on your investment (Min $10)`,
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

      // Validate request data
      const { amount, plan, dailyRate } = req.body;
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      const userBalance = parseFloat(user.totalAssets.toString());

      // Validate VIP 2 plan restrictions
      if (plan === "vip2" && userBalance >= 50) {
        return res.status(400).json({
          error: "Users with balance $50 or more must use VIP 1 plan",
        });
      }

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

      // Verify the user has enough funds

      if (!user) return res.status(404).send("User not found");

      if (parseFloat(user.totalAssets.toString()) < amount) {
        return res.status(400).json({ error: "Insufficient funds" });
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

      // Get the VIP level from the plan ID (e.g., "vip1" -> 1, "vip2" -> 2)
      const vipLevel = parseInt(plan.replace("vip", "")) || 1;

      // Calculate immediate profit based on VIP level
      let instantProfitPercentage = 0.03; // Default for VIP 1 (3%)

      if (vipLevel === 2) {
        instantProfitPercentage = 0.01; // 1% for VIP 2
      }

      const instantProfit = amount * instantProfitPercentage;
      const currentTotalAssets = parseFloat(user.totalAssets.toString());

      // When trading starts:
      // Update assets and withdrawable amount with profit
      const newTotalAssets = (currentTotalAssets + instantProfit).toString();
      await storage.updateUser(req.user!.id, {
        quantitativeAssets: newTotalAssets,
        totalAssets: newTotalAssets,
        profitAssets: (
          parseFloat(user.profitAssets.toString()) + instantProfit
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

        // Update user assets for withdrawal
        await storage.updateUser(req.user!.id, {
          totalAssets: (
            parseFloat(user.totalAssets.toString()) -
            parseFloat(transactionData.amount.toString())
          ).toString(),
          quantitativeAssets: (
            parseFloat(user.quantitativeAssets.toString()) -
            parseFloat(transactionData.amount.toString())
          ).toString(),
        });
      } else if (transactionData.type === "Deposit") {
        const newTotalAssets = (
          parseFloat(user.totalAssets.toString()) +
          parseFloat(transactionData.amount.toString())
        ).toString();

        // Update both total and quantitative assets to be equal
        await storage.updateUser(req.user!.id, {
          totalAssets: newTotalAssets,
          rechargeAmount: (
            parseFloat(user.rechargeAmount.toString()) +
            parseFloat(transactionData.amount.toString())
          ).toString(),
          quantitativeAssets: newTotalAssets,
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
      const [inviteCode, updatedUser] = await Promise.all([
        storage.createInviteCode({
          code,
          createdById: req.user!.id,
        }),
        storage.updateUser(req.user!.id, {
          inviteCode: code,
          referralCode: code,
          updatedAt: new Date(),
        }),
      ]);

      // Return the updated data
      res.json({
        ...inviteCode,
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
      const user = await storage.getUserByResetToken(token);

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
      await storage.updateUser(user.id, {
        password: newHashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      });

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
      const user = await storage.getUserByEmail(email);

      if (user) {
        // Generate reset token
        const resetToken = randomBytes(32).toString("hex");
        const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

        // Store reset token and expiry in the database
        await storage.updateUser(user.id, {
          resetToken: resetToken,
          resetTokenExpiry: resetExpiry,
          updatedAt: new Date(),
        });

        // Create nodemailer transporter with SMTP
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: Boolean(process.env.SMTP_SECURE), // true for 465, false for other ports
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
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      // Get investments, transactions, and referrals
      const investments = await storage.getInvestmentsByUserId(user.id);
      const transactions = await storage.getTransactionsByUserId(user.id);
      const referrals = await storage.getReferralsByReferrerId(user.id);
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt));

      // Calculate total earnings and other statistics
      const totalInvested = investments.reduce(
        (sum, inv) => sum + parseFloat(inv.amount.toString()),
        0,
      );
      const currentBalance = parseFloat(user.totalAssets.toString());
      const totalProfit = parseFloat(user.profitAssets.toString());

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
          telegram: user.telegram,
          referralCode: user.referralCode,
          totalAssets: user.totalAssets,
          quantitativeAssets: user.quantitativeAssets,
          profitAssets: user.profitAssets,
          todayEarnings: user.todayEarnings,
          yesterdayEarnings: user.yesterdayEarnings,
          lastInvestmentDate: user.lastInvestmentDate,
          createdAt: user.createdAt,
          notifications: userNotifications,
        },
        stats: {
          totalInvested,
          currentBalance,
          totalProfit,
          activeInvestments: investments.filter(
            (inv) => inv.status === "Active",
          ).length,
          referralsCount: referrals.length,
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

      const updatedUser = await storage.updateUser(req.user!.id, userData);
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

  // Get dashboard statistics - protected route
  app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      const investments = await storage.getInvestmentsByUserId(user.id);
      const activeInvestments = investments.filter(
        (inv) => inv.status === "Active",
      );
      const referrals = await storage.getReferralsByReferrerId(user.id);

      res.json({
        totalAssets: user.totalAssets,
        quantitativeAssets: user.quantitativeAssets,
        profitAssets: user.profitAssets,
        todayEarnings: user.todayEarnings,
        yesterdayEarnings: user.yesterdayEarnings,
        commissionToday: user.commissionToday,
        activeInvestmentsCount: activeInvestments.length,
        referralsCount: referrals.length,
      });
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Initialize salary scheduler
  const salaryScheduler = SalaryScheduler.getInstance();
  salaryScheduler.start();

  // Daily earnings calculation for all users (weekdays only)
  const calculateDailyEarnings = async () => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Only generate earnings on weekdays (Monday to Friday)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log('Skipping daily earnings calculation - weekend');
        return;
      }
      
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

        if (totalEarnings > 0) {
          // Update user's earnings
          await storage.updateUser(user.id, {
            yesterdayEarnings: user.todayEarnings.toString(),
            todayEarnings: totalEarnings.toString(),
            profitAssets: (
              parseFloat(user.profitAssets.toString()) + totalEarnings
            ).toString(),
            totalAssets: (
              parseFloat(user.totalAssets.toString()) + totalEarnings
            ).toString(),
            quantitativeAssets: (
              parseFloat(user.quantitativeAssets.toString()) + totalEarnings
            ).toString(),
          });

          // Create profit transaction record
          const profitTransaction: Omit<Transaction, "id" | "createdAt"> = {
            userId: user.id,
            type: "Profit",
            amount: totalEarnings.toString(),
            status: "Completed",
            txHash: null,
          };
          await storage.createTransaction(profitTransaction);
        }
      }
    } catch (error) {
      console.error("Error calculating daily earnings:", error);
    }
  };

  // Run daily earnings calculation every 24 hours
  setInterval(calculateDailyEarnings, 24 * 60 * 60 * 1000);

  // Add manual salary payout endpoint for admin
  app.post("/api/admin/trigger-salary-payout", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const user = await storage.getUser(req.user!.id);
    if (!user?.isAdmin) return res.status(403).send("Admin access required");

    try {
      await salaryScheduler.triggerWeeklySalaryPayout();
      res.json({ success: true, message: "Weekly salary payout triggered" });
    } catch (error) {
      console.error("Error triggering salary payout:", error);
      res.status(500).json({ error: "Failed to trigger salary payout" });
    }
  });

  // Simulate daily earnings for active investments - protected route
  // (In production, this would be a cron job or scheduled task)
  app.post("/api/simulate-earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Only generate earnings on weekdays (Monday to Friday)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.json({
          success: false,
          message: "Earnings are only generated on weekdays (Monday to Friday)",
          dailyEarnings: 0,
          isWeekend: true
        });
      }
      
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

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
      const updatedUser = await storage.updateUser(user.id, {
        yesterdayEarnings: user.todayEarnings.toString(),
        todayEarnings: totalEarnings.toString(),
        profitAssets: (
          parseFloat(user.profitAssets.toString()) + totalEarnings
        ).toString(),
        totalAssets: (
          parseFloat(user.totalAssets.toString()) + totalEarnings
        ).toString(),
        quantitativeAssets: (
          parseFloat(user.quantitativeAssets.toString()) + totalEarnings
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
        };
        await storage.createTransaction(profitTransaction);
      }

      res.json({
        success: true,
        dailyEarnings: totalEarnings,
        totalProfitAssets: updatedUser?.profitAssets || "0",
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

      // Check if user meets requirements
      const referrals = await storage.getReferralsByReferrerId(user.id);
      let totalDownlineDeposits = 0;

      for (const referral of referrals) {
        const referredUser = await storage.getUser(referral.referredId);
        if (referredUser) {
          totalDownlineDeposits += parseFloat(
            referredUser.rechargeAmount.toString(),
          );
        }
      }

      if (totalDownlineDeposits < 5000) {
        return res.status(400).json({
          message: "Total downline deposits must be at least $5000 to apply",
        });
      }

      await storage.updateUser(user.id, {
        countryRepStatus: "pending",
      });

      res.json({ message: "Application submitted successfully" });
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

  // Verify security password - protected route
  app.post("/api/verify-security-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { securityPassword } = req.body;

      if (!securityPassword) {
        return res
          .status(400)
          .json({ message: "Security password is required" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Verify security password
      const isValid = await comparePasswords(
        securityPassword,
        user.securityPassword,
      );

      if (!isValid) {
        return res.status(401).json({ message: "Invalid security password" });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error verifying security password:", err);
      res.status(500).json({ message: "Failed to verify security password" });
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
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      const existingTransactions = await storage.getTransactionsByUserId(
        req.user!.id,
      );
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
      } else if (transactionData.type === "Withdrawal") {
        // Skip time check for admin users
        if (!user.isAdmin) {
          // Check if withdrawal is on Friday in Taiwan timezone
          const nowInTaiwan = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }),
          );
          const dayOfWeek = nowInTaiwan.getDay(); // 0 is Sunday, 5 is Friday

          if (dayOfWeek !== 5) {
            return res.status(400).json({
              message:
                "Withdrawals are only allowed on Fridays (Taiwan Time Zone UTC+8)",
            });
          }
        }

        // Check for minimum withdrawal
        if (transactionData.amount < 3) {
          return res.status(400).json({
            message: "Minimum withdrawal amount is $3",
          });
        }

        // Get all user's deposits and commissions
        const userTransactions = await storage.getTransactionsByUserId(user.id);
        const deposits = userTransactions.filter(
          (tx) => tx.type === "Deposit" && tx.status === "Completed",
        );
        const totalCommissions = userTransactions
          .filter((tx) => tx.type === "Commission" && tx.status === "Completed")
          .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);

        // Calculate maximum withdrawable amount (200% of deposits + all commissions)
        const maxFromDeposits = deposits.reduce(
          (sum, deposit) => sum + parseFloat(deposit.amount.toString()) * 2,
          0,
        );
        const maxWithdrawableAmount = maxFromDeposits + totalCommissions;

        // Check if withdrawal amount exceeds limit
        const totalAmount = transactionData.amount + (transactionData.fee || 0);
        if (totalAmount > maxWithdrawableAmount) {
          return res.status(400).json({
            message: `Maximum withdrawal amount is ${maxWithdrawableAmount.toFixed(2)} USDT (200% of deposits plus commissions)`,
          });
        }

        // Check sufficient funds for withdrawal
        if (parseFloat(user.totalAssets.toString()) < totalAmount) {
          return res
            .status(400)
            .json({ message: "Insufficient funds for withdrawal" });
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
        fee: transactionData.type === "Withdrawal" ? "0.5" : "0",
        processingTime: null,
        completionTime: null,
        reason: null,
        txHash: transactionData.txHash || null,
        userId: req.user!.id,
      };

      // If it's a deposit, set quantitative assets to 0
      if (transactionData.type === "Deposit") {
        await storage.updateUser(req.user!.id, {
          quantitativeAssets: "0",
        });
      }

      const transaction = await storage.createTransaction(transactionToCreate);

      // Create transaction history entry
      await storage.createTransactionHistory({
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

  // Verification upload endpoint
  app.post("/api/verify/upload", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      // Here you would typically:
      // 1. Handle file upload (using multer or similar)
      // 2. Store the file securely
      // 3. Update user verification status
      // 4. Queue the document for review

      // For demo purposes, we'll just acknowledge the upload
      await storage.updateUser(req.user!.id, {
        verificationStatus: "pending",
        verificationSubmittedAt: new Date(),
      });

      res.status(200).json({ message: "Document uploaded successfully" });
    } catch (error) {
      console.error("Verification upload error:", error);
      res.status(500).json({ error: "Failed to upload verification document" });
    }
  });

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

  const httpServer = createServer(app);
  return httpServer;
}
