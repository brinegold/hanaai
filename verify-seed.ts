import Web3 from 'web3';
import crypto from 'crypto';
import fs from 'fs';

const web3 = new Web3();

// Test with first recovered address
const recoveredFile = 'recovered_addresses.json';
const content = fs.readFileSync(recoveredFile, 'utf-8');
const data = JSON.parse(content);

const firstAddress = data.addresses[0];
console.log('Testing first recovered address:\n');
console.log('UserId:', firstAddress.userId);
console.log('Address from file:', firstAddress.address);
console.log('PrivateKey from file:', firstAddress.privateKey);

// Regenerate using the seed
const seed = `${firstAddress.userId}-hi-mother`;
const hash = crypto.createHash('sha256').update(seed).digest('hex');
const regeneratedPrivateKey = '0x' + hash;
const account = web3.eth.accounts.privateKeyToAccount(regeneratedPrivateKey);

console.log('\nRegenerated from seed "hi-mother":');
console.log('Seed:', seed);
console.log('Hash:', '0x' + hash);
console.log('Regenerated PrivateKey:', regeneratedPrivateKey);
console.log('Regenerated Address:', account.address);

console.log('\nComparison:');
console.log('Private keys match:', firstAddress.privateKey === regeneratedPrivateKey);
console.log('Addresses match:', firstAddress.address.toLowerCase() === account.address.toLowerCase());

// Verify the private key actually derives to the address
const verifyAccount = web3.eth.accounts.privateKeyToAccount(firstAddress.privateKey);
console.log('\nVerifying recovered private key:');
console.log('Derived address from recovered key:', verifyAccount.address);
console.log('Matches file address:', verifyAccount.address.toLowerCase() === firstAddress.address.toLowerCase());
