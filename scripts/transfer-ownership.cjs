const { ethers } = require("hardhat");

async function main() {
  console.log("Starting ownership transfer process...");

  // Get environment variables
  const contractAddress = "0x802dcd60eD5402614Ed55AfeA4D607765C20D1ee";
  const newOwnerAddress = "0xb6bEb0D01eeD9Df0dFdD645a9C6639F98eA6782e";

  if (!contractAddress) {
    throw new Error("Missing PAYMENT_CONTRACT_ADDRESS in environment variables");
  }

  if (!newOwnerAddress) {
    throw new Error("Missing NEW_OWNER_ADDRESS in environment variables");
  }

  // Validate new owner address
  if (!ethers.isAddress(newOwnerAddress)) {
    throw new Error("Invalid NEW_OWNER_ADDRESS format");
  }

  // Get the current signer (must be current owner)
  const [currentOwner] = await ethers.getSigners();
  console.log("Current owner address:", currentOwner.address);
  console.log("New owner address:", newOwnerAddress);

  // Get contract instance
  const PaymentProcessor = await ethers.getContractFactory("PaymentProcessor");
  const paymentProcessor = PaymentProcessor.attach(contractAddress);

  // Verify contract exists and check current owner
  try {
    // First check if there's code at the address
    const code = await ethers.provider.getCode(contractAddress);
    if (code === "0x") {
      throw new Error(`No contract found at address ${contractAddress}. Please verify the contract address and network.`);
    }
    console.log("✅ Contract found at address");
    
    const currentContractOwner = await paymentProcessor.owner();
    console.log("Contract's current owner:", currentContractOwner);
    
    if (currentContractOwner.toLowerCase() !== currentOwner.address.toLowerCase()) {
      throw new Error(`Signer (${currentOwner.address}) is not the contract owner (${currentContractOwner})`);
    }
  } catch (error) {
    console.error("Error checking current owner:", error.message);
    throw error;
  }

  // Confirm transfer
  console.log("\n⚠️  WARNING: This action is IRREVERSIBLE!");
  console.log(`You are about to transfer ownership from ${currentOwner.address} to ${newOwnerAddress}`);
  console.log("After this transfer, you will lose all owner privileges.");
  
  // In a real scenario, you might want to add a confirmation prompt here
  // For now, we'll proceed with the transfer
  
  try {
    console.log("\nTransferring ownership...");
    const tx = await paymentProcessor.transferOwnership(newOwnerAddress);
    console.log("Transaction hash:", tx.hash);
    
    console.log("Waiting for transaction confirmation...");
    await tx.wait();
    
    // Verify the transfer
    const newContractOwner = await paymentProcessor.owner();
    console.log("\n✅ Ownership transfer completed!");
    console.log("New contract owner:", newContractOwner);
    
    if (newContractOwner.toLowerCase() === newOwnerAddress.toLowerCase()) {
      console.log("✅ Ownership transfer verified successfully!");
    } else {
      console.log("❌ Ownership transfer verification failed!");
    }
    
  } catch (error) {
    console.error("Error during ownership transfer:", error.message);
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n=== Ownership Transfer Complete ===");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Ownership transfer failed:");
    console.error(error);
    process.exit(1);
  });
