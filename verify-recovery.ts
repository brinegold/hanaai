import Web3 from 'web3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Verification Script
 * Verifies that recovered addresses and private keys are correct
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

class VerifyRecovery {
  private web3: Web3;

  constructor() {
    const rpcUrl = "https://data-seed-prebsc-1-s1.binance.org:8545/";
    this.web3 = new Web3(rpcUrl);
  }

  /**
   * Verify a single recovered address
   */
  verifyAddress(
    userId: number,
    address: string,
    privateKey: string,
    walletSeed: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Verify private key format
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      errors.push(`Invalid private key format: ${privateKey}`);
    }

    // 2. Verify address format
    if (!this.web3.utils.isAddress(address)) {
      errors.push(`Invalid address format: ${address}`);
    }

    // 3. Verify private key derives to address
    try {
      const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
      if (account.address.toLowerCase() !== address.toLowerCase()) {
        errors.push(`Private key does not match address. Got: ${account.address}, Expected: ${address}`);
      }
    } catch (error: any) {
      errors.push(`Failed to derive address from private key: ${error.message}`);
    }

    // 4. Verify userId can regenerate the same private key
    try {
      const seed = `${userId}-${walletSeed}`;
      const hash = crypto.createHash('sha256').update(seed).digest('hex');
      const expectedPrivateKey = '0x' + hash;
      
      if (expectedPrivateKey !== privateKey) {
        errors.push(`Private key does not match userId. Expected: ${expectedPrivateKey}, Got: ${privateKey}`);
      }
    } catch (error: any) {
      errors.push(`Failed to regenerate private key: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify all recovered addresses
   */
  verifyAll(recoveredData: RecoveredAddressData): {
    totalChecked: number;
    valid: number;
    invalid: number;
    issues: Array<{ userId: number; address: string; errors: string[] }>;
  } {
    const issues: Array<{ userId: number; address: string; errors: string[] }> = [];
    let validCount = 0;

    console.log(`Verifying ${recoveredData.addresses.length} addresses...\n`);

    for (let i = 0; i < recoveredData.addresses.length; i++) {
      const addr = recoveredData.addresses[i];
      const result = this.verifyAddress(
        addr.userId,
        addr.address,
        addr.privateKey,
        recoveredData.walletSeed
      );

      if (result.valid) {
        validCount++;
        if ((i + 1) % 10 === 0) {
          console.log(`  ✓ Verified ${i + 1}/${recoveredData.addresses.length}`);
        }
      } else {
        issues.push({
          userId: addr.userId,
          address: addr.address,
          errors: result.errors
        });
        console.log(`  ✗ Invalid: ${addr.address}`);
      }
    }

    return {
      totalChecked: recoveredData.addresses.length,
      valid: validCount,
      invalid: issues.length,
      issues
    };
  }

  /**
   * Check balances on blockchain
   */
  async checkBalances(addresses: string[]): Promise<Array<{ address: string; balance: string }>> {
    console.log(`\nChecking BNB balances on blockchain...\n`);
    const results: Array<{ address: string; balance: string }> = [];

    for (let i = 0; i < addresses.length; i++) {
      try {
        const balance = await this.web3.eth.getBalance(addresses[i]);
        const balanceEther = this.web3.utils.fromWei(balance, 'ether');
        results.push({
          address: addresses[i],
          balance: balanceEther
        });

        if ((i + 1) % 10 === 0) {
          console.log(`  Checked ${i + 1}/${addresses.length}`);
        }
      } catch (error: any) {
        console.log(`  ✗ Error checking ${addresses[i]}: ${error.message}`);
        results.push({
          address: addresses[i],
          balance: 'error'
        });
      }
    }

    return results;
  }

  /**
   * Print verification report
   */
  printReport(
    verification: ReturnType<VerifyRecovery['verifyAll']>,
    balances?: Array<{ address: string; balance: string }>
  ): void {
    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION REPORT');
    console.log('='.repeat(80));

    console.log('\nPrivate Key Verification:');
    console.log(`  Total Checked: ${verification.totalChecked}`);
    console.log(`  ✓ Valid: ${verification.valid}`);
    console.log(`  ✗ Invalid: ${verification.invalid}`);

    if (verification.invalid > 0) {
      console.log('\nInvalid Addresses:');
      verification.issues.forEach(issue => {
        console.log(`  - ${issue.address} (UserId: ${issue.userId})`);
        issue.errors.forEach(error => {
          console.log(`    • ${error}`);
        });
      });
    }

    if (balances) {
      console.log('\nBlockchain Balance Check:');
      const validBalances = balances.filter(b => b.balance !== 'error');
      const totalBNB = validBalances.reduce((sum, b) => sum + parseFloat(b.balance || '0'), 0);
      
      console.log(`  Addresses Checked: ${balances.length}`);
      console.log(`  ✓ Successful: ${validBalances.length}`);
      console.log(`  ✗ Failed: ${balances.length - validBalances.length}`);
      console.log(`  Total BNB: ${totalBNB.toFixed(6)}`);

      // Show addresses with balance
      const withBalance = validBalances.filter(b => parseFloat(b.balance) > 0);
      if (withBalance.length > 0) {
        console.log(`\n  Addresses with BNB (${withBalance.length}):`);
        withBalance.slice(0, 5).forEach(b => {
          console.log(`    • ${b.address}: ${b.balance} BNB`);
        });
        if (withBalance.length > 5) {
          console.log(`    ... and ${withBalance.length - 5} more`);
        }
      }
    }

    console.log('='.repeat(80) + '\n');
  }
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      VERIFY RECOVERED ADDRESSES                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const verifier = new VerifyRecovery();
  const recoveredFile = path.join(__dirname, 'recovered_addresses.json');

  try {
    // Check if file exists
    if (!fs.existsSync(recoveredFile)) {
      console.error(`Error: ${recoveredFile} not found`);
      console.log('Please run quick-recover.ts first\n');
      process.exit(1);
    }

    // Load recovered data
    console.log(`Loading: ${recoveredFile}\n`);
    const content = fs.readFileSync(recoveredFile, 'utf-8');
    const recoveredData: RecoveredAddressData = JSON.parse(content);

    console.log(`Loaded ${recoveredData.totalRecovered} recovered addresses`);
    console.log(`Wallet Seed: ${recoveredData.walletSeed}`);
    console.log(`Total BNB (recorded): ${recoveredData.totalBNB.toFixed(6)}\n`);

    // Verify private keys
    console.log('STEP 1: Verifying private keys and addresses...\n');
    const verification = verifier.verifyAll(recoveredData);

    // Check balances (optional)
    let balances: Array<{ address: string; balance: string }> | undefined;
    const checkBalances = process.argv.includes('--check-balances');
    
    if (checkBalances) {
      console.log('\nSTEP 2: Checking balances on blockchain...');
      const addresses = recoveredData.addresses.map(a => a.address);
      balances = await verifier.checkBalances(addresses);
    }

    // Print report
    verifier.printReport(verification, balances);

    // Summary
    if (verification.invalid === 0) {
      console.log('✓ All addresses verified successfully!\n');
    } else {
      console.log(`⚠ ${verification.invalid} addresses have issues\n`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Usage
console.log(`
USAGE:
  npx ts-node verify-recovery.ts              # Verify private keys only
  npx ts-node verify-recovery.ts --check-balances  # Also check blockchain balances

This script verifies:
  1. Private key format
  2. Address format
  3. Private key → Address derivation
  4. UserId → Private key regeneration
  5. (Optional) Blockchain balances

`);

main().catch(console.error);
