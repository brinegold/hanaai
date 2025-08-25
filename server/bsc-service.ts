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
    this.web3 = new Web3(config.rpcUrl);
    // Ensure private key has 0x prefix
    const privateKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`;
    this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    this.web3.eth.accounts.wallet.add(this.account);
    
    // Initialize contracts
    this.initializeContracts();
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
      const transaction = await this.web3.eth.getTransaction(txHash);
      const receipt = await this.web3.eth.getTransactionReceipt(txHash);
      
      if (!transaction || !receipt) {
        throw new Error('Transaction not found');
      }

      // Verify transaction is confirmed
      if (!receipt.status) {
        throw new Error('Transaction failed');
      }

      return {
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        blockNumber: receipt.blockNumber,
        confirmed: true
      };
    } catch (error) {
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
