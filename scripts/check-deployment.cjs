const { ethers } = require("hardhat");

async function main() {
  console.log("Checking deployment information...");

  // Get the contract address from environment
  const contractAddress = process.env.PAYMENT_CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.log("❌ PAYMENT_CONTRACT_ADDRESS not found in environment variables");
    console.log("Please check your .env file");
    return;
  }

  console.log("Contract address from .env:", contractAddress);
  console.log("Network:", hre.network.name);

  // Get current signer
  const [signer] = await ethers.getSigners();
  console.log("Current signer address:", signer.address);

  try {
    // Check if there's code at the address
    const code = await ethers.provider.getCode(contractAddress);
    
    if (code === "0x") {
      console.log("❌ No contract found at this address");
      console.log("This could mean:");
      console.log("1. Contract not deployed on this network");
      console.log("2. Wrong contract address");
      console.log("3. Contract was self-destructed");
      
      // Check if it's an EOA with balance
      const balance = await ethers.provider.getBalance(contractAddress);
      if (balance > 0) {
        console.log(`💰 Address has balance: ${ethers.formatEther(balance)} ETH`);
        console.log("This appears to be an externally owned account (wallet), not a contract");
      }
      return;
    }

    console.log("✅ Contract found at address");
    console.log("Contract bytecode length:", code.length);

    // Try to interact with the contract
    const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
    const contract = PaymentProcessor.attach(contractAddress);

    try {
      const owner = await contract.owner();
      console.log("✅ Contract owner:", owner);
      
      const adminFeeWallet = await contract.adminFeeWallet();
      console.log("Admin fee wallet:", adminFeeWallet);
      
      const globalAdminWallet = await contract.globalAdminWallet();
      console.log("Global admin wallet:", globalAdminWallet);
      
      const usdtToken = await contract.usdtToken();
      console.log("USDT token address:", usdtToken);
      
    } catch (error) {
      console.log("❌ Error reading contract state:", error.message);
      console.log("The contract might not be a PaymentProcessor contract");
    }

  } catch (error) {
    console.error("Error checking deployment:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
