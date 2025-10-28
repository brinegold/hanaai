var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/bsc-service.ts
var bsc_service_exports = {};
__export(bsc_service_exports, {
  default: () => bsc_service_default
});
import Web3 from "web3";
import crypto from "crypto";
var BSCService, bsc_service_default;
var init_bsc_service = __esm({
  "server/bsc-service.ts"() {
    "use strict";
    BSCService = class {
      web3;
      contract;
      usdtContract;
      config;
      account;
      constructor(config) {
        this.config = config;
        const rpcUrl = "https://bsc-dataseed1.binance.org/";
        console.log("BSC Service initialized with RPC:", rpcUrl);
        this.web3 = new Web3(rpcUrl);
        this.testConnection();
        const privateKey = config.privateKey.startsWith("0x") ? config.privateKey : `0x${config.privateKey}`;
        this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        this.web3.eth.accounts.wallet.add(this.account);
        this.initializeContracts();
      }
      async testConnection() {
        try {
          const chainId = await this.web3.eth.getChainId();
          const blockNumber = await this.web3.eth.getBlockNumber();
          console.log(`Connected to BSC network - Chain ID: ${chainId}, Block: ${blockNumber}`);
          if (chainId !== BigInt(97)) {
            console.warn(`Warning: Expected BSC testnet (97) but connected to chain ${chainId}`);
          }
        } catch (error) {
          console.error("Failed to connect to BSC network:", error);
        }
      }
      initializeContracts() {
        const paymentProcessorABI = [
          {
            "inputs": [
              { "name": "userWallet", "type": "address" },
              { "name": "txHash", "type": "string" },
              { "name": "amount", "type": "uint256" }
            ],
            "name": "processDeposit",
            "outputs": [],
            "type": "function"
          },
          {
            "inputs": [
              { "name": "userWallet", "type": "address" },
              { "name": "amount", "type": "uint256" }
            ],
            "name": "processWithdrawal",
            "outputs": [],
            "type": "function"
          }
        ];
        const usdtABI = [
          {
            "inputs": [{ "name": "account", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "name": "", "type": "uint256" }],
            "type": "function"
          },
          {
            "inputs": [
              { "name": "to", "type": "address" },
              { "name": "amount", "type": "uint256" }
            ],
            "name": "transfer",
            "outputs": [{ "name": "", "type": "bool" }],
            "type": "function"
          }
        ];
        this.contract = new this.web3.eth.Contract(paymentProcessorABI, this.config.contractAddress);
        this.usdtContract = new this.web3.eth.Contract(usdtABI, this.config.usdtContractAddress);
      }
      // Generate unique wallet address for each user
      generateUserWallet(userId) {
        const seed = `${userId}-${process.env.WALLET_SEED || "default-seed"}`;
        const hash = crypto.createHash("sha256").update(seed).digest("hex");
        const account = this.web3.eth.accounts.privateKeyToAccount("0x" + hash);
        return {
          address: account.address,
          privateKey: account.privateKey
        };
      }
      // Verify transaction hash and get transaction details with USDT transfer amount extraction
      async verifyTransaction(txHash) {
        try {
          console.log(`Verifying transaction: ${txHash}`);
          console.log(`Using RPC: ${this.config.rpcUrl}`);
          if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
            throw new Error(`Invalid transaction hash format: ${txHash}. Must be 66 characters starting with 0x`);
          }
          const chainId = await this.web3.eth.getChainId();
          console.log(`Connected to chain ID: ${chainId}`);
          let transaction = null;
          let receipt = null;
          let retries = 0;
          const maxRetries = 10;
          while (retries < maxRetries) {
            try {
              console.log(`Attempt ${retries + 1}/${maxRetries} - Looking for transaction ${txHash}`);
              transaction = await this.web3.eth.getTransaction(txHash);
              if (transaction) {
                console.log(`Transaction found:`, {
                  hash: transaction.hash,
                  from: transaction.from,
                  to: transaction.to,
                  value: transaction.value?.toString(),
                  blockNumber: transaction.blockNumber?.toString()
                });
                receipt = await this.web3.eth.getTransactionReceipt(txHash);
                if (receipt) {
                  console.log(`Receipt found: Block ${receipt.blockNumber}, Status: ${receipt.status}`);
                  break;
                } else {
                  console.log(`Transaction exists but no receipt yet (pending)`);
                  await new Promise((resolve) => setTimeout(resolve, 5e3));
                  retries++;
                  continue;
                }
              } else {
                console.log(`Transaction not found, waiting...`);
                await new Promise((resolve) => setTimeout(resolve, 3e3));
                retries++;
                continue;
              }
            } catch (error) {
              console.error(`Error on attempt ${retries + 1}:`, error.message);
              if (retries < maxRetries - 1) {
                await new Promise((resolve) => setTimeout(resolve, 2e3));
                retries++;
                continue;
              }
              throw error;
            }
          }
          if (!transaction) {
            throw new Error(`Transaction ${txHash} not found after ${maxRetries} attempts. Please verify:
1. Transaction hash is correct
2. Transaction is on BSC testnet (Chain ID 97)
3. Transaction has been broadcasted to the network`);
          }
          if (!receipt) {
            throw new Error(`Transaction ${txHash} found but no receipt after ${maxRetries} attempts. Transaction may still be pending.`);
          }
          if (!receipt.status) {
            throw new Error("Transaction failed on blockchain");
          }
          let usdtTransferAmount = "0";
          let actualRecipient = transaction.to;
          if (transaction.to?.toLowerCase() === this.config.usdtContractAddress.toLowerCase()) {
            const transferAmount = this.extractUSDTTransferFromLogs(receipt.logs);
            if (transferAmount) {
              usdtTransferAmount = transferAmount.amount;
              actualRecipient = transferAmount.to;
              console.log(`USDT Transfer detected: ${usdtTransferAmount} USDT to ${actualRecipient}`);
            }
          } else if (transaction.value && transaction.value !== "0") {
            usdtTransferAmount = this.web3.utils.fromWei(transaction.value.toString(), "ether");
            console.log(`BNB Transfer detected: ${usdtTransferAmount} BNB`);
          }
          return {
            from: transaction.from,
            to: transaction.to,
            actualRecipient,
            // The actual recipient of the tokens
            value: transaction.value?.toString(),
            usdtTransferAmount,
            // The actual USDT amount transferred
            blockNumber: receipt.blockNumber?.toString(),
            confirmed: true,
            gasUsed: receipt.gasUsed?.toString(),
            status: receipt.status,
            logs: receipt.logs
          };
        } catch (error) {
          console.error("Error verifying transaction:", error);
          throw error;
        }
      }
      // Extract USDT transfer details from transaction logs
      extractUSDTTransferFromLogs(logs) {
        try {
          const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          for (const log2 of logs) {
            if (log2.topics && log2.topics[0] === transferEventSignature && log2.topics.length >= 3) {
              const fromAddress = "0x" + log2.topics[1].slice(26);
              const toAddress = "0x" + log2.topics[2].slice(26);
              const amount = this.web3.utils.fromWei(log2.data, "ether");
              console.log(`Transfer event found: ${amount} USDT from ${fromAddress} to ${toAddress}`);
              if (parseFloat(amount) < 5) {
                console.log(`Transfer amount ${amount} USDT is below minimum requirement of 5 USDT`);
                throw new Error(`Minimum deposit amount is 5 USDT. Transaction amount: ${amount} USDT`);
              }
              return {
                amount,
                to: toAddress,
                from: fromAddress
              };
            }
          }
          console.log("No USDT transfer event found in transaction logs");
          return null;
        } catch (error) {
          console.error("Error extracting USDT transfer from logs:", error);
          throw error;
        }
      }
      // Process deposit through smart contract
      async processDeposit(userWallet, txHash, amount) {
        try {
          const amountWei = this.web3.utils.toWei(amount, "ether");
          const tx = await this.contract.methods.processDeposit(
            userWallet,
            txHash,
            amountWei
          ).send({
            from: this.account.address,
            gas: "200000"
          });
          return tx.transactionHash;
        } catch (error) {
          console.error("Error processing deposit:", error);
          throw error;
        }
      }
      // Get USDT balance of an address
      async getUSDTBalance(address) {
        try {
          const balance = await this.usdtContract.methods.balanceOf(address).call();
          return this.web3.utils.fromWei(balance, "ether");
        } catch (error) {
          console.error("Error getting USDT balance:", error);
          throw error;
        }
      }
      // Get BNB balance of an address
      async getBNBBalance(address) {
        try {
          const balance = await this.web3.eth.getBalance(address);
          return this.web3.utils.fromWei(balance, "ether");
        } catch (error) {
          console.error("Error getting BNB balance:", error);
          throw error;
        }
      }
      // Send BNB for gas fees to user wallet
      async fundUserWalletForGas(userAddress, bnbAmount = "0.001") {
        try {
          console.log(`Funding user wallet ${userAddress} with ${bnbAmount} BNB for gas`);
          const adminPrivateKey = this.config.privateKey.startsWith("0x") ? this.config.privateKey : `0x${this.config.privateKey}`;
          const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
          const adminBalance = await this.getBNBBalance(adminAccount.address);
          console.log(`Admin BNB balance: ${adminBalance}`);
          if (parseFloat(adminBalance) < parseFloat(bnbAmount)) {
            throw new Error(`Insufficient BNB in admin wallet. Required: ${bnbAmount}, Available: ${adminBalance}`);
          }
          const gasPrice = await this.web3.eth.getGasPrice();
          const nonce = await this.web3.eth.getTransactionCount(adminAccount.address, "pending");
          const txData = {
            from: adminAccount.address,
            to: userAddress,
            value: this.web3.utils.toWei(bnbAmount, "ether"),
            gas: "21000",
            gasPrice: gasPrice.toString(),
            nonce: Number(nonce)
          };
          const signedTx = await adminAccount.signTransaction(txData);
          const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
          console.log(`BNB transfer successful: ${bnbAmount} BNB to ${userAddress}`);
          return typeof receipt.transactionHash === "string" ? receipt.transactionHash : this.web3.utils.bytesToHex(receipt.transactionHash);
        } catch (error) {
          console.error("Error funding user wallet:", error);
          throw error;
        }
      }
      // Transfer USDT tokens from one address to another
      async transferUSDT(fromPrivateKey, toAddress, amount, nonce) {
        try {
          const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
          const amountWei = this.web3.utils.toWei(amount, "ether");
          const transferTx = this.usdtContract.methods.transfer(toAddress, amountWei);
          const gasEstimate = await transferTx.estimateGas({ from: fromAccount.address });
          const gasPrice = await this.web3.eth.getGasPrice();
          const txNonce = nonce !== void 0 ? nonce : await this.web3.eth.getTransactionCount(fromAccount.address, "pending");
          console.log(`Using nonce ${txNonce} for transfer to ${toAddress}`);
          const txData = {
            from: fromAccount.address,
            to: this.config.usdtContractAddress,
            data: transferTx.encodeABI(),
            gas: gasEstimate.toString(),
            gasPrice: gasPrice.toString(),
            nonce: txNonce
          };
          const signedTx = await fromAccount.signTransaction(txData);
          const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
          const txHash = typeof receipt.transactionHash === "string" ? receipt.transactionHash : this.web3.utils.bytesToHex(receipt.transactionHash);
          console.log(`USDT transfer successful: ${amount} USDT from ${fromAccount.address} to ${toAddress}`);
          console.log(`Transaction hash: ${txHash}`);
          return txHash;
        } catch (error) {
          console.error("Error transferring USDT:", error);
          throw error;
        }
      }
      // Collect deposited tokens from user wallet and distribute to admin wallets
      async collectDepositTokensFromUser(userId, depositAmount, adminFee) {
        try {
          console.log(`Collecting deposit tokens from user ${userId}: ${depositAmount} total, ${adminFee} fee`);
          const userWallet = this.generateUserWallet(userId);
          const userPrivateKey = userWallet.privateKey;
          const userBalance = await this.getUSDTBalance(userWallet.address);
          console.log(`User ${userId} USDT balance: ${userBalance}`);
          if (parseFloat(userBalance) < parseFloat(depositAmount)) {
            throw new Error(`Insufficient USDT balance in user wallet. Required: ${depositAmount}, Available: ${userBalance}`);
          }
          const bnbBalance = await this.getBNBBalance(userWallet.address);
          console.log(`User ${userId} BNB balance: ${bnbBalance}`);
          if (parseFloat(bnbBalance) < 1e-3) {
            console.log(`User wallet has insufficient BNB for gas fees. Funding with 0.001 BNB...`);
            await this.fundUserWalletForGas(userWallet.address, "0.001");
            console.log(`User wallet funded with BNB for gas fees`);
          }
          const startingNonce = await this.web3.eth.getTransactionCount(userWallet.address, "pending");
          console.log(`User ${userId} starting nonce: ${startingNonce}`);
          const nonceNumber = Number(startingNonce);
          const adminFeeTxHash = await this.transferUSDT(
            userPrivateKey,
            this.config.adminFeeWallet,
            adminFee,
            nonceNumber
          );
          const remainingAmount = (parseFloat(depositAmount) - parseFloat(adminFee)).toString();
          const globalAdminTxHash = await this.transferUSDT(
            userPrivateKey,
            this.config.globalAdminWallet,
            remainingAmount,
            nonceNumber + 1
          );
          return {
            adminFeeTxHash,
            globalAdminTxHash
          };
        } catch (error) {
          console.error("Error collecting deposit tokens from user:", error);
          throw error;
        }
      }
      // Legacy method - kept for backward compatibility
      async collectDepositTokens(depositAmount, adminFee) {
        try {
          console.log(`Collecting deposit tokens: ${depositAmount} total, ${adminFee} fee`);
          const backendPrivateKey = this.config.privateKey.startsWith("0x") ? this.config.privateKey : `0x${this.config.privateKey}`;
          const backendAccount = this.web3.eth.accounts.privateKeyToAccount(backendPrivateKey);
          const startingNonce = await this.web3.eth.getTransactionCount(backendAccount.address, "pending");
          console.log(`Backend starting nonce: ${startingNonce}`);
          const nonceNumber = Number(startingNonce);
          const adminFeeTxHash = await this.transferUSDT(
            backendPrivateKey,
            this.config.adminFeeWallet,
            adminFee,
            nonceNumber
          );
          const remainingAmount = (parseFloat(depositAmount) - parseFloat(adminFee)).toString();
          const globalAdminTxHash = await this.transferUSDT(
            backendPrivateKey,
            this.config.globalAdminWallet,
            remainingAmount,
            nonceNumber + 1
          );
          return {
            adminFeeTxHash,
            globalAdminTxHash
          };
        } catch (error) {
          console.error("Error collecting deposit tokens:", error);
          throw error;
        }
      }
      // Get user's private key from their wallet address
      getUserPrivateKey(walletAddress) {
        return this.config.privateKey.startsWith("0x") ? this.config.privateKey : `0x${this.config.privateKey}`;
      }
      // Process withdrawal by transferring tokens from global admin to user wallet
      async processWithdrawal(userWalletAddress, withdrawAmount, fee) {
        try {
          console.log(`Processing withdrawal: ${withdrawAmount} total, ${fee} fee to ${userWalletAddress}`);
          console.log(`Global admin wallet: ${this.config.globalAdminWallet}`);
          const adminPrivateKey = this.config.privateKey.startsWith("0x") ? this.config.privateKey : `0x${this.config.privateKey}`;
          const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
          console.log(`Admin account address: ${adminAccount.address}`);
          console.log(`Expected global admin: ${this.config.globalAdminWallet}`);
          if (adminAccount.address.toLowerCase() !== this.config.globalAdminWallet.toLowerCase()) {
            console.warn(`Private key does not match global admin wallet. Key address: ${adminAccount.address}, Expected: ${this.config.globalAdminWallet}`);
          }
          const startingNonce = await this.web3.eth.getTransactionCount(adminAccount.address, "pending");
          console.log(`Admin starting nonce: ${startingNonce}`);
          const nonceNumber = Number(startingNonce);
          const withdrawalTxHash = await this.transferUSDT(
            adminPrivateKey,
            userWalletAddress,
            withdrawAmount,
            nonceNumber
          );
          const feeTxHash = await this.transferUSDT(
            adminPrivateKey,
            this.config.adminFeeWallet,
            fee,
            nonceNumber + 1
          );
          return {
            withdrawalTxHash,
            feeTxHash
          };
        } catch (error) {
          console.error("Error processing withdrawal:", error);
          throw error;
        }
      }
      // Collect all USDT tokens from a user wallet to admin wallet
      async collectAllUSDTFromUser(userId) {
        try {
          const userWallet = this.generateUserWallet(userId);
          const balance = await this.getUSDTBalance(userWallet.address);
          if (parseFloat(balance) <= 0) {
            console.log(`No USDT balance found for user ${userId}`);
            return null;
          }
          console.log(`Collecting ${balance} USDT from user ${userId} wallet: ${userWallet.address}`);
          const bnbBalance = await this.getBNBBalance(userWallet.address);
          if (parseFloat(bnbBalance) < 1e-3) {
            console.log(`Funding user wallet with BNB for gas...`);
            await this.fundUserWalletForGas(userWallet.address, "0.001");
          }
          const txHash = await this.transferUSDT(
            userWallet.privateKey,
            this.config.globalAdminWallet,
            balance
          );
          return { txHash, amount: balance };
        } catch (error) {
          console.error(`Error collecting USDT from user ${userId}:`, error);
          throw error;
        }
      }
      // Batch collect USDT from multiple user wallets
      async batchCollectUSDT(userIds) {
        const results = [];
        for (const userId of userIds) {
          try {
            const result = await this.collectAllUSDTFromUser(userId);
            results.push({ userId, result });
            await new Promise((resolve) => setTimeout(resolve, 2e3));
          } catch (error) {
            console.error(`Failed to collect from user ${userId}:`, error);
            results.push({ userId, result: null });
          }
        }
        return results;
      }
      // Transfer BNB from one address to another
      async transferBNB(fromPrivateKey, toAddress, amount, nonce) {
        try {
          const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
          const amountWei = this.web3.utils.toWei(amount, "ether");
          const gasPrice = await this.web3.eth.getGasPrice();
          const txNonce = nonce !== void 0 ? nonce : await this.web3.eth.getTransactionCount(fromAccount.address, "pending");
          console.log(`Using nonce ${txNonce} for BNB transfer to ${toAddress}`);
          const txData = {
            from: fromAccount.address,
            to: toAddress,
            value: amountWei,
            gas: "21000",
            gasPrice: gasPrice.toString(),
            nonce: txNonce
          };
          const signedTx = await fromAccount.signTransaction(txData);
          const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
          console.log(`BNB transfer successful: ${amount} BNB from ${fromAccount.address} to ${toAddress}`);
          console.log(`Transaction hash: ${receipt.transactionHash}`);
          return receipt.transactionHash.toString();
        } catch (error) {
          console.error("Error transferring BNB:", error);
          throw error;
        }
      }
      // Collect all BNB from a user wallet to admin wallet
      async collectAllBNBFromUser(userId) {
        try {
          const userWallet = this.generateUserWallet(userId);
          const balance = await this.getBNBBalance(userWallet.address);
          if (parseFloat(balance) <= 1e-3) {
            console.log(`Insufficient BNB balance for user ${userId} (${balance} BNB)`);
            return null;
          }
          const collectAmount = (parseFloat(balance) - 1e-3).toString();
          if (parseFloat(collectAmount) <= 0) {
            console.log(`No collectible BNB for user ${userId} after reserving gas`);
            return null;
          }
          console.log(`Collecting ${collectAmount} BNB from user ${userId} wallet: ${userWallet.address}`);
          const txHash = await this.transferBNB(
            userWallet.privateKey,
            this.config.globalAdminWallet,
            collectAmount
          );
          return { txHash, amount: collectAmount };
        } catch (error) {
          console.error(`Error collecting BNB from user ${userId}:`, error);
          throw error;
        }
      }
      // Batch collect BNB from multiple user wallets
      async batchCollectBNB(userIds) {
        const results = [];
        for (const userId of userIds) {
          try {
            const result = await this.collectAllBNBFromUser(userId);
            results.push({ userId, result });
            await new Promise((resolve) => setTimeout(resolve, 2e3));
          } catch (error) {
            console.error(`Failed to collect BNB from user ${userId}:`, error);
            results.push({ userId, result: null });
          }
        }
        return results;
      }
      // Monitor blockchain for new transactions to user wallets
      async monitorDeposits(userAddresses, callback) {
        const subscription = await this.web3.eth.subscribe("newBlockHeaders");
        subscription.on("data", async (blockHeader) => {
          try {
            const block = await this.web3.eth.getBlock(blockHeader.number, true);
            if (block.transactions) {
              for (const tx of block.transactions) {
                if (typeof tx !== "string" && tx.to && userAddresses.includes(tx.to.toLowerCase())) {
                  callback({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    blockNumber: block.number
                  });
                }
              }
            }
          } catch (error) {
            console.error("Error monitoring deposits:", error);
          }
        });
        return subscription;
      }
    };
    bsc_service_default = BSCService;
  }
});

// server/index.ts
import "dotenv/config";
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bscMonitoring: () => bscMonitoring,
  bscTransactions: () => bscTransactions,
  insertInvestmentSchema: () => insertInvestmentSchema,
  insertInviteCodeSchema: () => insertInviteCodeSchema,
  insertRankSchema: () => insertRankSchema,
  insertReferralSchema: () => insertReferralSchema,
  insertTransactionSchema: () => insertTransactionSchema,
  insertUserRankAchievementSchema: () => insertUserRankAchievementSchema,
  insertUserSchema: () => insertUserSchema,
  investments: () => investments,
  investmentsRelations: () => investmentsRelations,
  inviteCodes: () => inviteCodes,
  inviteCodesRelations: () => inviteCodesRelations,
  notifications: () => notifications,
  ranks: () => ranks,
  referrals: () => referrals,
  referralsRelations: () => referralsRelations,
  transactionHistory: () => transactionHistory2,
  transactions: () => transactions,
  transactionsRelations: () => transactionsRelations,
  userRankAchievements: () => userRankAchievements,
  users: () => users,
  usersRelations: () => usersRelations
});
import {
  pgTable,
  text,
  serial,
  numeric,
  timestamp,
  boolean,
  integer
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  telegram: text("telegram"),
  password: text("password").notNull(),
  securityPassword: text("security_password"),
  inviteCode: text("invite_code"),
  referralCode: text("referral_code").notNull().unique(),
  currentRank: text("current_rank").default("none").notNull(),
  totalVolumeGenerated: numeric("total_volume_generated", { precision: 10, scale: 2 }).default("0").notNull(),
  totalAssets: numeric("total_assets", { precision: 10, scale: 2 }).default("0").notNull(),
  quantitativeAssets: numeric("quantitative_assets", {
    precision: 10,
    scale: 2
  }).default("0").notNull(),
  profitAssets: numeric("profit_assets", { precision: 10, scale: 2 }).default("0").notNull(),
  rechargeAmount: numeric("recharge_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  todayEarnings: numeric("today_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
  yesterdayEarnings: numeric("yesterday_earnings", { precision: 10, scale: 2 }).default("0").notNull(),
  commissionToday: numeric("commission_today", { precision: 10, scale: 2 }).default("0").notNull(),
  commissionAssets: numeric("commission_assets", { precision: 10, scale: 2 }).default("0").notNull(),
  weeklyCommissionEarned: numeric("weekly_commission_earned", { precision: 10, scale: 2 }).default("0").notNull(),
  weeklySalaryPaid: numeric("weekly_salary_paid", { precision: 10, scale: 2 }).default("0").notNull(),
  lastSalaryDate: timestamp("last_salary_date"),
  withdrawableAmount: numeric("withdrawable_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  lastInvestmentDate: timestamp("last_investment_date"),
  referrerId: integer("referrer_id"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  isCountryRep: boolean("is_country_rep").default(false).notNull(),
  countryRepStatus: text("country_rep_status").default("none"),
  // none, pending, approved
  bscWalletAddress: text("bsc_wallet_address"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var inviteCodes = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdById: serial("created_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: serial("referrer_id").notNull(),
  referredId: serial("referred_id").notNull(),
  level: text("level").notNull(),
  // Level 1, 2, or 3
  commission: numeric("commission", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  plan: text("plan").notNull(),
  // Basic, Premium, or VIP
  dailyRate: numeric("daily_rate", { precision: 5, scale: 2 }).notNull(),
  status: text("status").notNull(),
  // Active or Completed
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date")
});
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  type: text("type").notNull(),
  // Deposit, Withdrawal, Profit, Commission, Salary
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(),
  // Pending, Processing, Completed, Failed
  reason: text("reason"),
  // For failed transactions
  network: text("network"),
  // TRON, BSC etc
  address: text("address"),
  // Wallet address
  fee: numeric("fee", { precision: 10, scale: 2 }),
  // Transaction fee
  processingTime: timestamp("processing_time"),
  // When processing started
  completionTime: timestamp("completion_time"),
  // When transaction completed/failed
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  // "system", "transaction"
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var usersRelations = relations(users, ({ one, many }) => ({
  referrer: one(users, {
    fields: [users.referrerId],
    references: [users.id]
  }),
  referrals: many(referrals, { relationName: "referrer_referrals" }),
  investments: many(investments),
  transactions: many(transactions),
  createdInviteCodes: many(inviteCodes, {
    relationName: "created_invite_codes"
  }),
  usedInviteCode: one(inviteCodes, {
    fields: [users.inviteCode],
    references: [inviteCodes.code]
  })
}));
var referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referrer_referrals"
  }),
  referred: one(users, {
    fields: [referrals.referredId],
    references: [users.id]
  })
}));
var investmentsRelations = relations(investments, ({ one }) => ({
  user: one(users, {
    fields: [investments.userId],
    references: [users.id]
  })
}));
var transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id]
  })
}));
var inviteCodesRelations = relations(inviteCodes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [inviteCodes.createdById],
    references: [users.id],
    relationName: "created_invite_codes"
  }),
  users: many(users)
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  referralCode: true,
  totalAssets: true,
  quantitativeAssets: true,
  profitAssets: true,
  rechargeAmount: true,
  todayEarnings: true,
  yesterdayEarnings: true,
  commissionToday: true,
  commissionAssets: true,
  createdAt: true,
  referrerId: true,
  resetToken: true,
  resetTokenExpiry: true,
  updatedAt: true
}).extend({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  inviteCode: z.string().min(6).max(10).optional()
});
var insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true
});
var insertInvestmentSchema = createInsertSchema(investments).omit({
  id: true,
  userId: true,
  startDate: true,
  endDate: true,
  status: true
}).extend({
  amount: z.number().min(5).max(5e5),
  plan: z.string(),
  dailyRate: z.number()
});
var insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  userId: true,
  createdAt: true
});
var insertInviteCodeSchema = createInsertSchema(inviteCodes).omit({
  id: true,
  createdAt: true
});
var transactionHistory2 = pgTable("transaction_history", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  details: text("details")
});
var ranks = pgTable("ranks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  requiredVolume: numeric("required_volume", { precision: 12, scale: 2 }).notNull(),
  incentiveAmount: numeric("incentive_amount", { precision: 10, scale: 2 }).notNull(),
  incentiveDescription: text("incentive_description").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var userRankAchievements = pgTable("user_rank_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  rankName: text("rank_name").notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  incentivePaid: boolean("incentive_paid").default(false).notNull(),
  incentiveAmount: numeric("incentive_amount", { precision: 10, scale: 2 }).notNull(),
  volumeAtAchievement: numeric("volume_at_achievement", { precision: 12, scale: 2 }).notNull()
});
var bscTransactions = pgTable("bsc_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  transactionHash: text("transaction_hash").notNull().unique(),
  blockNumber: integer("block_number"),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  type: text("type").notNull(),
  // "deposit" or "withdrawal"
  status: text("status").default("pending").notNull(),
  // "pending", "confirmed", "failed"
  processed: boolean("processed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at")
});
var bscMonitoring = pgTable("bsc_monitoring", {
  id: serial("id").primaryKey(),
  lastProcessedBlock: integer("last_processed_block").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertRankSchema = createInsertSchema(ranks).omit({
  id: true,
  createdAt: true
});
var insertUserRankAchievementSchema = createInsertSchema(userRankAchievements).omit({
  id: true,
  achievedAt: true
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, desc, gte, lte } from "drizzle-orm";
var storage = {
  async getPendingTransactions() {
    const pendingTransactions = await db.select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      status: transactions.status,
      createdAt: transactions.createdAt,
      userId: transactions.userId,
      username: users.username,
      address: transactions.address,
      txHash: transactions.txHash
    }).from(transactions).where(eq(transactions.status, "Pending")).innerJoin(users, eq(users.id, transactions.userId));
    return pendingTransactions;
  },
  async getTransaction(id) {
    const result = await db.select().from(transactions).where(eq(transactions.id, id));
    return result[0];
  },
  async updateTransaction(id, data) {
    const result = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
    return result[0];
  },
  sessionStore: null,
  async createUser(userData) {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  },
  async getUserById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  },
  async getUserByEmail(email) {
    if (!email) return null;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },
  async getUserByResetToken(token) {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  },
  async getUserByPhone(phone) {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  },
  async getUserByTelegram(telegram) {
    const [user] = await db.select().from(users).where(eq(users.telegram, telegram));
    return user;
  },
  async getUser(id) {
    return this.getUserById(id);
  },
  async updateUser(id, updates) {
    const [updatedUser] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updatedUser;
  },
  async createInvestment(investmentData) {
    const [investment] = await db.insert(investments).values(investmentData).returning();
    return investment;
  },
  async getInvestmentsByUserId(userId) {
    return db.select().from(investments).where(eq(investments.userId, userId));
  },
  async createTransaction(transactionData) {
    const [transaction] = await db.insert(transactions).values(transactionData).returning();
    return transaction;
  },
  async getTransactionsByUserId(userId, filter = {}) {
    const conditions = [eq(transactions.userId, userId)];
    if (filter.type) {
      conditions.push(eq(transactions.type, filter.type));
    }
    if (filter.status) {
      conditions.push(eq(transactions.status, filter.status));
    }
    if (filter.createdAt?.gte) {
      conditions.push(gte(transactions.createdAt, filter.createdAt.gte));
    }
    if (filter.createdAt?.lte) {
      conditions.push(lte(transactions.createdAt, filter.createdAt.lte));
    }
    return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt));
  },
  async getTransactionByHash(txHash) {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.txHash, txHash));
    return transaction;
  },
  async createInviteCode(codeData) {
    const [code] = await db.insert(inviteCodes).values(codeData).returning();
    return code;
  },
  async getInviteCode(code) {
    const [inviteCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));
    return inviteCode;
  },
  async useInviteCode(code, userId) {
    const inviteCode = await this.getInviteCode(code);
    return !!inviteCode;
  },
  async createWelcomeInviteCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    return this.createInviteCode({ code, createdById: 1 });
  },
  async getReferralsByReferrerId(referrerId) {
    return db.select().from(referrals).where(eq(referrals.referrerId, referrerId));
  },
  async getReferralsByReferredId(referredId) {
    return db.select().from(referrals).where(eq(referrals.referredId, referredId));
  },
  async createReferral(referralData) {
    const [referral] = await db.insert(referrals).values(referralData).returning();
    return referral;
  },
  async updateReferral(id, data) {
    const [referral] = await db.update(referrals).set(data).where(eq(referrals.id, id)).returning();
    return referral;
  },
  generateReferralCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },
  async getAllUsers() {
    return db.select().from(users);
  },
  async getAllInvestments() {
    return db.select().from(investments);
  },
  async getAllTransactions() {
    return db.select().from(transactions);
  },
  async deleteUser(id) {
    await db.delete(transactions).where(eq(transactions.userId, id));
    await db.delete(investments).where(eq(investments.userId, id));
    await db.delete(referrals).where(eq(referrals.referrerId, id));
    await db.delete(referrals).where(eq(referrals.referredId, id));
    await db.delete(notifications).where(eq(notifications.userId, id));
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result[0];
  },
  async createTransactionHistory(history) {
    const newHistory = await db.insert(transactionHistory2).values({
      transactionId: history.transactionId,
      status: history.status,
      timestamp: history.timestamp || /* @__PURE__ */ new Date(),
      details: history.details
    }).returning();
    return newHistory[0];
  },
  async createNotification(notificationData) {
    const [notification] = await db.insert(notifications).values(notificationData).returning();
    return notification;
  }
};
storage.createWelcomeInviteCode().catch((err) => {
  console.error("Failed to create welcome invite code:", err);
});

// server/auth.ts
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
async function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Boolean(true),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}
async function sendWelcomeEmail(user) {
  try {
    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Welcome to Nebrix AI Trading!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
      </div>
    <!-- Header -->
    <h1 style="color: #2c3e50; text-align: center;">Welcome to Nebrix Ai Trading.
        !</h1>
  
    <!-- Greeting -->
    <p style="color: #333; font-size: 16px;">Hello <strong>${user.username || user.email}</strong>,</p>
  
    <!-- Message Body -->
    <p style="color: #333; font-size: 16px;">Thank you for registering with us. We're excited to have you on board!</p>
    <p style="color: #333; font-size: 16px;">Here are some things you can do:</p>
  
    <!-- List of Actions -->
    <ul style="color: #333; font-size: 16px; padding-left: 20px; line-height: 1.6;">
      <li>\u{1F4B0} Make your first deposit and start investing</li>
      <li>\u{1F465} Generate your referral code and invite friends</li>
      <li>\u{1F4E2} Join our Telegram Channel: <a href="https://t.me/Nebrixdex" style="color: #2980b9; text-decoration: none;">Telegram</a></li>
      <li>\u{1F4E2} Follow us on X(Twitter): <a href="https://x.com/NebrixCoin"style="color: #2980b9; text-decoration: none;">X</a></li>
    </ul>
  
    <!-- Support -->
    <p style="color: #333; font-size: 16px;">If you have any questions or need assistance, please don't hesitate to contact our <a href="mailto:support@nebrix.dev" style="color: #2980b9; text-decoration: none;">Support Team</a>.</p>
  
    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated message, please do not reply directly to this email.</p>
    </div>
  </div>
  
  
      `
    });
    console.log(`Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
async function createMultiTierReferrals(directReferrerId, newUserId, newUsername) {
  try {
    await storage.createReferral({
      referrerId: directReferrerId,
      referredId: newUserId,
      level: "1",
      commission: "0"
    });
    await storage.createNotification({
      userId: directReferrerId,
      type: "referral",
      message: `New user ${newUsername} has joined using your referral code!`,
      isRead: false
    });
    const directReferrer = await storage.getUser(directReferrerId);
    if (!directReferrer || !directReferrer.referrerId) return;
    await storage.createReferral({
      referrerId: directReferrer.referrerId,
      referredId: newUserId,
      level: "2",
      commission: "0"
    });
    const tier2Referrer = await storage.getUser(directReferrer.referrerId);
    if (!tier2Referrer || !tier2Referrer.referrerId) return;
    await storage.createReferral({
      referrerId: tier2Referrer.referrerId,
      referredId: newUserId,
      level: "3",
      commission: "0"
    });
    const tier3Referrer = await storage.getUser(tier2Referrer.referrerId);
    if (!tier3Referrer || !tier3Referrer.referrerId) return;
    await storage.createReferral({
      referrerId: tier3Referrer.referrerId,
      referredId: newUserId,
      level: "4",
      commission: "0"
    });
  } catch (error) {
    console.error("Error creating multi-tier referrals:", error);
  }
}
async function sendDepositNotification(user, amount, txHash) {
  try {
    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: "Deposit Successful - Nebrix AI Trading",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
          </div>
          <h1 style="color: #27ae60; text-align: center;">Deposit Successful!</h1>
          <p style="color: #333; font-size: 16px;">Hello <strong>${user.username || user.email}</strong>,</p>
          <p style="color: #333; font-size: 16px;">Your deposit has been successfully processed:</p>
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${parseFloat(amount).toFixed(2)} USDT</p>
            <p style="margin: 5px 0;"><strong>Transaction Hash:</strong> ${txHash}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Completed</p>
          </div>
          <p style="color: #333; font-size: 16px;">Your funds are now available in your account and ready for trading.</p>
        </div>
      `
    });
  } catch (error) {
    console.error("Error sending deposit notification:", error);
  }
}
async function sendReferralNotification(referrer, newUser) {
  try {
    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: referrer.email,
      subject: "New Referral Joined - Nebrix AI Trading",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://raw.githubusercontent.com/areebasiddiqi/nebrix/refs/heads/main/public/logo.jpg" alt="Nebrix" style="max-width: 200px; height: auto;" />
          </div>
          <h1 style="color: #3498db; text-align: center;">New Referral Joined!</h1>
          <p style="color: #333; font-size: 16px;">Hello <strong>${referrer.username || referrer.email}</strong>,</p>
          <p style="color: #333; font-size: 16px;">Great news! Someone has joined using your referral link:</p>
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>New User:</strong> ${newUser.username || newUser.email}</p>
            <p style="margin: 5px 0;"><strong>Joined:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>
          </div>
          <p style="color: #333; font-size: 16px;">You'll earn commission when they make their first deposit. Keep sharing your referral link to earn more!</p>
        </div>
      `
    });
  } catch (error) {
    console.error("Error sending referral notification:", error);
  }
}
function setupAuth(app2) {
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || randomUUID(),
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    "local-username",
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          return done(null, false, { message: "Invalid username or password" });
        }
        if (user.isBanned) {
          return done(null, false, { message: "You have been banned please contact support: Support@nebrix.dev" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );
  passport.use(
    "local-email",
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !await comparePasswords(password, user.password)) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (user.isBanned) {
            return done(null, false, {
              message: "You have been banned please contact support: Support@nebrix.dev"
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  passport.use(
    "local-phone",
    new LocalStrategy(
      { usernameField: "phone" },
      async (phone, password, done) => {
        try {
          const user = await storage.getUserByPhone(phone);
          if (!user || !await comparePasswords(password, user.password)) {
            return done(null, false, { message: "Invalid phone or password" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  passport.use(
    "local-telegram",
    new LocalStrategy(
      { usernameField: "telegram" },
      async (telegram, password, done) => {
        try {
          const user = await storage.getUserByTelegram(telegram);
          if (!user || !await comparePasswords(password, user.password)) {
            return done(null, false, {
              message: "Invalid Telegram ID or password"
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      let inviteCode = null;
      if (userData.inviteCode) {
        inviteCode = await storage.getInviteCode(userData.inviteCode);
        if (!inviteCode) {
          return res.status(400).json({ message: "Invalid invite code" });
        }
      }
      if (userData.username) {
        const existingUsername = await storage.getUserByUsername(
          userData.username
        );
        if (existingUsername) {
          return res.status(400).json({ message: "Username already exists" });
        }
      }
      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail) {
          return res.status(400).json({ message: "Email already exists" });
        }
      }
      if (userData.phone) {
        const existingPhone = await storage.getUserByPhone(userData.phone);
        if (existingPhone) {
          return res.status(400).json({ message: "Phone already exists" });
        }
      }
      if (userData.telegram) {
        const existingTelegram = await storage.getUserByTelegram(
          userData.telegram
        );
        if (existingTelegram) {
          return res.status(400).json({ message: "Telegram ID already exists" });
        }
      }
      const hashedPassword = await hashPassword(userData.password);
      const newInviteCode = storage.generateReferralCode();
      const userCreateData = {
        ...userData,
        password: hashedPassword,
        referralCode: newInviteCode,
        inviteCode: userData.inviteCode || null
        // Store the invite code used or null if none
      };
      if (inviteCode && inviteCode.createdById && inviteCode.createdById !== null) {
        userCreateData.referrerId = inviteCode.createdById;
      }
      const user = await storage.createUser(userCreateData);
      await sendWelcomeEmail(user);
      await storage.createInviteCode({
        code: newInviteCode,
        createdById: user.id
      });
      if (inviteCode && userData.inviteCode) {
        await storage.useInviteCode(userData.inviteCode, user.id);
        if (inviteCode.createdById && inviteCode.createdById !== null) {
          await createMultiTierReferrals(inviteCode.createdById, user.id, user.username);
          const referrer = await storage.getUserById(inviteCode.createdById);
          if (referrer) {
            await sendReferralNotification(referrer, user);
          }
        }
      }
      req.login(user, (err) => {
        if (err) return next(err);
        const { password, securityPassword, ...userWithoutPasswords } = user;
        res.status(201).json(userWithoutPasswords);
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });
  app2.post("/api/login/username", (req, res, next) => {
    passport.authenticate("local-username", (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }
      req.logIn(user, (err2) => {
        if (err2) {
          return res.status(500).json({ message: "Login failed" });
        }
        const { password, securityPassword, ...userWithoutPasswords } = user;
        res.status(200).json(userWithoutPasswords);
      });
    })(req, res, next);
  });
  app2.post("/api/login/email", (req, res, next) => {
    passport.authenticate("local-email", (err, user, info) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid email or password" });
      }
      req.logIn(user, (err2) => {
        if (err2) {
          return res.status(500).json({ message: "Login failed" });
        }
        const { password, securityPassword, ...userWithoutPasswords } = user;
        res.status(200).json(userWithoutPasswords);
      });
    })(req, res, next);
  });
  app2.post(
    "/api/login/phone",
    passport.authenticate("local-phone", { failWithError: true }),
    (req, res) => {
      const { password, securityPassword, ...userWithoutPasswords } = req.user;
      res.status(200).json(userWithoutPasswords);
    },
    (err, req, res, next) => {
      if (err && err.message) {
        res.status(401).json({ message: err.message });
      } else {
        res.status(401).json({ message: "Invalid phone or password" });
      }
    }
  );
  app2.post(
    "/api/login/telegram",
    passport.authenticate("local-telegram", { failWithError: true }),
    (req, res) => {
      const { password, securityPassword, ...userWithoutPasswords } = req.user;
      res.status(200).json(userWithoutPasswords);
    },
    (err, req, res, next) => {
      if (err && err.message) {
        res.status(401).json({ message: err.message });
      } else {
        res.status(401).json({ message: "Invalid Telegram ID or password" });
      }
    }
  );
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, securityPassword, ...userWithoutPasswords } = req.user;
    res.json(userWithoutPasswords);
  });
}

// server/routes.ts
import { z as z2 } from "zod";
import { eq as eq2, desc as desc2 } from "drizzle-orm";
import { scrypt as scrypt2, timingSafeEqual as timingSafeEqual2, randomBytes as randomBytes2 } from "crypto";
import { promisify as promisify2 } from "util";
import nodemailer3 from "nodemailer";

// server/admin-routes.ts
import nodemailer2 from "nodemailer";
async function sendWithdrawalApprovalEmail(user, transaction, txHash) {
  try {
    const transporter = nodemailer2.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Boolean(true),
      // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
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
            <p><strong>Network:</strong> ${transaction.network || "BSC"}</p>
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
      `
    });
    console.log(`Withdrawal approval email sent to ${user.email}`);
  } catch (error) {
    console.error("Failed to send withdrawal approval email:", error);
  }
}
function registerAdminRoutes(app2) {
  app2.get("/api/admin/users", async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      const enrichedUsers = await Promise.all(
        users2.map(async (user) => {
          const directReferrals = await storage.getReferralsByReferrerId(user.id);
          const directReferralIds = directReferrals.filter((ref) => ref.level === "1").map((ref) => ref.referredId);
          let directVolume = 0;
          for (const referralId of directReferralIds) {
            const referralUser = await storage.getUser(referralId);
            if (referralUser) {
              directVolume += parseFloat(referralUser.rechargeAmount.toString());
            }
          }
          const indirectReferrals = directReferrals.filter((ref) => ref.level !== "1").map((ref) => ref.referredId);
          let indirectVolume = 0;
          for (const referralId of indirectReferrals) {
            const referralUser = await storage.getUser(referralId);
            if (referralUser) {
              indirectVolume += parseFloat(referralUser.rechargeAmount.toString());
            }
          }
          let uplineUsername = null;
          if (user.referrerId) {
            const uplineUser = await storage.getUser(user.referrerId);
            uplineUsername = uplineUser?.username || null;
          }
          return {
            ...user,
            password: void 0,
            securityPassword: void 0,
            rank: user.currentRank || "Bronze",
            directVolume,
            indirectVolume,
            uplineUsername
          };
        })
      );
      res.json(enrichedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.delete("/api/admin/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(parseInt(id));
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app2.post("/api/admin/users/:id/deposit", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Deposit",
        amount: amount.toString(),
        status: "Completed",
        txHash: null
      });
      await storage.updateUser(parseInt(id), {
        totalAssets: (parseFloat(user.totalAssets.toString()) + parseFloat(amount.toString())).toString(),
        rechargeAmount: (parseFloat(user.rechargeAmount.toString()) + parseFloat(amount.toString())).toString()
      });
      res.json(transaction);
    } catch (err) {
      console.error("Error adding manual deposit:", err);
      res.status(500).json({ message: "Failed to add deposit" });
    }
  });
  app2.post("/api/admin/users/:id/add-withdrawable", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Bonus",
        amount: amount.toString(),
        status: "Completed",
        reason: "Admin added withdrawable amount",
        txHash: null
      });
      await storage.updateUser(parseInt(id), {
        withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + parseFloat(amount.toString())).toString()
      });
      res.json(transaction);
    } catch (err) {
      console.error("Error adding withdrawable amount:", err);
      res.status(500).json({ message: "Failed to add withdrawable amount" });
    }
  });
  app2.post("/api/admin/users/:id/deduct-withdrawable", async (req, res) => {
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
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Admin Deduction",
        amount: (-deductAmount).toString(),
        status: "Completed",
        reason: "Admin deducted withdrawable amount",
        txHash: null
      });
      await storage.updateUser(parseInt(id), {
        withdrawableAmount: (currentWithdrawable - deductAmount).toString(),
        totalAssets: (parseFloat(user.totalAssets.toString()) - deductAmount).toString()
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
  app2.post("/api/admin/users/:id/deduct-deposit", async (req, res) => {
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
      const transaction = await storage.createTransaction({
        userId: parseInt(id),
        type: "Deposit Reversal",
        amount: (-deductAmount).toString(),
        status: "Completed",
        reason: reason || "Admin reversed deposit transaction",
        txHash: null
      });
      await storage.updateUser(parseInt(id), {
        rechargeAmount: (currentRechargeAmount - deductAmount).toString(),
        totalAssets: (currentTotalAssets - deductAmount).toString()
      });
      await storage.createNotification({
        userId: parseInt(id),
        type: "system",
        message: `Your deposit has been reversed: -$${deductAmount.toFixed(2)}. Reason: ${reason || "Administrative action"}`,
        isRead: false
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
  app2.post("/api/admin/users/:id/ban", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const updatedUser = await storage.updateUser(parseInt(id), {
        isBanned: true,
        updatedAt: /* @__PURE__ */ new Date()
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error banning user:", err);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });
  app2.post("/api/admin/users/:id/unban", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(parseInt(id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const updatedUser = await storage.updateUser(parseInt(id), {
        isBanned: false,
        updatedAt: /* @__PURE__ */ new Date()
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error unbanning user:", err);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });
  app2.get("/api/admin/stats", async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      const transactions2 = await storage.getAllTransactions();
      const investments2 = await storage.getAllInvestments();
      const stats = {
        totalUsers: users2.length,
        totalDeposits: transactions2.filter((t) => t.type === "Deposit" && t.status === "Completed").reduce((sum2, t) => sum2 + parseFloat(t.amount.toString()), 0),
        totalWithdrawals: transactions2.filter((t) => t.type === "Withdrawal" && t.status === "Completed").reduce((sum2, t) => sum2 + parseFloat(t.amount.toString()), 0),
        totalInvestments: investments2.filter((i) => i.status === "Active").reduce((sum2, i) => sum2 + parseFloat(i.amount.toString()), 0),
        pendingTransactions: transactions2.filter((t) => t.status === "Pending").length,
        activeInvestments: investments2.filter((i) => i.status === "Active").length,
        transactions: transactions2.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        // Show all transactions
      };
      res.json(stats);
    } catch (err) {
      console.error("Error fetching platform stats:", err);
      res.status(500).json({ message: "Failed to fetch platform statistics" });
    }
  });
  app2.get("/api/admin/transactions/pending", async (req, res) => {
    try {
      const transactions2 = await storage.getPendingTransactions();
      const enrichedTransactions = await Promise.all(
        transactions2.map(async (tx) => {
          const fullTx = await storage.getTransaction(tx.id);
          if (tx.type === "Withdrawal") {
            const user = await storage.getUser(tx.userId);
            return {
              ...tx,
              userEmail: user?.email,
              username: user?.username,
              address: fullTx.address,
              network: fullTx.network
            };
          }
          return tx;
        })
      );
      res.json(enrichedTransactions);
    } catch (err) {
      console.error("Error fetching pending transactions:", err);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.post("/api/admin/transactions/:id/approve", async (req, res) => {
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
      if (transaction.type === "Withdrawal") {
        console.log("Processing withdrawal approval for transaction:", {
          id: transaction.id,
          userId: transaction.userId,
          amount: transaction.amount,
          address: transaction.address,
          status: transaction.status,
          fullTransaction: transaction
        });
        const { default: BSCService2 } = await Promise.resolve().then(() => (init_bsc_service(), bsc_service_exports));
        const BSC_CONFIG2 = {
          rpcUrl: process.env.BSC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
          contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
          usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb",
          adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
          globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
          privateKey: process.env.BSC_PRIVATE_KEY || ""
        };
        const bscService = new BSCService2(BSC_CONFIG2);
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
        const allUserTransactions = await storage.getTransactionsByUserId(user.id);
        const relatedFeeTransactions = allUserTransactions.filter(
          (tx) => tx.status === "Pending" && (tx.type === "Withdrawal Fee" || tx.type === "Gas Fee") && tx.createdAt >= transaction.createdAt
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
          const transferHashes = await bscService.processWithdrawal(
            walletAddress,
            withdrawalAmount.toString(),
            withdrawalFee.toString()
          );
          await storage.updateTransaction(id, {
            txHash: transferHashes.withdrawalTxHash
          });
          for (const feeTx of relatedFeeTransactions) {
            if (feeTx.type === "Withdrawal Fee") {
              await storage.updateTransaction(feeTx.id, {
                status: "Completed",
                txHash: transferHashes.feeTxHash
              });
            } else if (feeTx.type === "Gas Fee") {
              await storage.updateTransaction(feeTx.id, {
                status: "Completed",
                txHash: transferHashes.withdrawalTxHash
              });
            }
          }
          await storage.updateUser(user.id, {
            withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) - totalRequestedAmount).toString()
          });
          console.log("Withdrawal approved and processed:", {
            userId: user.id,
            amount: withdrawalAmount,
            address: walletAddress,
            txHash: transferHashes.withdrawalTxHash
          });
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
        const referrals2 = await storage.getReferralsByReferredId(user.id);
        if (referrals2.length > 0) {
          const tierCommissionRates = {
            "1": 0.1,
            // 10% for Tier 1
            "2": 0.05,
            // 5% for Tier 2
            "3": 0.03,
            // 3% for Tier 3
            "4": 0.02
            // 2% for Tier 4
          };
          for (const referral of referrals2) {
            const referrer = await storage.getUser(referral.referrerId);
            if (referrer) {
              let commissionRate = tierCommissionRates[referral.level] || 0;
              const commissionAmount = depositAmount * commissionRate;
              if (commissionAmount > 0) {
                await storage.updateUser(referrer.id, {
                  commissionAssets: (parseFloat(referrer.commissionAssets.toString()) + commissionAmount).toString(),
                  commissionToday: (parseFloat(referrer.commissionToday.toString()) + commissionAmount).toString(),
                  withdrawableAmount: (parseFloat(referrer.withdrawableAmount.toString()) + commissionAmount).toString()
                });
                const currentCommission = parseFloat(
                  referral.commission || "0"
                );
                await storage.updateReferral(referral.id, {
                  commission: (currentCommission + commissionAmount).toString()
                });
                await storage.createTransaction({
                  userId: referrer.id,
                  type: "Commission",
                  amount: commissionAmount.toString(),
                  status: "Completed",
                  reason: `Tier ${referral.level} referral commission from ${user.username || user.email}`,
                  txHash: null
                });
              }
            }
          }
        }
        await storage.updateUser(user.id, {
          totalAssets: (parseFloat(user.totalAssets.toString()) + depositAmount).toString(),
          rechargeAmount: (parseFloat(user.rechargeAmount.toString()) + depositAmount).toString()
        });
      }
      const updatedTransaction = await storage.updateTransaction(id, {
        status: "Completed",
        completionTime: /* @__PURE__ */ new Date()
      });
      await storage.createTransactionHistory({
        transactionId: id,
        status: "Completed",
        timestamp: /* @__PURE__ */ new Date(),
        details: "Transaction approved by admin"
      });
      res.json(updatedTransaction);
    } catch (err) {
      console.error("Error approving transaction:", err);
      res.status(500).json({ message: "Failed to approve transaction" });
    }
  });
  app2.post("/api/admin/notifications/mass", async (req, res) => {
    try {
      const { message } = req.body;
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
        await storage.createNotification({
          userId: user.id,
          type: "system",
          message,
          isRead: false
        });
      }
      res.json({ message: "Mass notification sent successfully" });
    } catch (err) {
      console.error("Error sending mass notification:", err);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });
  app2.post("/api/admin/messages/private/:userId", async (req, res) => {
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
        isRead: false
      });
      res.json({ message: "Private message sent successfully" });
    } catch (err) {
      console.error("Error sending private message:", err);
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  app2.post("/api/admin/users/:id/approve-country-rep", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = parseInt(id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.isCountryRep) {
        return res.status(400).json({ message: "User is already a Country Representative" });
      }
      const bonusAmount = 1e4;
      const updatedUser = await storage.updateUser(userId, {
        isCountryRep: true,
        countryRepStatus: "approved",
        withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + bonusAmount).toString(),
        updatedAt: /* @__PURE__ */ new Date()
      });
      await storage.createTransaction({
        userId,
        type: "Bonus",
        amount: bonusAmount.toString(),
        status: "Completed",
        txHash: null
      });
      await storage.createNotification({
        userId,
        type: "system",
        message: `\u{1F389} Congratulations! You have been approved as a Country Representative and received a $${bonusAmount.toLocaleString()} bonus!`,
        isRead: false
      });
      res.json({
        ...updatedUser,
        bonusAwarded: bonusAmount,
        message: `Country Representative approved with $${bonusAmount.toLocaleString()} bonus`
      });
    } catch (err) {
      console.error("Error approving country rep:", err);
      res.status(500).json({ message: "Failed to approve country representative" });
    }
  });
  app2.post("/api/admin/users/:id/verify", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedUser = await storage.updateUser(parseInt(id), {
        verificationStatus: "verified",
        updatedAt: /* @__PURE__ */ new Date()
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error verifying user:", err);
      res.status(500).json({ message: "Failed to verify user" });
    }
  });
  app2.post("/api/admin/transactions/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const updatedTransaction = await storage.updateTransaction(parseInt(id), {
        status: "Failed"
      });
      res.json(updatedTransaction);
    } catch (err) {
      console.error("Error rejecting transaction:", err);
      res.status(500).json({ message: "Failed to reject transaction" });
    }
  });
}

// server/bsc-routes.ts
init_bsc_service();
var BSC_CONFIG = {
  rpcUrl: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb",
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || ""
};
function registerBSCRoutes(app2) {
  const bscService = new bsc_service_default(BSC_CONFIG);
  app2.get("/api/bsc/wallet", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      let walletAddress = user.bscWalletAddress;
      if (!walletAddress) {
        const wallet = bscService.generateUserWallet(user.id);
        walletAddress = wallet.address;
        await storage.updateUser(req.user.id, {
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
  app2.post("/api/bsc/deposit", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { txHash } = req.body;
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      if (!user.bscWalletAddress) return res.status(400).json({ error: "No BSC wallet found" });
      const txDetails = await bscService.verifyTransaction(txHash);
      console.log("Transaction details:", {
        txHash,
        from: txDetails.from,
        to: txDetails.to,
        actualRecipient: txDetails.actualRecipient,
        usdtTransferAmount: txDetails.usdtTransferAmount,
        userBscWallet: user.bscWalletAddress
      });
      if (txDetails.to.toLowerCase() === BSC_CONFIG.usdtContractAddress.toLowerCase()) {
        if (!txDetails.actualRecipient || txDetails.actualRecipient.toLowerCase() !== user.bscWalletAddress.toLowerCase()) {
          return res.status(400).json({
            error: `USDT transfer not sent to your wallet. Expected: ${user.bscWalletAddress}, Got: ${txDetails.actualRecipient || "unknown"}`
          });
        }
        if (!txDetails.usdtTransferAmount || parseFloat(txDetails.usdtTransferAmount) <= 0) {
          return res.status(400).json({
            error: "No USDT transfer found in this transaction"
          });
        }
      } else if (user.bscWalletAddress && txDetails.to.toLowerCase() !== user.bscWalletAddress.toLowerCase()) {
        return res.status(400).json({
          error: `Transaction not sent to your wallet. Expected: ${user.bscWalletAddress}, Got: ${txDetails.to}`
        });
      }
      const existingTx = await storage.getTransactionByHash(txHash);
      if (existingTx) {
        return res.status(400).json({ error: "Transaction already processed" });
      }
      const depositAmount = parseFloat(txDetails.usdtTransferAmount);
      const adminFee = depositAmount * 0.02;
      const userAmount = depositAmount * 0.98;
      console.log("Processing deposit:", {
        originalAmount: depositAmount,
        adminFee,
        userAmount,
        userId: user.id
      });
      console.log("Deposit verified and recorded. Tokens remain in user wallet for now.");
      let transferHashes = null;
      let userWallet = null;
      try {
        userWallet = bscService.generateUserWallet(user.id);
        const usdtBalance = await bscService.getUSDTBalance(userWallet.address);
        console.log(`User wallet ${userWallet.address} USDT balance: ${usdtBalance}`);
        try {
          const result = await bscService.collectDepositTokensFromUser(
            user.id,
            depositAmount.toString(),
            adminFee.toString()
          );
          console.log("Token collection successful:", result);
        } catch (collectionError) {
          console.log("Token collection failed (optional):", collectionError.message);
        }
        try {
          await sendDepositNotification(user, depositAmount.toString(), txHash);
        } catch (emailError) {
          console.error("Failed to send deposit notification email:", emailError);
        }
        console.log("Token collection successful for deposit");
      } catch (transferError) {
        console.warn("Could not automatically collect tokens from user wallet:", transferError instanceof Error ? transferError.message : String(transferError));
      }
      console.log(`Checking referral commissions for user ${user.id}...`);
      const referrals2 = await storage.getReferralsByReferredId(user.id);
      console.log(`Found ${referrals2.length} referral relationships for user ${user.id}:`, referrals2);
      if (referrals2.length > 0) {
        console.log(`Processing referral commissions for user ${user.id} on all deposits...`);
        const tierCommissionRates = {
          "1": 0.1,
          // 10% for Tier 1
          "2": 0.05,
          // 5% for Tier 2
          "3": 0.03,
          // 3% for Tier 3
          "4": 0.02
          // 2% for Tier 4
        };
        for (const referral of referrals2) {
          const referrer = await storage.getUser(referral.referrerId);
          if (referrer) {
            let commissionRate = tierCommissionRates[referral.level] || 0;
            const commissionAmount = userAmount * commissionRate;
            if (commissionAmount > 0) {
              await storage.updateUser(referrer.id, {
                commissionAssets: (parseFloat(referrer.commissionAssets.toString()) + commissionAmount).toString(),
                commissionToday: (parseFloat(referrer.commissionToday.toString()) + commissionAmount).toString(),
                withdrawableAmount: (parseFloat(referrer.withdrawableAmount.toString()) + commissionAmount).toString()
              });
              const currentCommission = parseFloat(
                referral.commission || "0"
              );
              await storage.updateReferral(referral.id, {
                commission: (currentCommission + commissionAmount).toString()
              });
              await storage.createTransaction({
                userId: referrer.id,
                type: "Commission",
                amount: commissionAmount.toString(),
                status: "Completed",
                reason: `Tier ${referral.level} referral commission from BSC deposit by ${user.username || user.email}`,
                txHash: null
              });
              console.log(`Paid ${commissionAmount.toFixed(2)} USDT commission to referrer ${referrer.id} (Tier ${referral.level})`);
            }
          }
        }
      } else {
        console.log(`No referral relationships found for user ${user.id} - no commission to pay`);
      }
      await storage.createTransaction({
        userId: user.id,
        type: "Deposit",
        amount: userAmount.toString(),
        status: "Completed",
        txHash,
        // Use original transaction hash
        fromAddress: txDetails.from,
        toAddress: txDetails.to,
        blockNumber: txDetails.blockNumber,
        confirmationStatus: "confirmed",
        reason: `BSC testnet deposit - TX: ${txHash}`
      });
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
      if (userWallet) {
        try {
          console.log(`Checking remaining BNB balance for user ${user.id} wallet ${userWallet.address}...`);
          const remainingBnbBalance = await bscService.getBNBBalance(userWallet.address);
          console.log(`User ${user.id} remaining BNB balance: ${remainingBnbBalance}`);
          if (remainingBnbBalance > 1e-4) {
            console.log(`Returning ${remainingBnbBalance} BNB from user ${user.id} wallet to global admin wallet...`);
            const bnbReturnResult = await bscService.collectAllBNBFromUser(user.id);
            if (bnbReturnResult) {
              console.log(`Successfully returned ${bnbReturnResult.amount} BNB to global admin wallet. TX: ${bnbReturnResult.txHash}`);
            } else {
              console.log(`No BNB to return from user ${user.id} wallet`);
            }
          } else {
            console.log(`User ${user.id} BNB balance too low (${remainingBnbBalance}) - not returning to admin`);
          }
        } catch (bnbReturnError) {
          console.warn(`Failed to return BNB from user ${user.id} wallet:`, bnbReturnError.message);
        }
      }
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
      try {
        await sendDepositNotification(user, userAmount.toString(), txHash);
      } catch (emailError) {
        console.error("Failed to send deposit notification email:", emailError);
      }
      res.json({
        success: true,
        message: "Deposit processed successfully",
        amount: userAmount,
        fee: adminFee,
        txHash
      });
    } catch (error) {
      console.error("Error processing BSC deposit:", error);
      res.status(500).json({ error: "Failed to process deposit" });
    }
  });
  app2.post("/api/bsc/withdraw", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { amount, walletAddress } = req.body;
      console.log("Withdrawal request received:", {
        amount,
        walletAddress,
        requestBody: req.body
      });
      if (!walletAddress) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      const withdrawAmount = parseFloat(amount);
      const userBalance = parseFloat(user.withdrawableAmount.toString());
      if (withdrawAmount > userBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      const gasFee = 1;
      const withdrawalFee = withdrawAmount * 0.05;
      const netAmount = withdrawAmount - withdrawalFee - gasFee;
      console.log("Creating withdrawal request:", {
        requestedAmount: withdrawAmount,
        withdrawalFee,
        gasFee,
        netAmount,
        userId: user.id,
        toAddress: walletAddress
      });
      const withdrawalTransaction = await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal",
        amount: netAmount.toString(),
        status: "Pending",
        txHash: null,
        address: walletAddress,
        reason: `BSC withdrawal request to ${walletAddress} - Awaiting admin approval`
      });
      console.log("Created withdrawal transaction:", {
        id: withdrawalTransaction.id,
        address: withdrawalTransaction.address,
        amount: withdrawalTransaction.amount
      });
      await storage.createTransaction({
        userId: user.id,
        type: "Withdrawal Fee",
        amount: withdrawalFee.toString(),
        status: "Pending",
        txHash: null,
        address: BSC_CONFIG.adminFeeWallet,
        reason: `5% withdrawal fee - Awaiting admin approval`
      });
      await storage.createTransaction({
        userId: user.id,
        type: "Gas Fee",
        amount: gasFee.toString(),
        status: "Pending",
        txHash: null,
        address: "Network",
        reason: `BSC network gas fee - Awaiting admin approval`
      });
      console.log("Withdrawal request created successfully - awaiting admin approval");
      res.json({
        success: true,
        message: "Withdrawal request submitted successfully. Please wait for admin approval.",
        requestedAmount: withdrawAmount,
        netAmount,
        withdrawalFee,
        gasFee,
        status: "pending"
      });
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ error: "Failed to create withdrawal request" });
    }
  });
  app2.get("/api/bsc/transaction/:txHash", async (req, res) => {
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
  app2.post("/api/bsc/monitor-deposits", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const users2 = await storage.getAllUsers();
      const userAddresses = users2.filter((user) => user.bscWalletAddress).map((user) => user.bscWalletAddress.toLowerCase());
      await bscService.monitorDeposits(userAddresses, async (tx) => {
        console.log("New deposit detected:", tx);
      });
      res.json({ success: true, message: "Deposit monitoring started" });
    } catch (error) {
      console.error("Error starting deposit monitoring:", error);
      res.status(500).json({ error: "Failed to start monitoring" });
    }
  });
  app2.post("/api/bsc/collect-usdt", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { userIds } = req.body;
      if (userIds && Array.isArray(userIds)) {
        const results = await bscService.batchCollectUSDT(userIds);
        res.json({
          success: true,
          message: `Collection completed for ${userIds.length} users`,
          results
        });
      } else {
        const users2 = await storage.getAllUsers();
        const allUserIds = users2.filter((user) => user.bscWalletAddress).map((user) => user.id);
        const results = await bscService.batchCollectUSDT(allUserIds);
        res.json({
          success: true,
          message: `Collection completed for ${allUserIds.length} users`,
          results
        });
      }
    } catch (error) {
      console.error("Error collecting USDT:", error);
      res.status(500).json({ error: "Failed to collect USDT" });
    }
  });
  app2.post("/api/bsc/collect-usdt/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userId = parseInt(req.params.userId);
      const result = await bscService.collectAllUSDTFromUser(userId);
      if (result) {
        res.json({
          success: true,
          message: `Collected ${result.amount} USDT from user ${userId}`,
          txHash: result.txHash,
          amount: result.amount
        });
      } else {
        res.json({
          success: false,
          message: `No USDT found in user ${userId} wallet`
        });
      }
    } catch (error) {
      console.error("Error collecting USDT from user:", error);
      res.status(500).json({ error: "Failed to collect USDT" });
    }
  });
  app2.post("/api/bsc/collect-bnb", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { userIds } = req.body;
      if (userIds && Array.isArray(userIds)) {
        const results = await bscService.batchCollectBNB(userIds);
        res.json({
          success: true,
          message: `BNB collection completed for ${userIds.length} users`,
          results
        });
      } else {
        const users2 = await storage.getAllUsers();
        const allUserIds = users2.filter((user) => user.bscWalletAddress).map((user) => user.id);
        const results = await bscService.batchCollectBNB(allUserIds);
        res.json({
          success: true,
          message: `BNB collection completed for ${allUserIds.length} users`,
          results
        });
      }
    } catch (error) {
      console.error("Error collecting BNB:", error);
      res.status(500).json({ error: "Failed to collect BNB" });
    }
  });
  app2.post("/api/bsc/collect-bnb/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userId = parseInt(req.params.userId);
      const result = await bscService.collectAllBNBFromUser(userId);
      if (result) {
        res.json({
          success: true,
          message: `Collected ${result.amount} BNB from user ${userId}`,
          txHash: result.txHash,
          amount: result.amount
        });
      } else {
        res.json({
          success: false,
          message: `No collectible BNB found in user ${userId} wallet`
        });
      }
    } catch (error) {
      console.error("Error collecting BNB from user:", error);
      res.status(500).json({ error: "Failed to collect BNB" });
    }
  });
}

// server/routes.ts
import { sql, and as and2 } from "drizzle-orm";
var scryptAsync2 = promisify2(scrypt2);
async function comparePasswords2(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync2(supplied, salt, 64);
  return timingSafeEqual2(hashedBuf, suppliedBuf);
}
async function hashPassword2(password) {
  const salt = randomBytes2(16).toString("hex");
  const hashedBuf = await scryptAsync2(password, salt, 64);
  return `${hashedBuf.toString("hex")}.${salt}`;
}
async function registerRoutes(app2) {
  setupAuth(app2);
  registerAdminRoutes(app2);
  registerBSCRoutes(app2);
  app2.get("/api/welcome-code", async (req, res) => {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const welcomeCode = await db.insert(inviteCodes).values({
        code,
        createdById: 1
        // System user
      }).returning();
      res.json({ code: welcomeCode[0].code });
    } catch (error) {
      console.error("Error getting welcome code:", error);
      res.status(500).json({ error: "Failed to get welcome code" });
    }
  });
  app2.get("/api/crypto/prices", async (req, res) => {
    const getFallbackPrices = () => [
      { symbol: "BTC", name: "Bitcoin", price: 95420.5, change24h: 2.34, exchange: "COINGECKO" },
      { symbol: "ETH", name: "Ethereum", price: 3285.75, change24h: 1.87, exchange: "COINGECKO" },
      { symbol: "BNB", name: "BNB", price: 635.2, change24h: -0.45, exchange: "COINGECKO" },
      { symbol: "XRP", name: "XRP", price: 2.15, change24h: 3.21, exchange: "COINGECKO" },
      { symbol: "ADA", name: "Cardano", price: 0.98, change24h: 1.15, exchange: "COINGECKO" },
      { symbol: "SOL", name: "Solana", price: 185.4, change24h: 4.52, exchange: "COINGECKO" },
      { symbol: "DOGE", name: "Dogecoin", price: 0.32, change24h: -1.23, exchange: "COINGECKO" },
      { symbol: "AVAX", name: "Avalanche", price: 38.75, change24h: 2.08, exchange: "COINGECKO" }
    ];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5e3);
      const coinGeckoRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,ripple,cardano,solana,dogecoin,avalanche-2&vs_currencies=usd&include_24hr_change=true",
        {
          signal: controller.signal,
          headers: {
            "Accept": "application/json"
          }
        }
      );
      clearTimeout(timeout);
      if (!coinGeckoRes.ok) {
        console.warn(`CoinGecko API returned status ${coinGeckoRes.status}, using fallback data`);
        return res.json(getFallbackPrices());
      }
      const coinGeckoData = await coinGeckoRes.json();
      const formatPrice = (price) => Number(price.toFixed(2));
      const prices = [];
      const cryptoMapping = {
        bitcoin: { symbol: "BTC", name: "Bitcoin" },
        ethereum: { symbol: "ETH", name: "Ethereum" },
        binancecoin: { symbol: "BNB", name: "BNB" },
        ripple: { symbol: "XRP", name: "XRP" },
        cardano: { symbol: "ADA", name: "Cardano" },
        solana: { symbol: "SOL", name: "Solana" },
        dogecoin: { symbol: "DOGE", name: "Dogecoin" },
        "avalanche-2": { symbol: "AVAX", name: "Avalanche" }
      };
      Object.entries(coinGeckoData).forEach(([id, data]) => {
        const crypto2 = cryptoMapping[id];
        if (crypto2 && data.usd) {
          prices.push({
            symbol: crypto2.symbol,
            name: crypto2.name,
            price: formatPrice(data.usd),
            change24h: data.usd_24h_change ? parseFloat(data.usd_24h_change.toFixed(2)) : 0,
            exchange: "COINGECKO"
          });
        }
      });
      if (prices.length > 0) {
        console.log(`Successfully fetched ${prices.length} crypto prices from CoinGecko`);
        res.json(prices);
      } else {
        console.warn("CoinGecko returned empty data, using fallback");
        res.json(getFallbackPrices());
      }
    } catch (error) {
      console.error("Error fetching crypto prices from CoinGecko:", error.message);
      console.log("Using fallback crypto prices");
      res.json(getFallbackPrices());
    }
  });
  app2.get("/api/investment/plans", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = await storage.getUser(req.user.id);
      const userDepositAmount = user ? parseFloat(user.rechargeAmount.toString()) : 0;
      const plans = [
        {
          id: "basic-trading",
          name: "Basic AI Trading",
          minAmount: 10,
          maxAmount: 500,
          dailyRate: 3,
          description: "Earn 3% daily ($10 - $500)"
        },
        {
          id: "premium-trading",
          name: "Premium AI Trading",
          minAmount: 510,
          maxAmount: 5e3,
          dailyRate: 3.5,
          description: "Earn 3.5% daily ($510 - $5,000)"
        },
        {
          id: "vip-trading",
          name: "VIP AI Trading",
          minAmount: 5001,
          maxAmount: 5e4,
          dailyRate: 4,
          description: "Earn 4% daily ($5,001 - $50,000)"
        }
      ];
      const availablePlans = plans.filter((plan) => userDepositAmount >= plan.minAmount);
      res.json(availablePlans);
    } catch (err) {
      console.error("Error fetching investment plans:", err);
      res.status(500).json({ error: "Failed to fetch investment plans" });
    }
  });
  app2.post("/api/investment", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      console.log("Investment data received:", req.body);
      const { amount, plan, dailyRate } = req.body;
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      const userBalance = parseFloat(user.totalAssets.toString());
      if (typeof amount !== "number" || amount < 10) {
        return res.status(400).json({ error: "Investment amount must be at least $10" });
      }
      if (amount > 5e4) {
        return res.status(400).json({ error: "Investment amount cannot exceed $50,000" });
      }
      if (typeof plan !== "string" || !plan) {
        return res.status(400).json({ error: "Investment plan is required" });
      }
      if (typeof dailyRate !== "number" || dailyRate <= 0) {
        return res.status(400).json({ error: "Daily rate must be a positive number" });
      }
      const planTiers = {
        "basic-trading": { min: 10, max: 500, rate: 3 },
        "premium-trading": { min: 510, max: 5e3, rate: 3.5 },
        "vip-trading": { min: 5001, max: 5e4, rate: 4 }
      };
      const selectedPlan = planTiers[plan];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Invalid investment plan selected" });
      }
      if (amount < selectedPlan.min || amount > selectedPlan.max) {
        return res.status(400).json({
          error: `Investment amount must be between $${selectedPlan.min} and $${selectedPlan.max} for ${plan.replace("-", " ")}`
        });
      }
      if (dailyRate !== selectedPlan.rate) {
        return res.status(400).json({
          error: `Invalid daily rate for selected plan. Expected ${selectedPlan.rate}%`
        });
      }
      const userDepositAmount = parseFloat(user.rechargeAmount.toString());
      if (amount > userDepositAmount) {
        return res.status(400).json({
          error: "Investment amount cannot exceed your deposit amount"
        });
      }
      if (!user) return res.status(404).send("User not found");
      if (userDepositAmount < amount) {
        return res.status(400).json({ error: "Insufficient deposit amount for this investment" });
      }
      if (user.lastInvestmentDate) {
        const lastInvestment = new Date(user.lastInvestmentDate);
        const currentTime = /* @__PURE__ */ new Date();
        const timeDifference = currentTime.getTime() - lastInvestment.getTime();
        const hoursDifference = timeDifference / (1e3 * 60 * 60);
        if (hoursDifference < 24) {
          const timeRemaining = Math.ceil(24 - hoursDifference);
          return res.status(400).json({
            error: `You can only create one investment every 24 hours. Please try again in ${timeRemaining} hour${timeRemaining === 1 ? "" : "s"}.`
          });
        }
      }
      const investmentToCreate = {
        amount,
        plan,
        dailyRate,
        userId: req.user.id,
        status: "Active"
      };
      const investment = await storage.createInvestment(investmentToCreate);
      const instantProfitPercentage = dailyRate / 100;
      const instantProfit = amount * instantProfitPercentage;
      const currentProfitAssets = parseFloat(user.profitAssets.toString());
      await storage.updateUser(req.user.id, {
        profitAssets: (currentProfitAssets + instantProfit).toString(),
        todayEarnings: (parseFloat(user.todayEarnings.toString()) + instantProfit).toString(),
        withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + instantProfit).toString(),
        lastInvestmentDate: /* @__PURE__ */ new Date()
      });
      const profitTransaction = {
        userId: user.id,
        type: "Profit",
        amount: instantProfit.toString(),
        status: "Completed",
        txHash: null
      };
      await storage.createTransaction(profitTransaction);
      res.status(201).json({
        ...investment,
        instantProfit
      });
    } catch (err) {
      console.error("Investment creation error:", err);
      res.status(400).json({ error: err.message });
    }
  });
  app2.get("/api/investment", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const investments2 = await storage.getInvestmentsByUserId(req.user.id);
    res.json(investments2);
  });
  app2.get("/api/referrals", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const referrals2 = await storage.getReferralsByReferrerId(req.user.id);
    res.json(referrals2);
  });
  app2.get("/api/referrals/tier/:tier", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const tier = req.params.tier;
      const userId = req.user.id;
      const tierReferrals = await db.select({
        id: referrals.id,
        referredId: referrals.referredId,
        level: referrals.level,
        commission: referrals.commission,
        createdAt: referrals.createdAt,
        username: users.username,
        email: users.email,
        totalAssets: users.totalAssets,
        rechargeAmount: users.rechargeAmount,
        commissionAssets: users.commissionAssets
      }).from(referrals).innerJoin(users, eq2(users.id, referrals.referredId)).where(and2(eq2(referrals.referrerId, userId), eq2(referrals.level, tier))).orderBy(desc2(referrals.createdAt));
      const referralDetails = [];
      for (const referral of tierReferrals) {
        const userTransactions = await db.select({ amount: sql`COALESCE(SUM(${transactions.amount}), 0)` }).from(transactions).where(
          and2(
            eq2(transactions.userId, referral.referredId),
            eq2(transactions.type, "Deposit"),
            eq2(transactions.status, "Completed")
          )
        );
        const totalDeposits = userTransactions[0]?.amount || 0;
        referralDetails.push({
          ...referral,
          totalDeposits,
          displayName: referral.username || referral.email || `User${referral.referredId}`
        });
      }
      res.json(referralDetails);
    } catch (error) {
      console.error("Error fetching tier referrals:", error);
      res.status(500).json({ error: "Failed to fetch tier referrals" });
    }
  });
  app2.get("/api/referrals/summary", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userId = req.user.id;
      const tierCounts = await Promise.all([
        db.select({ count: sql`COUNT(*)` }).from(referrals).where(and2(eq2(referrals.referrerId, userId), eq2(referrals.level, "1"))),
        db.select({ count: sql`COUNT(*)` }).from(referrals).where(and2(eq2(referrals.referrerId, userId), eq2(referrals.level, "2"))),
        db.select({ count: sql`COUNT(*)` }).from(referrals).where(and2(eq2(referrals.referrerId, userId), eq2(referrals.level, "3"))),
        db.select({ count: sql`COUNT(*)` }).from(referrals).where(and2(eq2(referrals.referrerId, userId), eq2(referrals.level, "4")))
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
  app2.post("/api/transaction", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      if (transactionData.type === "Withdrawal") {
        if (parseFloat(user.totalAssets.toString()) < parseFloat(transactionData.amount.toString())) {
          return res.status(400).send("Insufficient funds for withdrawal");
        }
        await storage.updateUser(req.user.id, {
          withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) - parseFloat(transactionData.amount.toString())).toString()
        });
      } else if (transactionData.type === "Deposit") {
        const newTotalAssets = (parseFloat(user.totalAssets.toString()) + parseFloat(transactionData.amount.toString())).toString();
        await storage.updateUser(req.user.id, {
          rechargeAmount: (parseFloat(user.rechargeAmount.toString()) + parseFloat(transactionData.amount.toString())).toString()
        });
      }
      const transactionToCreate = {
        amount: transactionData.amount,
        type: transactionData.type,
        status: transactionData.status,
        txHash: transactionData.txHash ?? null,
        userId: req.user.id,
        network: transactionData.network,
        address: transactionData.address
      };
      const transaction = await storage.createTransaction(transactionToCreate);
      res.status(201).json(transaction);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app2.get("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    const { type, status, startDate, endDate } = req.query;
    const filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate) filter.createdAt = { gte: new Date(startDate) };
    if (endDate)
      filter.createdAt = {
        ...filter.createdAt,
        lte: new Date(endDate)
      };
    const transactions2 = await storage.getTransactionsByUserId(
      req.user.id,
      filter
    );
    const totals = transactions2.reduce(
      (acc, tx) => {
        const amount = parseFloat(tx.amount.toString());
        if (tx.status === "Completed") {
          if (tx.type === "Deposit") acc.totalDeposits += amount;
          else if (tx.type === "Withdrawal") acc.totalWithdrawals += amount;
          else if (tx.type === "Profit") acc.totalProfits += amount;
        }
        return acc;
      },
      { totalDeposits: 0, totalWithdrawals: 0, totalProfits: 0 }
    );
    res.json({ transactions: transactions2, totals });
  });
  app2.get("/api/withdrawal/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userTransactions = await storage.getTransactionsByUserId(req.user.id);
      const pendingWithdrawals = userTransactions.filter(
        (tx) => tx.status === "Pending" && (tx.type === "Withdrawal" || tx.type === "Withdrawal Fee" || tx.type === "Gas Fee")
      );
      const mainPendingWithdrawal = pendingWithdrawals.find((tx) => tx.type === "Withdrawal");
      if (mainPendingWithdrawal) {
        const relatedFees = pendingWithdrawals.filter(
          (tx) => tx.type !== "Withdrawal" && Math.abs(new Date(tx.createdAt).getTime() - new Date(mainPendingWithdrawal.createdAt).getTime()) < 6e4
          // Within 1 minute
        );
        res.json({
          hasPendingWithdrawal: true,
          pendingWithdrawal: {
            id: mainPendingWithdrawal.id,
            amount: mainPendingWithdrawal.amount,
            address: mainPendingWithdrawal.address,
            createdAt: mainPendingWithdrawal.createdAt,
            status: mainPendingWithdrawal.status,
            relatedFees: relatedFees.map((fee) => ({
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
  app2.post("/api/invite-code/verify", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Invite code is required" });
      }
      const existingCode = await storage.getInviteCode(code);
      if (!existingCode) {
        const newCode = await storage.createInviteCode({
          code,
          createdById: 1
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
  app2.post("/api/invite-code", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const [inviteCode] = await Promise.all([
        db.insert(inviteCodes).values({
          code,
          createdById: req.user.id
        }).returning(),
        db.update(users).set({
          inviteCode: code,
          referralCode: code,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(users.id, req.user.id))
      ]);
      res.json({
        ...inviteCode[0],
        inviteCode: code,
        referralCode: code
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app2.get("/api/invite-codes", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const codes = await db.select().from(inviteCodes).where(eq2(inviteCodes.createdById, req.user.id));
      res.json(codes);
    } catch (err) {
      console.error("Error fetching invite codes:", err);
      res.status(500).json({ error: "Failed to fetch invite codes" });
    }
  });
  app2.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      const userResult = await db.select().from(users).where(eq2(users.resetToken, token));
      const user = userResult[0];
      if (!user || !user.resetTokenExpiry || /* @__PURE__ */ new Date() > new Date(user.resetTokenExpiry)) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      const salt = randomBytes2(16).toString("hex");
      const hashedPassword = await scryptAsync2(password, salt, 64);
      const newHashedPassword = `${hashedPassword.toString("hex")}.${salt}`;
      await db.update(users).set({
        password: newHashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(users.id, user.id));
      res.json({ message: "Password reset successful" });
    } catch (err) {
      console.error("Reset password error:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
  app2.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const userResult = await db.select().from(users).where(eq2(users.email, email));
      const user = userResult[0];
      if (user) {
        const resetToken = randomBytes2(32).toString("hex");
        const resetExpiry = new Date(Date.now() + 36e5);
        await db.update(users).set({
          resetToken,
          resetTokenExpiry: resetExpiry,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(users.id, user.id));
        const transporter = nodemailer3.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT),
          secure: Boolean(true),
          // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          },
          tls: {
            rejectUnauthorized: false
          }
        });
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
          `
        });
      }
      res.json({
        message: "If an account exists with this email, you will receive reset instructions"
      });
    } catch (err) {
      console.error("Password reset error:", err);
      res.status(500).json({ error: "Failed to process password reset" });
    }
  });
  app2.get("/api/account", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userResult = await db.select().from(users).where(eq2(users.id, req.user.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");
      const investmentResults = await db.select().from(investments).where(eq2(investments.userId, user.id));
      const transactionResults = await db.select().from(transactions).where(eq2(transactions.userId, user.id));
      const referralResults = await db.select().from(referrals).where(eq2(referrals.referrerId, user.id));
      const userNotifications = await db.select().from(notifications).where(eq2(notifications.userId, user.id)).orderBy(desc2(notifications.createdAt));
      const totalInvested = investmentResults.reduce(
        (sum2, inv) => sum2 + parseFloat(inv.amount.toString()),
        0
      );
      const currentBalance = parseFloat(user.totalAssets.toString());
      const totalProfit = parseFloat(user.profitAssets.toString());
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
          rechargeAmount: user.rechargeAmount,
          // Deposit Amount
          profitAssets: user.profitAssets,
          // Total profits generated
          withdrawableAmount: user.withdrawableAmount,
          // Referral bonuses + ranking bonus + daily profits
          todayEarnings: user.todayEarnings,
          yesterdayEarnings: user.yesterdayEarnings,
          lastInvestmentDate: user.lastInvestmentDate,
          createdAt: user.createdAt,
          notifications: userNotifications
        },
        stats: {
          totalInvested,
          currentBalance: calculatedTotalAssets,
          totalProfit,
          activeInvestments: investmentResults.filter(
            (inv) => inv.status === "Active"
          ).length,
          referralsCount: referralResults.length
        }
      });
    } catch (err) {
      console.error("Error fetching account info:", err);
      res.status(500).json({ error: "Failed to fetch account information" });
    }
  });
  app2.patch("/api/account", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const { email, phone, telegram } = req.body;
      const userData = {};
      if (email) userData.email = email;
      if (phone) userData.phone = phone;
      if (telegram) userData.telegram = telegram;
      await db.update(users).set(userData).where(eq2(users.id, req.user.id));
      const updatedUserResult = await db.select().from(users).where(eq2(users.id, req.user.id));
      const updatedUser = updatedUserResult[0];
      if (!updatedUser) return res.status(404).send("User not found");
      const { password, securityPassword, ...userWithoutPasswords } = updatedUser;
      res.json(userWithoutPasswords);
    } catch (err) {
      console.error("Error updating account:", err);
      res.status(500).json({ error: "Failed to update account information" });
    }
  });
  app2.get("/api/upline", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userResult = await db.select().from(users).where(eq2(users.id, req.user.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");
      if (!user.referrerId) {
        return res.json({ upline: null });
      }
      const uplineResult = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt
      }).from(users).where(eq2(users.id, user.referrerId));
      const upline = uplineResult[0];
      if (!upline) {
        return res.json({ upline: null });
      }
      res.json({
        upline: {
          id: upline.id,
          username: upline.username,
          email: upline.email,
          createdAt: upline.createdAt
        }
      });
    } catch (err) {
      console.error("Error fetching upline info:", err);
      res.status(500).json({ error: "Failed to fetch upline information" });
    }
  });
  app2.get("/api/dashboard/stats", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userResult = await db.select().from(users).where(eq2(users.id, req.user.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");
      const investmentResults = await db.select().from(investments).where(eq2(investments.userId, user.id));
      const activeInvestments = investmentResults.filter(
        (inv) => inv.status === "Active"
      );
      const referralResults = await db.select().from(referrals).where(eq2(referrals.referrerId, user.id));
      res.json({
        totalAssets: user.totalAssets,
        rechargeAmount: user.rechargeAmount,
        // Deposit amount only
        profitAssets: user.profitAssets,
        todayEarnings: user.todayEarnings,
        yesterdayEarnings: user.yesterdayEarnings,
        commissionToday: user.commissionToday,
        activeInvestmentsCount: activeInvestments.length,
        referralsCount: referralResults.length
      });
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });
  app2.post("/api/simulate-earnings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const now = /* @__PURE__ */ new Date();
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return res.json({
          success: true,
          message: "Skipping daily earnings calculation - weekend"
        });
      }
      const allUsers = await storage.getAllUsers();
      for (const user of allUsers) {
        const investments2 = await storage.getInvestmentsByUserId(user.id);
        const activeInvestments = investments2.filter(
          (inv) => inv.status === "Active"
        );
        let totalEarnings = 0;
        for (const investment of activeInvestments) {
          const dailyRate = parseFloat(investment.dailyRate.toString()) / 100;
          const amount = parseFloat(investment.amount.toString());
          const dailyEarning = amount * dailyRate;
          totalEarnings += dailyEarning;
        }
        await storage.updateUser(user.id, {
          yesterdayEarnings: user.todayEarnings.toString(),
          todayEarnings: totalEarnings.toString(),
          profitAssets: (parseFloat(user.profitAssets.toString()) + totalEarnings).toString(),
          withdrawableAmount: (parseFloat(user.withdrawableAmount.toString()) + totalEarnings).toString()
        });
        if (totalEarnings > 0) {
          const profitTransaction = {
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
            completionTime: null
          };
          await storage.createTransaction(profitTransaction);
        }
      }
      res.json({
        success: true,
        message: "Daily earnings calculated for all users"
      });
    } catch (err) {
      console.error("Error simulating earnings:", err);
      res.status(500).json({ error: "Failed to simulate earnings" });
    }
  });
  app2.post("/api/apply-country-rep", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      if (user.countryRepStatus === "pending") {
        return res.status(400).json({
          message: "You have already applied for Country Representative status"
        });
      }
      if (user.isCountryRep) {
        return res.status(400).json({
          message: "You are already a Country Representative"
        });
      }
      const totalTeamVolume = parseFloat(user.totalVolumeGenerated.toString());
      if (totalTeamVolume < 1e6) {
        return res.status(400).json({
          message: `You need to reach $1,000,000 in Team Volume to apply for Country Representative. Current volume: $${totalTeamVolume.toLocaleString()}`,
          currentVolume: totalTeamVolume,
          requiredVolume: 1e6
        });
      }
      await storage.updateUser(user.id, {
        countryRepStatus: "pending"
      });
      res.json({
        message: "Country Representative application submitted successfully! Your application is under review.",
        teamVolume: totalTeamVolume
      });
    } catch (err) {
      console.error("Error applying for Country Rep:", err);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });
  app2.delete("/api/notifications/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const notificationId = parseInt(req.params.id);
      await db.delete(notifications).where(eq2(notifications.id, notificationId));
      res.status(200).json({ message: "Notification deleted successfully" });
    } catch (err) {
      console.error("Error deleting notification:", err);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });
  app2.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      const referrals2 = await storage.getReferralsByReferrerId(user.id);
      const referralDetails = [];
      for (const referral of referrals2) {
        const referredUser = await storage.getUser(referral.referredId);
        if (referredUser) {
          const userTransactions = await storage.getTransactionsByUserId(
            referredUser.id
          );
          const totalDeposits = userTransactions.filter((tx) => tx.type === "Deposit" && tx.status === "Completed").reduce((sum2, tx) => sum2 + parseFloat(tx.amount.toString()), 0);
          referralDetails.push({
            id: referral.id,
            level: referral.level,
            commission: referral.commission,
            totalDeposits,
            referredUser: {
              id: referredUser.id,
              username: referredUser.username,
              createdAt: referredUser.createdAt
            }
          });
        }
      }
      const { password, securityPassword, ...userWithoutPasswords } = user;
      res.json({
        profile: userWithoutPasswords,
        referrals: referralDetails
      });
    } catch (err) {
      console.error("Error fetching profile:", err);
      res.status(500).json({ error: "Failed to fetch profile information" });
    }
  });
  app2.put("/api/user/referral-code", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { referralCode } = req.body;
      const updatedUser = await storage.updateUser(req.user.id, {
        referralCode,
        updatedAt: /* @__PURE__ */ new Date()
      });
      res.json(updatedUser);
    } catch (err) {
      console.error("Error updating referral code:", err);
      res.status(500).json({ message: "Failed to update referral code" });
    }
  });
  app2.post("/api/change-password", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const schema = z2.object({
        currentPassword: z2.string().min(1),
        newPassword: z2.string().min(6)
      });
      const { currentPassword, newPassword } = schema.parse(req.body);
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).send("User not found");
      const isCurrentPasswordValid = await comparePasswords2(
        currentPassword,
        user.password
      );
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          message: "Current password is incorrect"
        });
      }
      const hashedNewPassword = await hashPassword2(newPassword);
      await storage.updateUser(req.user.id, {
        password: hashedNewPassword
      });
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/transactions", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const schema = z2.object({
        type: z2.enum(["Deposit", "Withdrawal"]),
        amount: z2.number().min(0.01),
        status: z2.enum(["Pending", "Completed", "Failed"]),
        network: z2.string().optional(),
        address: z2.string().optional(),
        fee: z2.number().optional(),
        txHash: z2.string().optional()
      });
      const transactionData = schema.parse(req.body);
      const userResult = await db.select().from(users).where(eq2(users.id, req.user.id));
      const user = userResult[0];
      if (!user) return res.status(404).send("User not found");
      const existingTransactions = await db.select().from(transactions).where(eq2(transactions.userId, req.user.id));
      const completedDeposits = existingTransactions.filter(
        (t) => t.type === "Deposit" && t.status === "Completed"
      );
      if (transactionData.type === "Deposit") {
        if (transactionData.amount < 5) {
          return res.status(400).json({
            message: "Minimum deposit amount is $5"
          });
        }
        const depositAmount = transactionData.amount;
        const platformFee = depositAmount * 0.05;
        const netDepositAmount = depositAmount - platformFee;
        const currentRechargeAmount = parseFloat(user.rechargeAmount.toString());
        const newRechargeAmount = (currentRechargeAmount + netDepositAmount).toString();
        const currentTotalAssets = parseFloat(user.totalAssets.toString());
        const newTotalAssets = (currentTotalAssets + netDepositAmount).toString();
        await db.update(users).set({
          totalAssets: newTotalAssets,
          rechargeAmount: newRechargeAmount
        }).where(eq2(users.id, req.user.id));
      } else if (transactionData.type === "Withdrawal") {
        if (transactionData.amount < 5) {
          return res.status(400).json({
            message: "Minimum withdrawal amount is $5"
          });
        }
        if (transactionData.amount > 5e4) {
          return res.status(400).json({
            message: "Maximum withdrawal amount is $50,000"
          });
        }
        const userTransactions = await db.select().from(transactions).where(eq2(transactions.userId, user.id));
        const deposits = userTransactions.filter(
          (tx) => tx.type === "Deposit" && tx.status === "Completed"
        );
        const totalCommissions = userTransactions.filter((tx) => tx.type === "Commission" && tx.status === "Completed").reduce((sum2, tx) => sum2 + parseFloat(tx.amount.toString()), 0);
        const totalReferralBonuses = userTransactions.filter((tx) => tx.type === "Referral Bonus" && tx.status === "Completed").reduce((sum2, tx) => sum2 + parseFloat(tx.amount.toString()), 0);
        const totalRankingBonuses = userTransactions.filter((tx) => tx.type === "Ranking Bonus" && tx.status === "Completed").reduce((sum2, tx) => sum2 + parseFloat(tx.amount.toString()), 0);
        const withdrawalFee = transactionData.amount * 0.05;
        const totalAmount = transactionData.amount + withdrawalFee;
        if (parseFloat(user.totalAssets.toString()) < totalAmount) {
          return res.status(400).json({ message: "Insufficient funds for withdrawal (including 5% fee)" });
        }
      }
      const transactionToCreate = {
        amount: transactionData.amount.toString(),
        type: transactionData.type,
        status: "Pending",
        network: transactionData.network,
        address: transactionData.address,
        fee: transactionData.type === "Withdrawal" ? (transactionData.amount * 0.05).toString() : "0",
        processingTime: null,
        completionTime: null,
        reason: null,
        txHash: transactionData.txHash || null,
        userId: req.user.id
      };
      const transactionResult = await db.insert(transactions).values(transactionToCreate).returning();
      const transaction = transactionResult[0];
      await db.insert(transactionHistory).values({
        transactionId: transaction.id,
        status: "Pending",
        timestamp: /* @__PURE__ */ new Date(),
        details: `${transactionData.type} transaction created`
      });
      const response = {
        success: true,
        transaction
      };
      if (transactionData.type === "Deposit" && completedDeposits.length === 0) {
        response.welcomeBonus = {
          amount: (transactionData.amount * 0.1).toFixed(2),
          percentage: "10%"
        };
      }
      res.status(201).json(response);
    } catch (err) {
      console.error("Error creating transaction:", err);
      res.status(400).json({ message: err.message });
    }
  });
  app2.post("/api/notifications/:id/read", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;
      await db.update(notifications).set({ isRead: true }).where(eq2(notifications.id, notificationId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });
  app2.post("/api/admin/initialize-ranks", async (req, res) => {
    try {
      const predefinedRanks = [
        { name: "Manager", requiredVolume: "3000", incentiveAmount: "150", incentiveDescription: "$150 bonus", order: 1 },
        { name: "Leader", requiredVolume: "7000", incentiveAmount: "250", incentiveDescription: "$250 bonus", order: 2 },
        { name: "Ambassador", requiredVolume: "15000", incentiveAmount: "1000", incentiveDescription: "$1,000 bonus", order: 3 },
        { name: "Director", requiredVolume: "20000", incentiveAmount: "3000", incentiveDescription: "$3,000 + Apple watch", order: 4 },
        { name: "Executive", requiredVolume: "50000", incentiveAmount: "5000", incentiveDescription: "$5,000 + Laptop", order: 5 },
        { name: "Vice Chairman", requiredVolume: "100000", incentiveAmount: "10000", incentiveDescription: "$10,000 Bonus + A car reward", order: 6 },
        { name: "Chairman", requiredVolume: "500000", incentiveAmount: "20000", incentiveDescription: "$20,000 Bonus + A trip to UK", order: 7 },
        { name: "President", requiredVolume: "1000000", incentiveAmount: "30000", incentiveDescription: "$30,000 bonus + A House", order: 8 }
      ];
      for (const rank of predefinedRanks) {
        const existing = await db.select().from(ranks).where(eq2(ranks.name, rank.name));
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
  app2.get("/api/ranks", async (req, res) => {
    try {
      const allRanks = await db.select().from(ranks).orderBy(ranks.order);
      res.json(allRanks);
    } catch (error) {
      console.error("Error fetching ranks:", error);
      res.status(500).json({ error: "Failed to fetch ranks" });
    }
  });
  async function calculateUserVolume(userId) {
    const referrals2 = await storage.getReferralsByReferrerId(userId);
    const directReferralIds = referrals2.filter((ref) => ref.level === "1").map((ref) => ref.referredId);
    let directVolume = 0;
    for (const referralId of directReferralIds) {
      const referralUser = await storage.getUser(referralId);
      if (referralUser) {
        directVolume += parseFloat(referralUser.rechargeAmount.toString());
      }
    }
    const indirectReferralIds = referrals2.filter((ref) => ["2", "3", "4"].includes(ref.level)).map((ref) => ref.referredId);
    let indirectVolume = 0;
    for (const referralId of indirectReferralIds) {
      const referralUser = await storage.getUser(referralId);
      if (referralUser) {
        indirectVolume += parseFloat(referralUser.rechargeAmount.toString());
      }
    }
    const totalVolume = directVolume + indirectVolume;
    return { totalVolume, directVolume, indirectVolume };
  }
  async function getDownlineInvestments(userId) {
    const allReferrals = await db.select({
      referredId: referrals.referredId,
      level: referrals.level
    }).from(referrals).where(eq2(referrals.referrerId, userId));
    let totalDownlineInvestment = 0;
    for (const referral of allReferrals) {
      const referralInvestments = await db.select({ amount: sql`COALESCE(SUM(${transactions.amount}), 0)` }).from(transactions).where(
        and2(
          eq2(transactions.userId, referral.referredId),
          eq2(transactions.type, "Deposit"),
          eq2(transactions.status, "Completed")
        )
      );
      const referralAmount = parseFloat(referralInvestments[0]?.amount?.toString() || "0");
      totalDownlineInvestment += referralAmount;
    }
    return totalDownlineInvestment;
  }
  app2.get("/api/check-rank/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userId = parseInt(req.params.userId);
      const volumeData = await calculateUserVolume(userId);
      await db.update(users).set({ totalVolumeGenerated: Number(volumeData.totalVolume).toFixed(2) }).where(eq2(users.id, userId));
      const allRanks = await db.select().from(ranks).orderBy(desc2(sql`CAST(${ranks.requiredVolume} AS DECIMAL)`));
      let newRank = "none";
      let qualifiedRank = null;
      for (const rank of allRanks) {
        if (volumeData.totalVolume >= parseFloat(rank.requiredVolume)) {
          newRank = rank.name;
          qualifiedRank = rank;
          break;
        }
      }
      const user = await db.select().from(users).where(eq2(users.id, userId));
      const currentRank = user[0]?.currentRank || "none";
      if (newRank !== currentRank && qualifiedRank) {
        await db.update(users).set({ currentRank: newRank }).where(eq2(users.id, userId));
        const existingAchievement = await db.select().from(userRankAchievements).where(and2(
          eq2(userRankAchievements.userId, userId),
          eq2(userRankAchievements.rankName, newRank)
        ));
        if (existingAchievement.length === 0) {
          await db.insert(userRankAchievements).values({
            userId,
            rankName: newRank,
            incentivePaid: true,
            incentiveAmount: qualifiedRank.incentiveAmount,
            volumeAtAchievement: Number(volumeData.totalVolume).toFixed(2)
          });
          const incentiveAmount = parseFloat(qualifiedRank.incentiveAmount);
          const currentWithdrawable = parseFloat(user[0]?.withdrawableAmount || "0");
          await db.update(users).set({
            withdrawableAmount: (currentWithdrawable + incentiveAmount).toFixed(2),
            totalAssets: (parseFloat(user[0]?.totalAssets || "0") + incentiveAmount).toFixed(2)
          }).where(eq2(users.id, userId));
          await db.insert(transactions).values({
            userId,
            type: "Rank Incentive",
            amount: qualifiedRank.incentiveAmount,
            status: "Completed",
            reason: `Rank achievement: ${newRank}`
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
  app2.get("/api/user/rank-achievements", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    try {
      const userId = req.user.id;
      const achievements = await db.select().from(userRankAchievements).where(eq2(userRankAchievements.userId, userId)).orderBy(desc2(userRankAchievements.achievedAt));
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching rank achievements:", error);
      res.status(500).json({ error: "Failed to fetch rank achievements" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    // runtimeErrorOverlay(), // Disable this plugin temporarily
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    hmr: {
      overlay: false
      // Already disabled, which is good
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  if (process.env.NODE_ENV === "production") {
    app2.use(express.static(path2.resolve(import.meta.dirname, "..", "dist", "public")));
    app2.get("*", (_req, res) => {
      res.sendFile(path2.resolve(import.meta.dirname, "..", "dist", "public", "index.html"));
    });
  } else {
    app2.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const clientTemplate = path2.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html"
        );
        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="./src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`
        );
        const page = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      return next();
    }
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();
