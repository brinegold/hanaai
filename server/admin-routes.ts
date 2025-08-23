import type { Express } from "express";
import { storage } from "./storage";

function isAdmin(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction,
) {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!user.isAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
}

export function registerAdminRoutes(app: Express) {
  // Get all users
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(
        users.map((user) => ({
          ...user,
          password: undefined,
          securityPassword: undefined,
        })),
      );
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get platform statistics
  // Delete user account
  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(parseInt(id));
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Add manual deposit
  app.post("/api/admin/users/:id/deposit", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create and complete deposit transaction immediately
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Deposit",
        amount: amount.toString(),
        status: "Completed",
        txHash: null,
      });

      // Update user's assets immediately
      await storage.updateUser(parseInt(id), {
        totalAssets: (parseFloat(user.totalAssets.toString()) + parseFloat(amount.toString())).toString(),
        rechargeAmount: (parseFloat(user.rechargeAmount.toString()) + parseFloat(amount.toString())).toString(),
      });

      res.json(transaction);
    } catch (err) {
      console.error("Error adding manual deposit:", err);
      res.status(500).json({ message: "Failed to add deposit" });
    }
  });

  // Ban user route
  app.post("/api/admin/users/:id/ban", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(parseInt(id), {
        isBanned: true,
        updatedAt: new Date(),
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error banning user:", err);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  // Unban user route
  app.post("/api/admin/users/:id/unban", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(parseInt(id), {
        isBanned: false,
        updatedAt: new Date(),
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error unbanning user:", err);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const transactions = await storage.getAllTransactions();
      const investments = await storage.getAllInvestments();

      const stats = {
        totalUsers: users.length,
        totalDeposits: transactions
          .filter((t) => t.type === "Deposit" && t.status === "Completed")
          .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0),
        totalWithdrawals: transactions
          .filter((t) => t.type === "Withdrawal" && t.status === "Completed")
          .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0),
        totalInvestments: investments
          .filter((i) => i.status === "Active")
          .reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0),
        pendingTransactions: transactions.filter((t) => t.status === "Pending")
          .length,
        activeInvestments: investments.filter((i) => i.status === "Active")
          .length,
        transactions: transactions
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 50), // Show last 50 transactions
      };

      res.json(stats);
    } catch (err) {
      console.error("Error fetching platform stats:", err);
      res.status(500).json({ message: "Failed to fetch platform statistics" });
    }
  });

  // Get pending transactions
  app.get("/api/admin/transactions/pending", async (req, res) => {
    try {
      const transactions = await storage.getPendingTransactions();
      // Enrich transaction data with user details and withdrawal info
      const enrichedTransactions = await Promise.all(
        transactions.map(async (tx) => {
          const fullTx = await storage.getTransaction(tx.id);
          if (tx.type === "Withdrawal") {
            const user = await storage.getUser(tx.userId);
            return {
              ...tx,
              userEmail: user?.email,
              username: user?.username,
              address: fullTx.address,
              network: fullTx.network,
            };
          }
          return tx;
        }),
      );
      res.json(enrichedTransactions);
    } catch (err) {
      console.error("Error fetching pending transactions:", err);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Approve transaction
  app.post("/api/admin/transactions/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const user = await storage.getUser(transaction.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Handle different transaction types
      if (transaction.type === "Withdrawal") {
        const withdrawalAmount = parseFloat(transaction.amount.toString());
        const fee = 0.5; // Standard withdrawal fee
        const totalDeduction = withdrawalAmount + fee;

        // Deduct only from withdrawable amount
        await storage.updateUser(user.id, {
          withdrawableAmount: (
            parseFloat(user.withdrawableAmount.toString()) - totalDeduction
          ).toString(),
        });
      } else if (transaction.type === "Deposit") {
        const depositAmount = parseFloat(transaction.amount.toString());
        let totalAmount = depositAmount;

        // Handle multi-tier referral commissions
        const referrals = await storage.getReferralsByReferredId(user.id);

        if (referrals.length > 0) {
          // Check if user has previous deposits
          const userDeposits = await storage.getTransactionsByUserId(user.id);
          const completedDeposits = userDeposits.filter(
            (t) => t.type === "Deposit" && t.status === "Completed",
          );

          // Only give commission if this is the first deposit
          if (completedDeposits.length === 0) {
            // Commission rates for each tier
            const tierCommissionRates = {
              "1": 0.05, // 5% for Tier 1
              "2": 0.03, // 3% for Tier 2
              "3": 0.02, // 2% for Tier 3
              "4": 0.01, // 1% for Tier 4
            };

            // Process commissions for all tiers
            for (const referral of referrals) {
              const referrer = await storage.getUser(referral.referrerId);
              if (referrer) {
                let commissionRate = tierCommissionRates[referral.level] || 0;

                const commissionAmount = depositAmount * commissionRate;

                if (commissionAmount > 0) {
                  // Update referrer's assets with commission - only add to withdrawable amount
                  await storage.updateUser(referrer.id, {
                    commissionAssets: (
                      parseFloat(referrer.commissionAssets.toString()) +
                      commissionAmount
                    ).toString(),
                    commissionToday: (
                      parseFloat(referrer.commissionToday.toString()) +
                      commissionAmount
                    ).toString(),
                    withdrawableAmount: (
                      parseFloat(referrer.withdrawableAmount.toString()) +
                      commissionAmount
                    ).toString(),
                  });

                  // Update referral commission record
                  const currentCommission = parseFloat(
                    referral.commission || "0",
                  );
                  await storage.updateReferral(referral.id, {
                    commission: (currentCommission + commissionAmount).toString(),
                  });

                  // Create commission transaction
                  await storage.createTransaction({
                    userId: referrer.id,
                    type: "Commission",
                    amount: commissionAmount.toString(),
                    status: "Completed",
                    reason: `Tier ${referral.level} referral commission from ${user.username || user.email}`,
                    txHash: null,
                  });
                }
              }
            }
          }
        }

        // Update user balance
        await storage.updateUser(user.id, {
          totalAssets: (
            parseFloat(user.totalAssets.toString()) + depositAmount
          ).toString(),
          rechargeAmount: (
            parseFloat(user.rechargeAmount.toString()) + depositAmount
          ).toString(),
        });
      }

      // Update transaction status
      const updatedTransaction = await storage.updateTransaction(id, {
        status: "Completed",
        completionTime: new Date(),
      });

      await storage.createTransactionHistory({
        transactionId: id,
        status: "Completed",
        timestamp: new Date(),
        details: "Transaction approved by admin",
      });

      res.json(updatedTransaction);
    } catch (err) {
      console.error("Error approving transaction:", err);
      res.status(500).json({ message: "Failed to approve transaction" });
    }
  });

  // Reject transaction
  // Send mass notification
  // Mass messaging endpoint
  app.post("/api/admin/notifications/mass", async (req, res) => {
    try {
      const { message } = req.body;
      const users = await storage.getAllUsers();

      for (const user of users) {
        await storage.createNotification({
          userId: user.id,
          type: "system",
          message,
          isRead: false,
        });
      }

      res.json({ message: "Mass notification sent successfully" });
    } catch (err) {
      console.error("Error sending mass notification:", err);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // Private messaging endpoint
  app.post("/api/admin/messages/private/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { message } = req.body;

      if (!message?.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await storage.createNotification({
        userId: parseInt(userId),
        type: "private",
        message,
        isRead: false,
      });

      res.json({ message: "Private message sent successfully" });
    } catch (err) {
      console.error("Error sending private message:", err);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Approve Country Representative with $10,000 bonus
  app.post("/api/admin/users/:id/approve-country-rep", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      
      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if already approved
      if (user.isCountryRep) {
        return res.status(400).json({ message: "User is already a Country Representative" });
      }

      // Country Rep bonus amount
      const bonusAmount = 10000;

      // Update user status and add bonus
      const updatedUser = await storage.updateUser(userId, {
        isCountryRep: true,
        countryRepStatus: "approved",
        withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + bonusAmount).toString(),
        updatedAt: new Date(),
      });

      // Create bonus transaction record
      await storage.createTransaction({
        userId: userId,
        type: "Bonus",
        amount: bonusAmount.toString(),
        status: "Completed",
        txHash: null,
      });

      // Create notification for user
      await storage.createNotification({
        userId: userId,
        type: "system",
        message: `🎉 Congratulations! You have been approved as a Country Representative and received a $${bonusAmount.toLocaleString()} bonus!`,
        isRead: false,
      });

      res.json({
        ...updatedUser,
        bonusAwarded: bonusAmount,
        message: `Country Representative approved with $${bonusAmount.toLocaleString()} bonus`,
      });
    } catch (err) {
      console.error("Error approving country rep:", err);
      res.status(500).json({ message: "Failed to approve country representative" });
    }
  });

  app.post("/api/admin/users/:id/verify", async (req, res) => {
    try {
      const { id } = req.params;
      // Verification updates are handled without commission in storage.ts
      const updatedUser = await storage.updateUser(parseInt(id), {
        verificationStatus: "verified",
        updatedAt: new Date(),
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error verifying user:", err);
      res.status(500).json({ message: "Failed to verify user" });
    }
  });

  app.post("/api/admin/transactions/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedTransaction = await storage.updateTransaction(parseInt(id), {
        status: "Failed",
      });
      res.json(updatedTransaction);
    } catch (err) {
      console.error("Error rejecting transaction:", err);
      res.status(500).json({ message: "Failed to reject transaction" });
    }
  });
}
