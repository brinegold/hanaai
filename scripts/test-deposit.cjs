const { ethers } = require("hardhat");

async function main() {
  console.log("Testing deposit flow with TestUSDT...");

  // Get your wallet address
  const [signer] = await ethers.getSigners();
  console.log("Your wallet:", signer.address);

  // Connect to TestUSDT contract
  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const testUSDT = TestUSDT.attach("0x7C5FCE4f6aF59eCd7a557Fa9a7812Eaf0A4E42cb");

  try {
    // First, get some test tokens
    console.log("\n1. Getting test tokens from faucet...");
    const faucetTx = await testUSDT.faucet();
    await faucetTx.wait();
    console.log("✅ Faucet transaction:", faucetTx.hash);

    // Check balance
    const balance = await testUSDT.balanceOf(signer.address);
    console.log("Your TUSDT balance:", ethers.formatEther(balance));

    // Now send some TUSDT to a test address (simulating deposit)
    const testRecipient = "0xe808d79525FA7ac0287db6a9523B4680091e57f9"; // Your MetaMask address
    const sendAmount = ethers.parseEther("10"); // 10 TUSDT

    console.log("\n2. Sending 10 TUSDT to test address...");
    const sendTx = await testUSDT.transfer(testRecipient, sendAmount);
    await sendTx.wait();
    
    console.log("✅ Transfer transaction:", sendTx.hash);
    console.log("🎯 Use this transaction hash to test deposits!");
    console.log("📋 Transaction details:");
    console.log("  - Hash:", sendTx.hash);
    console.log("  - From:", signer.address);
    console.log("  - To:", testRecipient);
    console.log("  - Amount: 10 TUSDT");

    // Verify the transaction exists
    const receipt = await ethers.provider.getTransactionReceipt(sendTx.hash);
    console.log("  - Block:", receipt.blockNumber);
    console.log("  - Status:", receipt.status ? "Success" : "Failed");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
