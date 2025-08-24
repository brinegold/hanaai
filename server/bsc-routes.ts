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
      
      // Verify transaction is to user's wallet
      if (txDetails.to.toLowerCase() !== user.bscWalletAddress.toLowerCase()) {
        return res.status(400).json({ error: "Transaction not sent to your wallet" });
      }

      // Check if transaction already processed
      const existingTx = await storage.getTransactionByHash(txHash);
      if (existingTx) {
        return res.status(400).json({ error: "Transaction already processed" });
      }

      // Process deposit through smart contract
      const processTxHash = await bscService.processDeposit(
        user.bscWalletAddress,
        txHash,
        amount
      );

      // Calculate amounts (5% fee, 95% to user)
      const depositAmount = parseFloat(amount);
      const adminFee = depositAmount * 0.05;
      const userAmount = depositAmount * 0.95;

      // Create deposit transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Deposit",
        amount: userAmount.toString(),
        status: "Completed",
        txHash: processTxHash,
        fromAddress: txDetails.from,
        toAddress: user.bscWalletAddress,
        blockNumber: txDetails.blockNumber,
        confirmationStatus: "confirmed",
        reason: `BSC deposit - Original TX: ${txHash}`
      });

      // Create admin fee transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Admin Fee",
        amount: adminFee.toString(),
        status: "Completed",
        txHash: processTxHash,
        reason: `5% deposit fee for TX: ${txHash}`
      });

      // Update user balance
      await storage.updateUser(user.id, {
        totalAssets: (parseFloat(user.totalAssets.toString()) + userAmount).toString(),
        rechargeAmount: (parseFloat(user.rechargeAmount.toString()) + userAmount).toString()
      });

      res.json({
        success: true,
        message: "Deposit processed successfully",
        amount: userAmount,
        fee: adminFee,
        txHash: processTxHash
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

      // Calculate amounts (10% fee, 90% to user)
      const fee = withdrawAmount * 0.1;
      const netAmount = withdrawAmount * 0.9;

      // Process withdrawal through smart contract
      const txHash = await bscService.processWithdrawal(walletAddress, amount);

      // Create withdrawal transaction record
      await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal",
        amount: netAmount.toString(),
        status: "Completed",
        txHash: txHash,
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
        txHash: txHash,
        reason: `10% withdrawal fee`
      });

      // Update user balance
      await storage.updateUser(user.id, {
        withdrawableAmount: (userBalance - withdrawAmount).toString(),
        totalAssets: (parseFloat(user.totalAssets.toString()) - withdrawAmount).toString()
      });

      res.json({
        success: true,
        message: "Withdrawal processed successfully",
        netAmount,
        fee,
        txHash
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
