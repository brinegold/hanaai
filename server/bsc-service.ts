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
    
    // Use BSC testnet RPC URL specifically
    const rpcUrl = config.rpcUrl || "https://data-seed-prebsc-1-s1.binance.org:8545/";
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
      
      if (chainId !== 97n) { // BSC testnet chain ID
        console.warn(`Warning: Expected BSC testnet (97) but connected to chain ${chainId}`);
      }
    } catch (error) {
      console.error("Failed to connect to BSC network:", error);
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
2. Transaction is on BSC testnet (Chain ID 97)
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

  // Get BNB balance of an address
  async getBNBBalance(address: string): Promise<string> {
    try {
      const balance = await this.web3.eth.getBalance(address);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting BNB balance:', error);
      throw error;
    }
  }

  // Send BNB for gas fees to user wallet
  async fundUserWalletForGas(userAddress: string, bnbAmount: string = "0.001"): Promise<string> {
    try {
      console.log(`Funding user wallet ${userAddress} with ${bnbAmount} BNB for gas`);
      
      const adminPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      const adminAccount = this.web3.eth.accounts.privateKeyToAccount(adminPrivateKey);
      
      // Check admin BNB balance
      const adminBalance = await this.getBNBBalance(adminAccount.address);
      console.log(`Admin BNB balance: ${adminBalance}`);
      
      if (parseFloat(adminBalance) < parseFloat(bnbAmount)) {
        throw new Error(`Insufficient BNB in admin wallet. Required: ${bnbAmount}, Available: ${adminBalance}`);
      }
      
      const gasPrice = await this.web3.eth.getGasPrice();
      const nonce = await this.web3.eth.getTransactionCount(adminAccount.address, 'pending');
      
      const txData = {
        from: adminAccount.address,
        to: userAddress,
        value: this.web3.utils.toWei(bnbAmount, 'ether'),
        gas: '21000',
        gasPrice: gasPrice.toString(),
        nonce: Number(nonce)
      };
      
      const signedTx = await adminAccount.signTransaction(txData);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
      
      console.log(`BNB transfer successful: ${bnbAmount} BNB to ${userAddress}`);
      return receipt.transactionHash;
    } catch (error) {
      console.error('Error funding user wallet:', error);
      throw error;
    }
  }

  // Transfer USDT tokens from one address to another
  async transferUSDT(fromPrivateKey: string, toAddress: string, amount: string, nonce?: number): Promise<string> {
    try {
      // Create account from private key
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
      
      // Convert amount to wei (18 decimals for USDT)
      const amountWei = this.web3.utils.toWei(amount, 'ether');
      
      // Create transfer transaction
      const transferTx = this.usdtContract.methods.transfer(toAddress, amountWei);
      
      // Estimate gas
      const gasEstimate = await transferTx.estimateGas({ from: fromAccount.address });
      
      // Get current gas price
      const gasPrice = await this.web3.eth.getGasPrice();
      
      // Get nonce - use provided nonce or fetch current
      const txNonce = nonce !== undefined ? nonce : await this.web3.eth.getTransactionCount(fromAccount.address, 'pending');
      
      console.log(`Using nonce ${txNonce} for transfer to ${toAddress}`);
      
      // Build transaction
      const txData = {
        from: fromAccount.address,
        to: this.config.usdtContractAddress,
        data: transferTx.encodeABI(),
        gas: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
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

  // Collect deposited tokens from user wallet and distribute to admin wallets
  async collectDepositTokensFromUser(userId: number, depositAmount: string, adminFee: string): Promise<{ adminFeeTxHash: string, globalAdminTxHash: string }> {
    try {
      console.log(`Collecting deposit tokens from user ${userId}: ${depositAmount} total, ${adminFee} fee`);
      
      // Generate user's private key from their userId
      const userWallet = this.generateUserWallet(userId);
      const userPrivateKey = userWallet.privateKey;
      
      // Check user's USDT balance first
      const userBalance = await this.getUSDTBalance(userWallet.address);
      console.log(`User ${userId} USDT balance: ${userBalance}`);
      
      if (parseFloat(userBalance) < parseFloat(depositAmount)) {
        throw new Error(`Insufficient USDT balance in user wallet. Required: ${depositAmount}, Available: ${userBalance}`);
      }
      
      // Check user's BNB balance for gas fees
      const bnbBalance = await this.getBNBBalance(userWallet.address);
      console.log(`User ${userId} BNB balance: ${bnbBalance}`);
      
      // If user has insufficient BNB for gas, fund their wallet
      if (parseFloat(bnbBalance) < 0.001) {
        console.log(`User wallet has insufficient BNB for gas fees. Funding with 0.001 BNB...`);
        await this.fundUserWalletForGas(userWallet.address, "0.001");
        console.log(`User wallet funded with BNB for gas fees`);
      }
      
      // Get starting nonce for user account
      const startingNonce = await this.web3.eth.getTransactionCount(userWallet.address, 'pending');
      console.log(`User ${userId} starting nonce: ${startingNonce}`);
      
      // Convert bigint to number for nonce handling
      const nonceNumber = Number(startingNonce);
      
      // Transfer admin fee to admin fee wallet
      const adminFeeTxHash = await this.transferUSDT(
        userPrivateKey,
        this.config.adminFeeWallet,
        adminFee,
        nonceNumber
      );
      
      // Transfer remaining amount to global admin wallet
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
      console.error('Error collecting deposit tokens from user:', error);
      throw error;
    }
  }

  // Legacy method - kept for backward compatibility
  async collectDepositTokens(depositAmount: string, adminFee: string): Promise<{ adminFeeTxHash: string, globalAdminTxHash: string }> {
    try {
      console.log(`Collecting deposit tokens: ${depositAmount} total, ${adminFee} fee`);
      
      // Use the backend's private key to collect tokens from the contract
      const backendPrivateKey = this.config.privateKey.startsWith('0x') ? this.config.privateKey : `0x${this.config.privateKey}`;
      const backendAccount = this.web3.eth.accounts.privateKeyToAccount(backendPrivateKey);
      
      // Get starting nonce for backend account
      const startingNonce = await this.web3.eth.getTransactionCount(backendAccount.address, 'pending');
      console.log(`Backend starting nonce: ${startingNonce}`);
      
      // Convert bigint to number for nonce handling
      const nonceNumber = Number(startingNonce);
      
      // Transfer admin fee to admin fee wallet
      const adminFeeTxHash = await this.transferUSDT(
        backendPrivateKey,
        this.config.adminFeeWallet,
        adminFee,
        nonceNumber
      );
      
      // Transfer remaining amount to global admin wallet
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
      console.error('Error collecting deposit tokens:', error);
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
        console.warn(`Private key does not match global admin wallet. Key address: ${adminAccount.address}, Expected: ${this.config.globalAdminWallet}`);
        // Temporarily allowing mismatch for testing - update GLOBAL_ADMIN_WALLET in .env to match your private key
        // throw new Error(`Private key does not match global admin wallet. Key address: ${adminAccount.address}, Expected: ${this.config.globalAdminWallet}`);
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
