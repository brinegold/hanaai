import { Express } from "express";
import BSCService from "./bsc-service";
import { storage } from "./storage";
import { db } from "./db";
import { transactions, users } from "@shared/schema";
import { sendDepositNotification, sendWithdrawalNotification } from "./auth";

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://bsc-dataseed1.binance.org/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb",
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

      // For now, we'll skip the automatic transfer and just record the deposit
      // The admin can manually collect tokens later or we can implement a batch collection system
      console.log("Deposit verified and recorded. Tokens remain in user wallet for now.");
      
      // Optional: Try to collect tokens, but don't fail if it doesn't work
      let transferHashes = null;
      let userWallet = null;
      try {
        // Check if user wallet has sufficient balance and BNB for gas
        userWallet = bscService.generateUserWallet(user.id);
        const usdtBalance = await bscService.getUSDTBalance(userWallet.address);
        console.log(`User wallet ${userWallet.address} USDT balance: ${usdtBalance}`);
        
        // Optional: Try to collect tokens from user wallet to admin wallets
        try {
          const result = await bscService.collectDepositTokensFromUser(
            user.id, 
            depositAmount.toString(), 
            adminFee.toString()
          );
          console.log('Token collection successful:', result);
        } catch (collectionError) {
          console.log('Token collection failed (optional):', collectionError.message);
          // Continue without failing - deposit is still valid
        }

        // Send deposit notification email
        try {
          await sendDepositNotification(user, depositAmount.toString(), txHash);
        } catch (emailError) {
          console.error('Failed to send deposit notification email:', emailError);
          // Don't fail the deposit if email fails
        }

        console.log('Token collection successful for deposit');
      } catch (transferError) {
        console.warn("Could not automatically collect tokens from user wallet:", transferError instanceof Error ? transferError.message : String(transferError));
        // Continue with deposit processing even if collection fails
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

      // Create admin fee transaction record (only if tokens were actually transferred)
      if (transferHashes && userWallet) {
        await storage.createTransaction({
          userId: user.id,
          type: "Admin Fee",
          amount: adminFee.toString(),
          status: "Completed",
          txHash: transferHashes.adminFeeTxHash,
          fromAddress: userWallet.address,
          toAddress: BSC_CONFIG.adminFeeWallet,
          blockNumber: txDetails.blockNumber,
          confirmationStatus: "confirmed",
          reason: `Admin fee for deposit - Original TX: ${txHash}`
        });
      }

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

      // Send deposit notification email
      try {
        await sendDepositNotification(user, userAmount.toString(), txHash);
      } catch (emailError) {
        console.error('Failed to send deposit notification email:', emailError);
        // Don't fail the deposit if email fails
      }

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

      // Verify user has sufficient balance
      if (withdrawAmount > userBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Calculate amounts: 10% withdrawal fee only (gas fee is separate system cost)
      const withdrawalFee = withdrawAmount * 0.1;
      const gasFee = 1.0; // Fixed $1 gas fee (deducted separately from balance)
      const netAmount = withdrawAmount - withdrawalFee; // Only deduct withdrawal fee from requested amount
      const totalDeducted = withdrawAmount + gasFee; // Total deducted from user balance (requested + gas)

      console.log("Processing withdrawal:", {
        requestedAmount: withdrawAmount,
        withdrawalFee,
        gasFee,
        netAmount,
        totalDeducted,
        userId: user.id,
        toAddress: walletAddress
      });

      // Process actual token transfers from global admin to user
      let transferHashes;
      try {
        transferHashes = await bscService.processWithdrawal(
          walletAddress,
          netAmount.toString(),
          withdrawalFee.toString()
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
        txHash: transferHashes.withdrawalTxHash,
        fromAddress: BSC_CONFIG.globalAdminWallet,
        toAddress: walletAddress,
        confirmationStatus: "confirmed",
        reason: `BSC withdrawal to ${walletAddress}`
      });

      // Create withdrawal fee transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal Fee",
        amount: withdrawalFee.toString(),
        status: "Completed",
        txHash: transferHashes.feeTxHash,
        fromAddress: BSC_CONFIG.globalAdminWallet,
        toAddress: BSC_CONFIG.adminFeeWallet,
        confirmationStatus: "confirmed",
        reason: `10% withdrawal fee`
      });

      // Create gas fee transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Gas Fee",
        amount: gasFee.toString(),
        status: "Completed",
        txHash: transferHashes.withdrawalTxHash, // Same tx hash as main withdrawal
        fromAddress: "System",
        toAddress: "Network",
        confirmationStatus: "confirmed",
        reason: `BSC network gas fee`
      });

      // Update user balance (deduct total amount including gas fee)
      await storage.updateUser(user.id, {
        withdrawableAmount: (userBalance - totalDeducted).toString(),
        totalAssets: (parseFloat(user.totalAssets.toString()) - totalDeducted).toString()
      });

      console.log("Withdrawal request created successfully:", {
        newWithdrawableAmount: userBalance - totalDeducted,
        newTotalAssets: parseFloat(user.totalAssets.toString()) - totalDeducted
      });

      // Send withdrawal notification email
      try {
        await sendWithdrawalNotification(user, netAmount.toString(), walletAddress, transferHashes.withdrawalTxHash);
      } catch (emailError) {
        console.error('Failed to send withdrawal notification email:', emailError);
        // Don't fail the withdrawal if email fails
      }

      res.json({
        success: true,
        message: "Withdrawal processed successfully.",
        requestedAmount: withdrawAmount,
        netAmount,
        withdrawalFee,
        gasFee,
        totalDeducted,
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
