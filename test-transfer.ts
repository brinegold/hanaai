import Web3 from 'web3';
import crypto from 'crypto';

const web3 = new Web3('https://bsc-dataseed.binance.org/');

async function testTransfer() {
  // Use first address from recovery
  const userId = 22;
  const seed = `${userId}-hi-mother`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const privateKey = '0x' + hash;
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);

  console.log('Testing BNB transfer...\n');
  console.log('From Address:', account.address);
  console.log('Private Key:', privateKey);

  try {
    // Check balance
    const balance = await web3.eth.getBalance(account.address);
    const balanceEther = web3.utils.fromWei(balance, 'ether');
    console.log('Balance on chain:', balanceEther, 'BNB');

    // Get nonce
    const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
    console.log('Nonce:', nonce);

    // Get gas price
    const gasPrice = await web3.eth.getGasPrice();
    console.log('Gas Price:', web3.utils.fromWei(gasPrice, 'gwei'), 'Gwei');

    // Target address
    const toAddress = '0x17b6B0942F074907E52975eD44927996F6C27e88';
    const amount = '0.0008'; // 0.0009 - 0.0001 gas reserve

    console.log('\nTransaction Details:');
    console.log('To:', toAddress);
    console.log('Amount:', amount, 'BNB');

    // Build transaction
    const txData = {
      from: account.address,
      to: toAddress,
      value: web3.utils.toWei(amount, 'ether'),
      gas: '21000',
      gasPrice: gasPrice.toString(),
      nonce: Number(nonce)
    };

    console.log('\nSigning transaction...');
    const signedTx = await account.signTransaction(txData);
    console.log('Signed. Raw TX:', signedTx.rawTransaction?.substring(0, 50) + '...');

    console.log('\nSending transaction...');
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction as string);
    
    console.log('\n✓ Transfer successful!');
    console.log('Transaction Hash:', receipt.transactionHash);
    console.log('Block Number:', receipt.blockNumber);
    console.log('Gas Used:', receipt.gasUsed);

  } catch (error: any) {
    console.error('\n✗ Transfer failed:');
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Data:', error.data);
    }
  }
}

testTransfer().catch(console.error);
