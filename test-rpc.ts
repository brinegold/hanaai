import Web3 from 'web3';

async function testRPCs() {
  const address = '0xF0E07d18f3b2A976EaadfD13046Fb56b842ea82b';
  
  const rpcs = [
    { name: 's1', url: 'https://data-seed-prebsc-1-s1.binance.org:8545/' },
    { name: 's2', url: 'https://data-seed-prebsc-1-s2.binance.org:8545/' },
    { name: 's3', url: 'https://data-seed-prebsc-1-s3.binance.org:8545/' },
    { name: 'public', url: 'https://bsc-testnet.publicnode.com' },
  ];

  console.log(`Testing balance for: ${address}\n`);

  for (const rpc of rpcs) {
    try {
      const web3 = new Web3(rpc.url);
      const balance = await web3.eth.getBalance(address);
      const balanceEther = web3.utils.fromWei(balance, 'ether');
      console.log(`${rpc.name.padEnd(10)} - Balance: ${balanceEther} BNB`);
    } catch (error: any) {
      console.log(`${rpc.name.padEnd(10)} - Error: ${error.message}`);
    }
  }
}

testRPCs().catch(console.error);
