import type { Express } from "express";
import { storage } from "./storage";
import nodemailer from "nodemailer";



async function sendWithdrawalApprovalEmail(user: any, transaction: any, txHash: string) {
  try {
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

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Withdrawal Approved - Nebrix AI Trading",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
          </div>
          
          <h1 style="color: #2c3e50; text-align: center;">Withdrawal Approved!</h1>
          
          <p style="color: #333; font-size: 16px;">Hello <strong>${user.username || user.email}</strong>,</p>
          
          <p style="color: #333; font-size: 16px;">Great news! Your withdrawal request has been approved and processed.</p>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #27ae60; margin-top: 0;">Withdrawal Details:</h3>
            <p><strong>Amount:</strong> $${parseFloat(transaction.amount.toString()).toFixed(2)}</p>
            <p><strong>Destination Address:</strong> ${transaction.address}</p>
            <p><strong>Network:</strong> ${transaction.network || 'BSC'}</p>
            <p><strong>Transaction Hash:</strong> <a href="https://bscscan.com/tx/${txHash}" style="color: #3498db; text-decoration: none;">${txHash}</a></p>
            <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">Completed</span></p>
          </div>
          
          <p style="color: #333; font-size: 16px;">Your funds have been successfully transferred to your wallet. You can verify the transaction on the blockchain using the transaction hash above.</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Note:</strong> It may take a few minutes for the transaction to be confirmed on the blockchain network.</p>
          </div>
          
          <p style="color: #333; font-size: 16px;">Thank you for using Nebrix AI Trading!</p>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">Best regards,<br>The Nebrix Team</p>
          </div>
        </div>
      `,
    });

    console.log(`Withdrawal approval email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send withdrawal approval email:", error);
  }
}

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
      
      // Calculate direct and indirect volumes for each user
      const enrichedUsers = await Promise.all(
        users.map(async (user) => {
          // Calculate direct volume (sum of deposits from direct referrals)
          const directReferrals = await storage.getReferralsByReferrerId(user.id);
          const directReferralIds = directReferrals
            .filter(ref => ref.level === "1")
            .map(ref => ref.referredId);
          
          let directVolume = 0;
          for (const referralId of directReferralIds) {
            const referralUser = await storage.getUser(referralId);
            if (referralUser) {
              directVolume += parseFloat(referralUser.rechargeAmount.toString());
            }
          }
          
          // Calculate indirect volume (sum of deposits from indirect referrals - levels 2, 3, 4)
          const indirectReferrals = directReferrals
            .filter(ref => ref.level !== "1")
            .map(ref => ref.referredId);
          
          let indirectVolume = 0;
          for (const referralId of indirectReferrals) {
            const referralUser = await storage.getUser(referralId);
            if (referralUser) {
              indirectVolume += parseFloat(referralUser.rechargeAmount.toString());
            }
          }
          
          // Get upline username if user has a referrer
          let uplineUsername = null;
          if (user.referrerId) {
            const uplineUser = await storage.getUser(user.referrerId);
            uplineUsername = uplineUser?.username || null;
          }
          
          return {
            ...user,
            password: undefined,
            securityPassword: undefined,
            rank: user.currentRank || 'Bronze',
            directVolume: directVolume,
            indirectVolume: indirectVolume,
            uplineUsername: uplineUsername,
          };
        })
      );
      
      res.json(enrichedUsers);
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

  // Add withdrawable amount
  app.post("/api/admin/users/:id/add-withdrawable", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create a bonus transaction record
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Bonus",
        amount: amount.toString(),
        status: "Completed",
        reason: "Admin added withdrawable amount",
        txHash: null,
      });

      // Update user's withdrawable amount
      await storage.updateUser(parseInt(id), {
        withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + parseFloat(amount.toString())).toString(),
      });

      res.json(transaction);
    } catch (err) {
      console.error("Error adding withdrawable amount:", err);
      res.status(500).json({ message: "Failed to add withdrawable amount" });
    }
  });

  // Deduct withdrawable amount from user
  app.post("/api/admin/users/:id/deduct-withdrawable", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const deductAmount = parseFloat(amount);
      const currentWithdrawable = parseFloat(user.withdrawableAmount.toString());

      if (deductAmount > currentWithdrawable) {
        return res.status(400).json({ 
          message: `Cannot deduct $${deductAmount}. User only has $${currentWithdrawable} withdrawable.` 
        });
      }

      // Create transaction record for the deduction
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Admin Deduction",
        amount: (-deductAmount).toString(),
        status: "Completed",
        reason: "Admin deducted withdrawable amount",
        txHash: null,
      });

      // Update user's withdrawable amount
      await storage.updateUser(parseInt(id), {
        withdrawableAmount: (currentWithdrawable - deductAmount).toString(),
        totalAssets: (parseFloat(user.totalAssets.toString()) - deductAmount).toString(),
      });

      res.json({
        success: true,
        message: `Successfully deducted $${deductAmount} from user's withdrawable balance`,
        transaction,
        newWithdrawableAmount: (currentWithdrawable - deductAmount).toFixed(2)
      });
    } catch (err) {
      console.error("Error deducting withdrawable amount:", err);
      res.status(500).json({ message: "Failed to deduct withdrawable amount" });
    }
  });

  // Deduct deposit amount from user (reverse deposit)
  app.post("/api/admin/users/:id/deduct-deposit", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const deductAmount = parseFloat(amount);
      const currentRechargeAmount = parseFloat(user.rechargeAmount.toString());
      const currentTotalAssets = parseFloat(user.totalAssets.toString());

      if (deductAmount > currentRechargeAmount) {
        return res.status(400).json({ 
          message: `Cannot deduct $${deductAmount}. User only has $${currentRechargeAmount} in deposits.` 
        });
      }

      // Create transaction record for the deposit deduction
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Deposit Reversal",
        amount: (-deductAmount).toString(),
        status: "Completed",
        reason: reason || "Admin reversed deposit transaction",
        txHash: null,
      });

      // Update user's deposit amount and total assets
      await storage.updateUser(parseInt(id), {
        rechargeAmount: (currentRechargeAmount - deductAmount).toString(),
        totalAssets: (currentTotalAssets - deductAmount).toString(),
      });

      // Create notification for user
      await storage.createNotification({
        userId: parseInt(id),
        type: "system",
        message: `Your deposit has been reversed: -$${deductAmount.toFixed(2)}. Reason: ${reason || "Administrative action"}`,
        isRead: false,
      });

      res.json({
        success: true,
        message: `Successfully deducted $${deductAmount} from user's deposit balance`,
        transaction,
        newDepositAmount: (currentRechargeAmount - deductAmount).toFixed(2),
        newTotalAssets: (currentTotalAssets - deductAmount).toFixed(2)
      });
    } catch (err) {
      console.error("Error deducting deposit amount:", err);
      res.status(500).json({ message: "Failed to deduct deposit amount" });
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
        console.log("Processing withdrawal approval for transaction:", {
          id: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          address: transaction.address,
          status: transaction.status,
          fullTransaction: transaction
        });

        // Import BSC service for processing withdrawal
        const { default: BSCService } = await import("./bsc-service");
        const BSC_CONFIG = {
          rpcUrl: process.env.BSC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
          contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
          usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb",
          adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
          globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
          privateKey: process.env.BSC_PRIVATE_KEY || ""
        };
        const bscService = new BSCService(BSC_CONFIG);

        const withdrawalAmount = parseFloat(transaction.amount.toString());
        const walletAddress = transaction.address;
        
        console.log("Extracted withdrawal details:", {
          withdrawalAmount,
          walletAddress,
          addressExists: !!walletAddress
        });
        
        if (!walletAddress) {
          throw new Error("Withdrawal address not found");
        }

        // Get related fee transactions
        const allUserTransactions = await storage.getTransactionsByUserId(user.id);
        const relatedFeeTransactions = allUserTransactions.filter(tx => 
          tx.status === "Pending" && 
          (tx.type === "Withdrawal Fee" || tx.type === "Gas Fee") &&
          tx.createdAt >= transaction.createdAt
        );

        let withdrawalFee = 0;
        let gasFee = 0;
        
        for (const feeTx of relatedFeeTransactions) {
          if (feeTx.type === "Withdrawal Fee") {
            withdrawalFee = parseFloat(feeTx.amount.toString());
          } else if (feeTx.type === "Gas Fee") {
            gasFee = parseFloat(feeTx.amount.toString());
          }
        }

        const totalRequestedAmount = withdrawalAmount + withdrawalFee + gasFee;

        try {
          // Process actual blockchain withdrawal
          const transferHashes = await bscService.processWithdrawal(
            walletAddress,
            withdrawalAmount.toString(),
            withdrawalFee.toString()
          );

          // Update transaction with blockchain hash
          await storage.updateTransaction(id, {
            txHash: transferHashes.withdrawalTxHash,
          });

          // Update related fee transactions
          for (const feeTx of relatedFeeTransactions) {
            if (feeTx.type === "Withdrawal Fee") {
              await storage.updateTransaction(feeTx.id, {
                status: "Completed",
                txHash: transferHashes.feeTxHash,
              });
            } else if (feeTx.type === "Gas Fee") {
              await storage.updateTransaction(feeTx.id, {
                status: "Completed",
                txHash: transferHashes.withdrawalTxHash,
              });
            }
          }

          // Deduct from user's withdrawable amount
          await storage.updateUser(user.id, {
            withdrawableAmount: (
              parseFloat(user.withdrawableAmount.toString()) - totalRequestedAmount
            ).toString(),
            totalAssets: (
              parseFloat(user.totalAssets.toString()) - totalRequestedAmount
            ).toString(),
          });

          console.log("Withdrawal approved and processed:", {
            userId: user.id,
            amount: withdrawalAmount,
            address: walletAddress,
            txHash: transferHashes.withdrawalTxHash
          });

          // Send email notification to user
          if (user.email) {
            await sendWithdrawalApprovalEmail(user, transaction, transferHashes.withdrawalTxHash);
          }

        } catch (blockchainError) {
          console.error("Blockchain withdrawal failed:", blockchainError);
          throw new Error(`Blockchain processing failed: ${blockchainError.message}`);
        }
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
