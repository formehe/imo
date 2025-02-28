const hre = require("hardhat");

async function main() {
    // token
    const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    const erc20Sample = await ERC20Sample.deploy();
    await erc20Sample.deployed();
    console.log("ERC20Sample is :", erc20Sample.address)
    console.log("Transaction hash :", erc20Sample.deployTransaction.hash)

    // internal swap
    const InternalFactory = await ethers.getContractFactory("InternalFactory");
    const internalFactory = await InternalFactory.deploy();
    await internalFactory.deployed();
    console.log("InternalFactory is :", internalFactory.address)
    console.log("Transaction hash :", internalFactory.deployTransaction.hash)

    const InternalRouter = await ethers.getContractFactory("InternalRouter");
    const internalRouter = await InternalRouter.deploy();
    await internalRouter.deployed();
    console.log("InternalRouter is :", internalRouter.address)
    console.log("Transaction hash :", internalRouter.deployTransaction.hash)
    await internalRouter.initialize(internalFactory.address, erc20Sample.address)

    // model token template
    const ModelToken = await ethers.getContractFactory("ModelToken");
    const modelToken = await ModelToken.deploy();
    await modelToken.deployed();
    console.log("ModelToken is :", modelToken.address)
    console.log("Transaction hash :", modelToken.deployTransaction.hash)

    const ModelLockToken = await ethers.getContractFactory("ModelLockToken");
    const modelLockToken = await ModelLockToken.deploy();
    await modelLockToken.deployed();
    console.log("ModelLockToken is :", modelLockToken.address)
    console.log("Transaction hash :", modelLockToken.deployTransaction.hash)    
    
    const ModelFactory = await ethers.getContractFactory("ModelFactory");
    const modelFactory = await ModelFactory.deploy();
    await modelFactory.deployed();
    console.log("ModelFactory is :", modelFactory.address)
    console.log("Transaction hash :", modelFactory.deployTransaction.hash)

    // imo platform entry
    const IMOEntry = await ethers.getContractFactory("IMOEntry");
    const imoEntry = await IMOEntry.deploy();
    await imoEntry.deployed();
    console.log("IMOEntry is :", imoEntry.address)
    console.log("Transaction hash :", imoEntry.deployTransaction.hash)

    await internalFactory.initialize(imoEntry.address /*address taxVault_*/, 1 /* %, uint256 buyTax_ */, 1 /*%， uint256 sellTax_*/)
    await modelFactory.initialize(modelToken.address, modelLockToken.address, erc20Sample.address, 1, 1)

    // await imoEntry.initialize(internalFactory.address, internalRouter.address, imoEntry.address/*address feeTo_*/, 500/** 10 **12 */, 
    //       1000000000/* uint256 initialSupply_ */, uint256 assetRate_, 50 /*%,uint256 maxTx_*/, modelFactory.address, uint256 gradThreshold_)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});