import Web3 from 'web3';
import fs from 'fs';

const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545/');

async function checkBalances() {
  const recoveredFile = 'recovered_addresses.json';
  const content = fs.readFileSync(recoveredFile, 'utf-8');
  const data = JSON.parse(content);

  console.log('Checking actual blockchain balances...\n');
  
  let totalBNB = 0;
  let addressesWithBalance = 0;
  let addressesWithoutBalance = 0;

  // Check first 10 addresses
  for (let i = 0; i < Math.min(10, data.addresses.length); i++) {
    const addr = data.addresses[i];
    try {
      const balance = await web3.eth.getBalance(addr.address);
      const balanceEther = web3.utils.fromWei(balance, 'ether');
      
      console.log(`[${i + 1}] ${addr.address}`);
      console.log(`    File says: ${addr.bnbBalance} BNB`);
      console.log(`    Blockchain: ${balanceEther} BNB`);
      
      if (parseFloat(balanceEther) > 0) {
        addressesWithBalance++;
        totalBNB += parseFloat(balanceEther);
      } else {
        addressesWithoutBalance++;
      }
      console.log();
    } catch (error: any) {
      console.log(`[${i + 1}] Error checking ${addr.address}: ${error.message}\n`);
    }
  }

  console.log('Summary of first 10 addresses:');
  console.log(`Addresses with BNB: ${addressesWithBalance}`);
  console.log(`Addresses without BNB: ${addressesWithoutBalance}`);
  console.log(`Total BNB found: ${totalBNB.toFixed(6)}`);
}

checkBalances().catch(console.error);
