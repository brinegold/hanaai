import { Express } from "express";
import BSCService from "./bsc-service";
import { storage } from './storage';

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955",
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || ""
};

export function registerBSCRoutes(app: Express) {
  const bscService = new BSCService(BSC_CONFIG);

  // Get user's unique BSC wallet address
  app.get("/api/bsc/wallet", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).send("User not found");

      // Generate or retrieve user's BSC wallet
      let walletAddress = user.bscWalletAddress;
      
      if (!walletAddress) {
        const wallet = bscService.generateUserWallet(user.id);
        walletAddress = wallet.address;
        
        // Store wallet address (not private key for security)
        await storage.updateUser(req.user!.id, {
          bscWalletAddress: walletAddress
        });
      }

      res.json({
        address: walletAddress,
        walletAddress,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}`,
        network: "BSC (Binance Smart Chain)",
        tokenContract: BSC_CONFIG.usdtContractAddress
      });
    } catch (error) {
      console.error("Error getting BSC wallet:", error);
      res.status(500).json({ error: "Failed to get wallet address" });
    }
  });

  // Process deposit with transaction hash verification
  app.post("/api/bsc/deposit", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { txHash, amount } = req.body;
      const user = await storage.getUser(req.user!.id);
      
      if (!user) return res.status(404).send("User not found");
      if (!user.bscWalletAddress) return res.status(400).json({ error: "No BSC wallet found" });

      // Verify transaction hash
      const txDetails = await bscService.verifyTransaction(txHash);
      
      // Debug wallet addresses
      console.log("Transaction details:", {
        txHash,
        from: txDetails.from,
        to: txDetails.to,
        userBscWallet: user.bscWalletAddress
      });

      // For TestUSDT transactions, we need to check if it's a token transfer to the user's wallet
      // The transaction 'to' field will be the TestUSDT contract, but we need to decode the transfer
      if (txDetails.to.toLowerCase() === BSC_CONFIG.usdtContractAddress.toLowerCase()) {
        console.log("This is a TestUSDT token transfer transaction");
        // For now, we'll allow TestUSDT contract transactions and verify the recipient in the token transfer data
        // TODO: Add proper token transfer decoding to verify the actual recipient
      } else if (user.bscWalletAddress && txDetails.to.toLowerCase() !== user.bscWalletAddress.toLowerCase()) {
        return res.status(400).json({ 
          error: `Transaction not sent to your wallet. Expected: ${user.bscWalletAddress}, Got: ${txDetails.to}` 
        });
      }

      // Check if transaction already processed
      const existingTx = await storage.getTransactionByHash(txHash);
      if (existingTx) {
        return res.status(400).json({ error: "Transaction already processed" });
      }

      // Calculate amounts (5% fee, 95% to user)
      const depositAmount = parseFloat(amount);
      const adminFee = depositAmount * 0.05;
      const userAmount = depositAmount * 0.95;

      console.log("Processing deposit:", {
        originalAmount: depositAmount,
        adminFee,
        userAmount,
        userId: user.id
      });

      // Collect deposited tokens and distribute to admin wallets
      let transferHashes;
      try {
        transferHashes = await bscService.collectDepositTokens(
          depositAmount.toString(),
          adminFee.toString()
        );
        console.log("Deposit tokens collected and distributed:", transferHashes);
      } catch (transferError) {
        console.error("Error collecting deposit tokens:", transferError);
        return res.status(500).json({ 
          error: "Failed to collect deposit tokens",
          details: transferError instanceof Error ? transferError.message : String(transferError)
        });
      }

      // Create deposit transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Deposit",
        amount: userAmount.toString(),
        status: "Completed",
        txHash: txHash, // Use original transaction hash
        fromAddress: txDetails.from,
        toAddress: txDetails.to,
        blockNumber: txDetails.blockNumber,
        confirmationStatus: "confirmed",
        reason: `BSC testnet deposit - TX: ${txHash}`
      });

      // Create admin fee transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Admin Fee",
        amount: adminFee.toString(),
        status: "Completed",
        txHash: transferHashes.adminFeeTxHash, // Use admin fee transfer hash
        fromAddress: BSC_CONFIG.globalAdminWallet,
        toAddress: BSC_CONFIG.adminFeeWallet,
        blockNumber: txDetails.blockNumber,
        confirmationStatus: "confirmed",
        reason: `Admin fee for deposit - Original TX: ${txHash}`
      });

      // Update user balance
      const currentTotalAssets = parseFloat(user.totalAssets.toString());
      const currentRechargeAmount = parseFloat(user.rechargeAmount.toString());
      
      await storage.updateUser(user.id, {
        totalAssets: (currentTotalAssets + userAmount).toString(),
        rechargeAmount: (currentRechargeAmount + userAmount).toString()
      });

      console.log("Deposit completed successfully:", {
        newTotalAssets: currentTotalAssets + userAmount,
        newRechargeAmount: currentRechargeAmount + userAmount
      });

      res.json({
        success: true,
        message: "Deposit processed successfully",
        amount: userAmount,
        fee: adminFee,
        txHash: txHash
      });

    } catch (error) {
      console.error("Error processing BSC deposit:", error);
      res.status(500).json({ error: "Failed to process deposit" });
    }
  });

  // Process withdrawal to user's specified wallet
  app.post("/api/bsc/withdraw", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { amount, walletAddress } = req.body;
      const user = await storage.getUser(req.user!.id);
      
      if (!user) return res.status(404).send("User not found");

      const withdrawAmount = parseFloat(amount);
      const userBalance = parseFloat(user.withdrawableAmount.toString());
      const directDepositAmount = parseFloat(user.directDepositAmount?.toString() || user.rechargeAmount?.toString() || "0");
      const totalWithdrawnFromDeposits = parseFloat(user.totalWithdrawnFromDeposits?.toString() || "0");
      const referralBonuses = parseFloat(user.referralBonuses?.toString() || "0");
      const rankingBonuses = parseFloat(user.rankingBonuses?.toString() || "0");

      // Calculate withdrawal limits
      const maxWithdrawableFromDeposits = Math.max(0, (directDepositAmount * 3) - totalWithdrawnFromDeposits);
      const availableReferralAndRankingBonuses = referralBonuses + rankingBonuses;
      const totalAvailableForWithdrawal = maxWithdrawableFromDeposits + availableReferralAndRankingBonuses;

      // Verify user has sufficient balance
      if (withdrawAmount > userBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Check if withdrawal exceeds limits
      if (withdrawAmount > totalAvailableForWithdrawal) {
        return res.status(400).json({ 
          error: `Withdrawal limit exceeded. Maximum available: $${totalAvailableForWithdrawal.toFixed(2)} (Trading profits: $${maxWithdrawableFromDeposits.toFixed(2)}, Bonuses: $${availableReferralAndRankingBonuses.toFixed(2)})` 
        });
      }

      // Calculate amounts (10% fee, 90% to user)
      const fee = withdrawAmount * 0.1;
      const netAmount = withdrawAmount * 0.9;

      console.log("Processing withdrawal:", {
        requestedAmount: withdrawAmount,
        fee,
        netAmount,
        userId: user.id,
        toAddress: walletAddress
      });

      // Process actual token transfers from global admin to user
      let transferHashes;
      try {
        transferHashes = await bscService.processWithdrawal(
          walletAddress,
          withdrawAmount.toString(),
          fee.toString()
        );
        console.log("Withdrawal transfers completed:", transferHashes);
      } catch (transferError) {
        console.error("Error processing withdrawal transfers:", transferError);
        return res.status(500).json({ 
          error: "Failed to process withdrawal transfers",
          details: transferError instanceof Error ? transferError.message : String(transferError)
        });
      }

      // Create withdrawal transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal",
        amount: netAmount.toString(),
        status: "Completed",
        address: walletAddress, // Save withdrawal address for display in account details
        network: "BSC",
        txHash: transferHashes.withdrawalTxHash,
        fromAddress: BSC_CONFIG.globalAdminWallet,
        toAddress: walletAddress,
        confirmationStatus: "confirmed",
        reason: `BSC withdrawal to ${walletAddress}`
      });

      // Create fee transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal Fee",
        amount: fee.toString(),
        status: "Completed",
        txHash: transferHashes.feeTxHash,
        fromAddress: BSC_CONFIG.globalAdminWallet,
        toAddress: BSC_CONFIG.adminFeeWallet,
        confirmationStatus: "confirmed",
        reason: `10% withdrawal fee`
      });

      // Calculate how much comes from deposits vs bonuses
      let withdrawnFromDeposits = 0;
      let withdrawnFromBonuses = 0;
      
      if (withdrawAmount <= availableReferralAndRankingBonuses) {
        // Withdrawal comes entirely from bonuses
        withdrawnFromBonuses = withdrawAmount;
      } else if (withdrawAmount <= maxWithdrawableFromDeposits) {
        // Withdrawal comes entirely from trading profits
        withdrawnFromDeposits = withdrawAmount;
      } else {
        // Withdrawal comes from both sources
        withdrawnFromBonuses = availableReferralAndRankingBonuses;
        withdrawnFromDeposits = withdrawAmount - availableReferralAndRankingBonuses;
      }

      // Update user balance and tracking fields
      const updateData: any = {
        withdrawableAmount: (userBalance - withdrawAmount).toString(),
        totalAssets: (parseFloat(user.totalAssets.toString()) - withdrawAmount).toString()
      };

      if (withdrawnFromDeposits > 0) {
        updateData.totalWithdrawnFromDeposits = (totalWithdrawnFromDeposits + withdrawnFromDeposits).toString();
      }

      if (withdrawnFromBonuses > 0) {
        const newReferralBonuses = Math.max(0, referralBonuses - Math.min(withdrawnFromBonuses, referralBonuses));
        const remainingToWithdraw = withdrawnFromBonuses - (referralBonuses - newReferralBonuses);
        const newRankingBonuses = Math.max(0, rankingBonuses - remainingToWithdraw);
        
        updateData.referralBonuses = newReferralBonuses.toString();
        updateData.rankingBonuses = newRankingBonuses.toString();
      }

      await storage.updateUser(user.id, updateData);

      console.log("Withdrawal request created successfully:", {
        newWithdrawableAmount: userBalance - withdrawAmount,
        newTotalAssets: parseFloat(user.totalAssets.toString()) - withdrawAmount
      });

      res.json({
        success: true,
        message: "Withdrawal processed successfully.",
        netAmount,
        fee,
        txHash: transferHashes.withdrawalTxHash,
        status: "completed"
      });

    } catch (error) {
      console.error("Error processing BSC withdrawal:", error);
      res.status(500).json({ error: "Failed to process withdrawal" });
    }
  });

  // Get transaction status
  app.get("/api/bsc/transaction/:txHash", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");

    try {
      const { txHash } = req.params;
      const txDetails = await bscService.verifyTransaction(txHash);
      
      res.json({
        hash: txHash,
        confirmed: txDetails.confirmed,
        blockNumber: txDetails.blockNumber,
        from: txDetails.from,
        to: txDetails.to,
        value: txDetails.value
      });
    } catch (error) {
      console.error("Error getting transaction status:", error);
      res.status(500).json({ error: "Failed to get transaction status" });
    }
  });

  // Monitor deposits endpoint (for admin use)
  app.post("/api/bsc/monitor-deposits", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    // This would be restricted to admin users
    try {
      const users = await storage.getAllUsers();
      const userAddresses = users
        .filter(user => user.bscWalletAddress)
        .map(user => user.bscWalletAddress!.toLowerCase());

      await bscService.monitorDeposits(userAddresses, async (tx) => {
        console.log("New deposit detected:", tx);
        // Handle automatic deposit processing here
      });

      res.json({ success: true, message: "Deposit monitoring started" });
    } catch (error) {
      console.error("Error starting deposit monitoring:", error);
      res.status(500).json({ error: "Failed to start monitoring" });
    }
  });
}
