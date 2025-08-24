const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying PaymentProcessor contract to BSC testnet...");

  // Get the contract factory
  const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");

  // Get environment variables
  const adminFeeWallet = process.env.ADMIN_FEE_WALLET;
  const globalAdminWallet = process.env.GLOBAL_ADMIN_WALLET;
  const usdtContract = process.env.USDT_CONTRACT_ADDRESS;

  if (!adminFeeWallet || !globalAdminWallet || !usdtContract) {
    throw new Error("Missing required environment variables: ADMIN_FEE_WALLET, GLOBAL_ADMIN_WALLET, USDT_CONTRACT_ADDRESS");
  }

  console.log("Admin Fee Wallet:", adminFeeWallet);
  console.log("Global Admin Wallet:", globalAdminWallet);
  console.log("USDT Contract:", usdtContract);

  // Deploy the contract
  const paymentProcessor = await PaymentProcessor.deploy(
    adminFeeWallet,
    globalAdminWallet,
    usdtContract
  );

  await paymentProcessor.waitForDeployment();

  const contractAddress = await paymentProcessor.getAddress();
  console.log("PaymentProcessor deployed to:", contractAddress);

  // Verify contract on BSCScan (optional)
  if (process.env.BSCSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    await paymentProcessor.deploymentTransaction().wait(5);

    console.log("Verifying contract on BSCScan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [adminFeeWallet, globalAdminWallet, usdtContract],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }

  console.log("\n=== Deployment Complete ===");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Add this to your .env file:`);
  console.log(`PAYMENT_CONTRACT_ADDRESS=${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
