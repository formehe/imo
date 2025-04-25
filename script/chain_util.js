// scripts/blockNumber.js
const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const user = owner.address
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("Latest block number:", blockNumber);

  const balanceWei = await ethers.provider.getBalance(user);

  console.log(`Address: ${user}`);
  console.log(`Balance: ${balanceWei} TOP`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});