import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import crypto from 'crypto';

interface BSCConfig {
  rpcUrl: string;
  contractAddress: string;
  usdtContractAddress: string;
  adminFeeWallet: string;
  globalAdminWallet: string;
  privateKey: string;
}

class BSCService {
  private web3: Web3;
  private contract!: Contract<any>;
  private usdtContract!: Contract<any>;
  private config: BSCConfig;
  private account: any;

  constructor(config: BSCConfig) {
    this.config = config;
    
    // Use BSC mainnet RPC URL
    const rpcUrl = config.rpcUrl || "https://bsc-dataseed1.binance.org/";
    console.log("BSC Service initialized with RPC:", rpcUrl);
    
    this.web3 = new Web3(rpcUrl);
    
    // Test connection
    this.testConnection();
    
    // Ensure private key has 0x prefix
    const privateKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`;
    this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    this.web3.eth.accounts.wallet.add(this.account);
    
    // Initialize contracts
    this.initializeContracts();
  }

  private async testConnection() {
    try {
      const chainId = await this.web3.eth.getChainId();
      const blockNumber = await this.web3.eth.getBlockNumber();
      console.log(`Connected to BSC network - Chain ID: ${chainId}, Block: ${blockNumber}`);
      
      if (chainId !== BigInt(56)) { // BSC testnet chain ID
        console.warn(`Warning: Expected BSC testnet (56) but connected to chain ${chainId}`);
      }
    } catch (error) {
      console.error("Failed to connect to BSC network:", error);
    }
  }

  // Get optimized gas price based on network conditions
  private async getOptimizedGasPrice(): Promise<string> {
    try {
      const currentGasPrice = await this.web3.eth.getGasPrice();
      const gasPriceGwei = Number(this.web3.utils.fromWei(currentGasPrice, 'gwei'));
      
      // BSC minimum gas price is typically 10 Gwei
      const minimumGasPrice = this.web3.utils.toWei('10', 'gwei');
      
      // BSC gas price optimization with minimum enforcement
      let multiplier = 0.95; // Conservative 5% reduction
      
      if (gasPriceGwei <= 10) {
        // Don't reduce if already at or below 10 Gwei
        multiplier = 1.0;
      } else if (gasPriceGwei <= 15) {
        multiplier = 0.95; // Small 5% reduction
      } else if (gasPriceGwei <= 25) {
        multiplier = 0.9; // 10% reduction for moderate gas
      } else {
        multiplier = 0.85; // 15% reduction for high gas periods
      }
      
      const optimizedPrice = (BigInt(currentGasPrice) * BigInt(Math.floor(multiplier * 100)) / BigInt(100)).toString();
      
      // Ensure we don't go below minimum
      const finalPrice = BigInt(optimizedPrice) < BigInt(minimumGasPrice) ? minimumGasPrice : optimizedPrice;
      
      console.log(`Gas price optimization: ${gasPriceGwei} Gwei → ${Number(this.web3.utils.fromWei(finalPrice.toString(), 'gwei')).toFixed(2)} Gwei (min: 10 Gwei enforced)`);
      
      return finalPrice.toString();
    } catch (error) {
      console.error('Error getting optimized gas price:', error);
      // Fallback to minimum gas price
      return this.web3.utils.toWei('10', 'gwei');
    }
  }

  // Validate if address has sufficient USDT balance for transfer
  async validateUSDTBalance(address: string, requiredAmount: string): Promise<{hasBalance: boolean, currentBalance: string, required: string}> {
    try {
      const currentBalance = await this.getUSDTBalance(address);
      const hasBalance = parseFloat(currentBalance) >= parseFloat(requiredAmount);
      
      return {
        hasBalance,
        currentBalance,
        required: requiredAmount
      };
    } catch (error) {
      console.error('Error validating USDT balance:', error);
      throw error;
    }
  }

  // Batch multiple transfers to save gas costs
  async batchTransferUSDT(transfers: Array<{toAddress: string, amount: string}>, fromPrivateKey: string): Promise<string[]> {
    try {
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
      const txHashes: string[] = [];
      
      // Get starting nonce
      let nonce = await this.web3.eth.getTransactionCount(fromAccount.address, 'pending');
      const gasPrice = await this.getOptimizedGasPrice();
      
      console.log(`Batch processing ${transfers.length} transfers with optimized gas`);
      
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        const amountWei = this.web3.utils.toWei(transfer.amount, 'ether');
        
        const transferTx = this.usdtContract.methods.transfer(transfer.toAddress, amountWei);
        const gasEstimateRaw = await transferTx.estimateGas({ from: fromAccount.address });
        const gasEstimate = (BigInt(gasEstimateRaw) * BigInt(110) / BigInt(100)).toString();
        
        const txData = {
          from: fromAccount.address,
          to: this.config.usdtContractAddress,
          data: transferTx.encodeABI(),
          gas: gasEstimate,
          gasPrice: gasPrice,
          nonce: Number(nonce) + i
        };
        
        const signedTx = await fromAccount.signTransaction(txData);
        const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
        
        txHashes.push(receipt.transactionHash.toString());
        console.log(`Batch transfer ${i+1}/${transfers.length}: ${transfer.amount} USDT to ${transfer.toAddress}`);
        
        // Small delay to prevent nonce conflicts
        if (i < transfers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return txHashes;
    } catch (error) {
      console.error('Error in batch transfer:', error);
      throw error;
    }
  }

  private initializeContracts() {
    // Payment Processor Contract ABI
    const paymentProcessorABI = [
      {
        "inputs": [
          {"name": "userWallet", "type": "address"},
          {"name": "txHash", "type": "string"},
          {"name": "amount", "type": "uint256"}
        ],
        "name": "processDeposit",
        "outputs": [],
        "type": "function"
      },
      {
        "inputs": [
          {"name": "userWallet", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ],
        "name": "processWithdrawal",
        "outputs": [],
        "type": "function"
      }
    ];

    // USDT Contract ABI (simplified)
    const usdtABI = [
      {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
      },
      {
        "inputs": [
          {"name": "to", "type": "address"},
          {"name": "amount", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
      }
    ];

    this.contract = new this.web3.eth.Contract(paymentProcessorABI, this.config.contractAddress);
    this.usdtContract = new this.web3.eth.Contract(usdtABI, this.config.usdtContractAddress);
  }

  // Generate unique wallet address for each user
  generateUserWallet(userId: number): { address: string; privateKey: string } {
    const seed = `${userId}-${process.env.WALLET_SEED || 'default-seed'}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    const account = this.web3.eth.accounts.privateKeyToAccount('0x' + hash);
    
    return {
      address: account.address,
      privateKey: account.privateKey
    };
  }

  // Verify transaction hash and get transaction details
  async verifyTransaction(txHash: string): Promise<any> {
    try {
      console.log(`Verifying transaction: ${txHash}`);
      console.log(`Using RPC: ${this.config.rpcUrl}`);
      
      // Validate transaction hash format
      if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
        throw new Error(`Invalid transaction hash format: ${txHash}. Must be 66 characters starting with 0x`);
      }
      
      // Check network connection first
      const chainId = await this.web3.eth.getChainId();
      console.log(`Connected to chain ID: ${chainId}`);
      
      // Add retry logic for pending transactions
      let transaction = null;
      let receipt = null;
      let retries = 0;
      const maxRetries = 10; // Increased retries
      
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
            
            // Try to get receipt
            receipt = await this.web3.eth.getTransactionReceipt(txHash);
            
            if (receipt) {
              console.log(`Receipt found: Block ${receipt.blockNumber}, Status: ${receipt.status}`);
              break;
            } else {
              console.log(`Transaction exists but no receipt yet (pending)`);
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
              retries++;
              continue;
            }
          } else {
            console.log(`Transaction not found, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            retries++;
            continue;
          }
          
        } catch (error: any) {
          console.error(`Error on attempt ${retries + 1}:`, error.message);
          
          if (retries < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries++;
            continue;
          }
          throw error;
        }
      }
      
      if (!transaction) {
        throw new Error(`Transaction ${txHash} not found after ${maxRetries} attempts. Please verify:
1. Transaction hash is correct
2. Transaction is on BSC mainnet (Chain ID 56)
3. Transaction has been broadcasted to the network`);
      }
      
      if (!receipt) {
        throw new Error(`Transaction ${txHash} found but no receipt after ${maxRetries} attempts. Transaction may still be pending.`);
      }

      // Verify transaction is confirmed
      if (!receipt.status) {
        throw new Error('Transaction failed on blockchain');
      }

      return {
        from: transaction.from,
        to: transaction.to,
        value: transaction.value?.toString(),
        blockNumber: receipt.blockNumber?.toString(),
        confirmed: true,
        gasUsed: receipt.gasUsed?.toString(),
        status: receipt.status
      };
    } catch (error: any) {
      console.error('Error verifying transaction:', error);
      throw error;
    }
  }

  // Process deposit through smart contract
  async processDeposit(userWallet: string, txHash: string, amount: string): Promise<string> {
    try {
      const amountWei = this.web3.utils.toWei(amount, 'ether');
      
      const tx = await this.contract.methods.processDeposit(
        userWallet,
        txHash,
        amountWei
      ).send({
        from: this.account.address,
        gas: '200000'
      });

      return tx.transactionHash;
    } catch (error) {
      console.error('Error processing deposit:', error);
      throw error;
    }
  }

  // Process withdrawal through smart contract
  async processWithdrawal(userWallet: string, amount: string): Promise<string> {
    try {
      const amountWei = this.web3.utils.toWei(amount, 'ether');
      
      const tx = await this.contract.methods.processWithdrawal(
        userWallet,
        amountWei
      ).send({
        from: this.account.address,
        gas: '200000'
      });

      return tx.transactionHash;
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }

  // Get USDT balance of an address
  async getUSDTBalance(address: string): Promise<string> {
    try {
      const balance = await this.usdtContract.methods.balanceOf(address).call() as string;
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting USDT balance:', error);
      throw error;
    }
  }

  // Transfer USDT tokens from one address to another
  async transferUSDT(fromPrivateKey: string, toAddress: string, amount: string, nonce?: number): Promise<string> {
    try {
      // Create account from private key
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
      
      // Validate balance before transfer
      const balanceCheck = await this.validateUSDTBalance(fromAccount.address, amount);
      if (!balanceCheck.hasBalance) {
        throw new Error(`Insufficient USDT balance. Required: ${balanceCheck.required} USDT, Available: ${balanceCheck.currentBalance} USDT`);
      }
      
      console.log(`Balance validation passed: ${balanceCheck.currentBalance} USDT available for ${balanceCheck.required} USDT transfer`);
      
      // Convert amount to wei (18 decimals for USDT)
      const amountWei = this.web3.utils.toWei(amount, 'ether');
      
      // Create transfer transaction
      const transferTx = this.usdtContract.methods.transfer(toAddress, amountWei);
      
      // Estimate gas with safety buffer (use 110% of estimated gas to prevent out of gas)
      const gasEstimateRaw = await transferTx.estimateGas({ from: fromAccount.address });
      const gasEstimate = (BigInt(gasEstimateRaw) * BigInt(110) / BigInt(100)).toString();
      
      // Get optimized gas price using dynamic optimization
      const gasPrice = await this.getOptimizedGasPrice();
      
      // Get nonce - use provided nonce or fetch current
      const txNonce = nonce !== undefined ? nonce : await this.web3.eth.getTransactionCount(fromAccount.address, 'pending');
      
      console.log(`Using nonce ${txNonce} for transfer to ${toAddress}`);
      console.log(`Gas optimization: Estimate ${gasEstimateRaw} → ${gasEstimate} (+10% safety buffer), Price reduced by 20%`);
      
      // Build transaction with optimized gas settings
      const txData = {
        from: fromAccount.address,
        to: this.config.usdtContractAddress,
        data: transferTx.encodeABI(),
        gas: gasEstimate,
        gasPrice: gasPrice,
        nonce: txNonce
      };
      
      // Sign transaction
      const signedTx = await fromAccount.signTransaction(txData);
      
      // Send transaction
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
      
      console.log(`USDT transfer successful: ${amount} USDT from ${fromAccount.address} to ${toAddress}`);
      console.log(`Transaction hash: ${receipt.transactionHash}`);
      
      return receipt.transactionHash;
    } catch (error) {
      console.error('Error transferring USDT:', error);
      throw error;
    }
  }

  // Distribute deposited tokens from backend wallet to admin wallets
  async collectDepositTokens(depositAmount: string, adminFee: string): Promise<{ adminFeeTxHash: string, globalAdminTxHash: string }> {
    try {
      console.log(`Distributing deposit tokens: ${depositAmount} total, ${adminFee} fee`);
      
      // Use backend private key - the backend wallet should have received the deposit
      const backendPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      const backendAccount = this.web3.eth.accounts.privateKeyToAccount(backendPrivateKey);
      
      // Validate backend wallet has sufficient USDT for distribution
      const balanceCheck = await this.validateUSDTBalance(backendAccount.address, depositAmount);
      if (!balanceCheck.hasBalance) {
        throw new Error(`Backend wallet insufficient USDT for distribution. Required: ${depositAmount} USDT, Available: ${balanceCheck.currentBalance} USDT`);
      }
      
      // Get starting nonce for backend account
      const startingNonce = await this.web3.eth.getTransactionCount(backendAccount.address, 'pending');
      console.log(`Backend starting nonce: ${startingNonce}`);
      
      // Convert bigint to number for nonce handling
      const nonceNumber = Number(startingNonce);
      
      // Transfer admin fee to admin fee wallet (5%)
      const adminFeeTxHash = await this.transferUSDT(
        backendPrivateKey,
        this.config.adminFeeWallet,
        adminFee,
        nonceNumber
      );
      
      // Transfer remaining amount to global admin wallet (95%)
      const remainingAmount = (parseFloat(depositAmount) - parseFloat(adminFee)).toString();
      const globalAdminTxHash = await this.transferUSDT(
        backendPrivateKey,
        this.config.globalAdminWallet,
        remainingAmount,
        nonceNumber + 1
      );
      
      console.log(`Deposit distribution completed:
        - Admin fee (${adminFee} USDT) → ${this.config.adminFeeWallet}
        - Global admin (${remainingAmount} USDT) → ${this.config.globalAdminWallet}`);
      
      return {
        adminFeeTxHash,
        globalAdminTxHash
      };
    } catch (error) {
      console.error('Error distributing deposit tokens:', error);
      throw error;
    }
  }

  // Get user's private key from their wallet address
  private getUserPrivateKey(walletAddress: string): string {
    // For now, we'll use the main private key since users don't control their own keys
    // In this system, the backend controls all wallets and transfers
    // This is secure since users can't directly access the private keys
    return this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
  }

  // Process withdrawal by transferring tokens from global admin to user wallet
  async processWithdrawal(userWalletAddress: string, withdrawAmount: string, fee: string): Promise<{ withdrawalTxHash: string, feeTxHash: string }> {
    try {
      console.log(`Processing withdrawal: ${withdrawAmount} total, ${fee} fee to ${userWalletAddress}`);
      console.log(`Global admin wallet: ${this.config.globalAdminWallet}`);
      
      // Use global admin private key to send tokens
      const adminPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
      
      console.log(`Admin account address: ${adminAccount.address}`);
      console.log(`Expected global admin: ${this.config.globalAdminWallet}`);
      
      // Verify the private key corresponds to the global admin wallet
      if (adminAccount.address.toLowerCase() !== this.config.globalAdminWallet.toLowerCase()) {
        throw new Error(`Private key does not match global admin wallet. Key address: ${adminAccount.address}, Expected: ${this.config.globalAdminWallet}`);
      }
      
      // Get starting nonce for admin account
      const startingNonce = await this.web3.eth.getTransactionCount(adminAccount.address, 'pending');
      console.log(`Admin starting nonce: ${startingNonce}`);
      
      // Convert bigint to number for nonce handling
      const nonceNumber = Number(startingNonce);
      
      // Calculate net amount (withdrawal amount - fee)
      const netAmount = (parseFloat(withdrawAmount) - parseFloat(fee)).toString();
      
      // Transfer net amount to user wallet
      const withdrawalTxHash = await this.transferUSDT(
        adminPrivateKey,
        userWalletAddress,
        netAmount,
        nonceNumber
      );
      
      // Transfer fee to admin fee wallet
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
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }

  // Monitor blockchain for new transactions to user wallets
  async monitorDeposits(userAddresses: string[], callback: (tx: any) => void) {
    const subscription = await this.web3.eth.subscribe('newBlockHeaders');
    
    subscription.on('data', async (blockHeader) => {
      try {
        const block = await this.web3.eth.getBlock(blockHeader.number, true);
        
        if (block.transactions) {
          for (const tx of block.transactions) {
            if (typeof tx !== 'string' && tx.to && userAddresses.includes(tx.to.toLowerCase())) {
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
        console.error('Error monitoring deposits:', error);
      }
    });

    return subscription;
  }
}

export default BSCService;
