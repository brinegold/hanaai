const { ethers } = require("hardhat");

async function main() {
  // Replace with your deployed TestUSDT contract address
  const TEST_USDT_ADDRESS = "YOUR_TEST_USDT_CONTRACT_ADDRESS";
  
  // Replace with the address you want to mint tokens to
  const RECIPIENT_ADDRESS = "0x17b6B0942F074907E52975eD44927996F6C27e88";
  
  // Amount to mint (1000 TUSDT with 18 decimals)
  const MINT_AMOUNT = ethers.parseEther("1000");

  console.log("Minting test USDT tokens...");
  console.log("Contract:", TEST_USDT_ADDRESS);
  console.log("Recipient:", RECIPIENT_ADDRESS);
  console.log("Amount:", ethers.formatEther(MINT_AMOUNT), "TUSDT");

  // Get the contract instance
  const TestUSDT = await ethers.getContractFactory("TestUSDT");
  const testUSDT = TestUSDT.attach(TEST_USDT_ADDRESS);

  try {
    // Call the faucet function (gives 1000 TUSDT)
    console.log("\nCalling faucet function...");
    const tx = await testUSDT.faucet();
    await tx.wait();
    console.log("✅ Faucet transaction successful!");
    console.log("Transaction hash:", tx.hash);

    // Check balance
    const [signer] = await ethers.getSigners();
    const balance = await testUSDT.balanceOf(signer.address);
    console.log("Your balance:", ethers.formatEther(balance), "TUSDT");

    // Optionally mint to a specific address
    if (RECIPIENT_ADDRESS !== signer.address) {
      console.log("\nMinting additional tokens to recipient...");
      const mintTx = await testUSDT.mint(RECIPIENT_ADDRESS, MINT_AMOUNT);
      await mintTx.wait();
      console.log("✅ Mint transaction successful!");
      
      const recipientBalance = await testUSDT.balanceOf(RECIPIENT_ADDRESS);
      console.log("Recipient balance:", ethers.formatEther(recipientBalance), "TUSDT");
    }

  } catch (error) {
    console.error("❌ Error minting tokens:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
