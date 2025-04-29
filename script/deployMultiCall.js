const toWei = (val) => ethers.utils.parseEther("" + val);

async function main() {    
    const MultiCall = await ethers.getContractFactory("Multicall");
    const multiCall= await MultiCall.deploy();
    await multiCall.deployed();
    console.log("multiCall is :", multiCall.address)
    console.log("Transaction hash :", multiCall.deployTransaction.hash)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});