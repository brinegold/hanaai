const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying TestUSDT contract to BSC testnet...");

  // Get the contract factory
  const TestUSDT = await ethers.getContractFactory("TestUSDT");

  // Deploy the contract
  const testUSDT = await TestUSDT.deploy();
  await testUSDT.waitForDeployment();

  const contractAddress = await testUSDT.getAddress();
  console.log("TestUSDT deployed to:", contractAddress);

  // Mint some initial tokens to the deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  // Check initial balance
  const balance = await testUSDT.balanceOf(deployer.address);
  console.log("Initial balance:", ethers.formatEther(balance), "TUSDT");

  console.log("\n=== Deployment Complete ===");
  console.log("TestUSDT Contract Address:", contractAddress);
  console.log("Add this to your .env file:");
  console.log(`USDT_CONTRACT_ADDRESS=${contractAddress}`);
  
  console.log("\n=== How to get test tokens ===");
  console.log("1. Call the faucet() function to get 1000 TUSDT");
  console.log("2. Or use mint(address, amount) to mint tokens to any address");
  console.log("3. Contract has 18 decimals like real USDT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
