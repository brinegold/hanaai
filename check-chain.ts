import Web3 from 'web3';

async function checkChain() {
  const rpcs = [
    { name: 's1', url: 'https://data-seed-prebsc-1-s1.binance.org:8545/' },
    { name: 's3', url: 'https://data-seed-prebsc-1-s3.binance.org:8545/' },
    { name: 'public', url: 'https://bsc-testnet.publicnode.com' },
  ];

  console.log('Checking chain IDs...\n');

  for (const rpc of rpcs) {
    try {
      const web3 = new Web3(rpc.url);
      const chainId = await web3.eth.getChainId();
      const blockNumber = await web3.eth.getBlockNumber();
      console.log(`${rpc.name.padEnd(10)} - Chain ID: ${chainId}, Block: ${blockNumber}`);
    } catch (error: any) {
      console.log(`${rpc.name.padEnd(10)} - Error: ${error.message}`);
    }
  }
}

checkChain().catch(console.error);
