const { ethers } = require("hardhat");
const crypto = require("crypto");

async function generateWallet() {
  console.log("Generating new BSC wallet...\n");

  // Method 1: Using ethers.js
  const wallet = ethers.Wallet.createRandom();
  
  console.log("=== New BSC Wallet Generated ===");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("Mnemonic:", wallet.mnemonic.phrase);
  
  // Method 2: Using crypto for just private key
  const randomBytes = crypto.randomBytes(32);
  const privateKey2 = "0x" + randomBytes.toString('hex');
  const wallet2 = new ethers.Wallet(privateKey2);
  
  console.log("\n=== Alternative Wallet ===");
  console.log("Address:", wallet2.address);
  console.log("Private Key:", privateKey2);
  
  console.log("\n=== Add to your .env file ===");
  console.log(`BSC_PRIVATE_KEY=${wallet.privateKey.slice(2)}`); // Remove 0x prefix
  console.log(`# Corresponding address: ${wallet.address}`);
  
  console.log("\n⚠️  SECURITY WARNING:");
  console.log("- Keep this private key secure and never share it");
  console.log("- Add some BSC testnet BNB to this address for gas fees");
  console.log("- You can get testnet BNB from: https://testnet.binance.org/faucet-smart");
}

generateWallet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
