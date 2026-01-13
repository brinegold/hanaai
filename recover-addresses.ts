import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AddressData {
  bsc_wallet_address: string;
  bnb_balance: number;
  usdt_balance: number;
  status: string;
}

interface RecoveredAddress {
  userId: number;
  address: string;
  privateKey: string;
  bnbBalance: number;
  recoveryStatus: string;
}

interface BatchTransferResult {
  userId: number;
  address: string;
  status: string;
  txHash?: string;
  amount?: string;
  reason?: string;
  error?: string;
}

class AddressRecovery {
  private web3: Web3;
  private recoveredAddresses: RecoveredAddress[] = [];

  constructor() {
    // Use BSC testnet RPC URL
    const rpcUrl = "https://data-seed-prebsc-1-s1.binance.org:8545/";
    this.web3 = new Web3(rpcUrl);
    console.log("Address Recovery initialized with RPC:", rpcUrl);
  }

  /**
   * Generate private key from userId (same logic as BSCService)
   */
  private generatePrivateKeyFromUserId(userId: number, walletSeed: string = 'default-seed'): string {
    const seed = `${userId}-${walletSeed}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    return '0x' + hash;
  }

  /**
   * Get address from private key
   */
  private getAddressFromPrivateKey(privateKey: string): string {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    return account.address;
  }

  /**
   * Find userId for a given address by brute force search
   */
  async findUserIdForAddress(targetAddress: string, maxUserId: number = 10000): Promise<number | null> {
    console.log(`\nSearching for userId matching address ${targetAddress}...`);
    
    for (let userId = 1; userId <= maxUserId; userId++) {
      const privateKey = this.generatePrivateKeyFromUserId(userId);
      const address = this.getAddressFromPrivateKey(privateKey);
      
      if (address.toLowerCase() === targetAddress.toLowerCase()) {
        console.log(`✓ Found! Address matches userId: ${userId}`);
        return userId;
      }
      
      if (userId % 1000 === 0) {
        console.log(`  Checked ${userId} userIds...`);
      }
    }
    
    console.log(`✗ No matching userId found for address ${targetAddress}`);
    return null;
  }

  /**
   * Recover all addresses from the JSON file
   */
  async recoverAddressesFromFile(filePath: string, maxUserId: number = 10000): Promise<RecoveredAddress[]> {
    try {
      console.log(`\nReading addresses from: ${filePath}`);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const addresses: AddressData[] = JSON.parse(fileContent);
      
      console.log(`Found ${addresses.length} addresses to recover`);
      
      for (let i = 0; i < addresses.length; i++) {
        const addressData = addresses[i];
        
        // Skip addresses with 0 balance
        if (addressData.bnb_balance === 0) {
          continue;
        }
        
        console.log(`\n[${i + 1}/${addresses.length}] Processing: ${addressData.bsc_wallet_address}`);
        console.log(`  BNB Balance: ${addressData.bnb_balance}`);
        
        const userId = await this.findUserIdForAddress(addressData.bsc_wallet_address, maxUserId);
        
        if (userId !== null) {
          const privateKey = this.generatePrivateKeyFromUserId(userId);
          this.recoveredAddresses.push({
            userId,
            address: addressData.bsc_wallet_address,
            privateKey,
            bnbBalance: addressData.bnb_balance,
            recoveryStatus: 'recovered'
          });
        } else {
          this.recoveredAddresses.push({
            userId: -1,
            address: addressData.bsc_wallet_address,
            privateKey: 'NOT_FOUND',
            bnbBalance: addressData.bnb_balance,
            recoveryStatus: 'failed'
          });
        }
      }
      
      return this.recoveredAddresses;
    } catch (error) {
      console.error('Error reading addresses file:', error);
      throw error;
    }
  }

  /**
   * Save recovered addresses to a file
   */
  saveRecoveredAddresses(outputPath: string): void {
    const output = {
      recoveredAt: new Date().toISOString(),
      totalAddresses: this.recoveredAddresses.length,
      successfulRecoveries: this.recoveredAddresses.filter(a => a.recoveryStatus === 'recovered').length,
      failedRecoveries: this.recoveredAddresses.filter(a => a.recoveryStatus === 'failed').length,
      totalBNB: this.recoveredAddresses.reduce((sum, a) => sum + a.bnbBalance, 0),
      addresses: this.recoveredAddresses
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✓ Recovered addresses saved to: ${outputPath}`);
  }

  /**
   * Transfer BNB from recovered address to target address
   */
  async transferBNBFromRecoveredAddress(
    privateKey: string,
    toAddress: string,
    amount: string
  ): Promise<string> {
    try {
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(privateKey);
      const balance = await this.web3.eth.getBalance(fromAccount.address);
      const balanceInEther = this.web3.utils.fromWei(balance, 'ether');
      
      console.log(`  From: ${fromAccount.address}`);
      console.log(`  Balance: ${balanceInEther} BNB`);
      console.log(`  To: ${toAddress}`);
      console.log(`  Amount: ${amount} BNB`);
      
      if (parseFloat(balanceInEther) < parseFloat(amount)) {
        throw new Error(`Insufficient balance. Have: ${balanceInEther}, Need: ${amount}`);
      }
      
      const gasPrice = await this.web3.eth.getGasPrice();
      const nonce = await this.web3.eth.getTransactionCount(fromAccount.address, 'pending');
      
      const txData = {
        from: fromAccount.address,
        to: toAddress,
        value: this.web3.utils.toWei(amount, 'ether'),
        gas: '21000',
        gasPrice: gasPrice.toString(),
        nonce: Number(nonce)
      };
      
      const signedTx = await fromAccount.signTransaction(txData);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
      
      const txHash = typeof receipt.transactionHash === 'string' 
        ? receipt.transactionHash 
        : this.web3.utils.bytesToHex(receipt.transactionHash);
      
      console.log(`  ✓ Transfer successful: ${txHash}`);
      return txHash;
    } catch (error) {
      console.error('  ✗ Transfer failed:', error);
      throw error;
    }
  }

  /**
   * Batch transfer BNB from all recovered addresses to target address
   */
  async batchTransferBNB(toAddress: string, leaveGasFee: string = '0.0001'): Promise<BatchTransferResult[]> {
    const results: BatchTransferResult[] = [];
    const recoveredOnly = this.recoveredAddresses.filter(a => a.recoveryStatus === 'recovered');
    
    console.log(`\n\nStarting batch transfer of ${recoveredOnly.length} addresses to ${toAddress}`);
    console.log(`Leaving ${leaveGasFee} BNB for gas fees in each wallet\n`);
    
    for (let i = 0; i < recoveredOnly.length; i++) {
      const recovered = recoveredOnly[i];
      
      try {
        console.log(`[${i + 1}/${recoveredOnly.length}] Transferring from ${recovered.address}`);
        
        // Calculate amount to transfer (balance - gas fee)
        const transferAmount = Math.max(0, recovered.bnbBalance - parseFloat(leaveGasFee)).toString();
        
        if (parseFloat(transferAmount) <= 0) {
          console.log(`  Skipped: Insufficient balance after gas fee reservation`);
          results.push({
            userId: recovered.userId,
            address: recovered.address,
            status: 'skipped',
            reason: 'insufficient_balance'
          });
          continue;
        }
        
        const txHash = await this.transferBNBFromRecoveredAddress(
          recovered.privateKey,
          toAddress,
          transferAmount
        );
        
        results.push({
          userId: recovered.userId,
          address: recovered.address,
          status: 'success',
          txHash,
          amount: transferAmount
        });
        
        // Add delay between transactions
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`  ✗ Failed:`, error.message);
        results.push({
          userId: recovered.userId,
          address: recovered.address,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Print recovery summary
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('RECOVERY SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Addresses: ${this.recoveredAddresses.length}`);
    console.log(`Successfully Recovered: ${this.recoveredAddresses.filter(a => a.recoveryStatus === 'recovered').length}`);
    console.log(`Failed Recoveries: ${this.recoveredAddresses.filter(a => a.recoveryStatus === 'failed').length}`);
    console.log(`Total BNB: ${this.recoveredAddresses.reduce((sum, a) => sum + a.bnbBalance, 0).toFixed(6)}`);
    console.log('='.repeat(60) + '\n');
  }
}

// Main execution
async function main() {
  const recovery = new AddressRecovery();
  
  // Path to the addresses file
  const addressesFilePath = path.join(__dirname, 'addresses_with_balances.json');
  const outputPath = path.join(__dirname, 'recovered_addresses.json');
  
  try {
    // Step 1: Recover all addresses
    console.log('STEP 1: Recovering addresses...\n');
    await recovery.recoverAddressesFromFile(addressesFilePath);
    recovery.printSummary();
    
    // Step 2: Save recovered addresses
    console.log('STEP 2: Saving recovered addresses...');
    recovery.saveRecoveredAddresses(outputPath);
    
    // Step 3: Optional - Transfer BNB to a target address
    // Uncomment the lines below to enable batch transfer
    /*
    console.log('\nSTEP 3: Transferring BNB...');
    const targetAddress = '0xYourTargetAddressHere'; // Replace with your target address
    const transferResults = await recovery.batchTransferBNB(targetAddress);
    
    // Save transfer results
    fs.writeFileSync(
      path.join(__dirname, 'transfer_results.json'),
      JSON.stringify(transferResults, null, 2)
    );
    console.log('\n✓ Transfer results saved to transfer_results.json');
    */
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
