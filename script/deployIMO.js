const { deployAndCloneContract } = require("../tests/utils")
async function main() {
    [owner] = await ethers.getSigners();

    const UNISWAP_ROUTER = "0x626459cF9438259ed0812D71650568306486CB00";
    const AI_MODELS = "0x13c9447432C6E06503F446d593Cc50aC5C0195A0";
    const BUY_TAX = 1; //%, internal swap tax
    const SELL_TAX = 1; //%, internal swap tax
    const MATURITY_DURATION = 315360000;// 10 years
    let   assetAddress;
    let   tokenAdmin = owner.address;
    //address taxVault_ = //

    // token
    // const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    // const erc20Sample = await ERC20Sample.deploy("Asset Token", "ASSET");
    // await erc20Sample.deployed();
    // console.log("ERC20Sample is :", erc20Sample.address)
    // console.log("Transaction hash :", erc20Sample.deployTransaction.hash)
    assetAddress = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"

    // internal swap
    // internal factory
    const InternalFactoryTemplate = await ethers.getContractFactory("InternalFactory");
    const internalFactoryTemplate = await InternalFactoryTemplate.deploy();
    await internalFactoryTemplate.deployed();
    console.log("InternalFactoryTemplate is :", internalFactoryTemplate.address)
    console.log("Transaction hash :", internalFactoryTemplate.deployTransaction.hash)
    let clonedContractAddress = await deployAndCloneContract(ethers, internalFactoryTemplate.address)
    internalFactory = await ethers.getContractAt("InternalFactory", clonedContractAddress);
    console.log("InternalFactory is :", clonedContractAddress)

    // internal router
    const InternalRouterTemplate = await ethers.getContractFactory("InternalRouter");
    const internalRouterTemplate = await InternalRouterTemplate.deploy();
    await internalRouterTemplate.deployed();
    console.log("InternalRouterTemplate is :", internalRouterTemplate.address)
    console.log("Transaction hash :", internalRouterTemplate.deployTransaction.hash)
    clonedContractAddress = await deployAndCloneContract(ethers, internalRouterTemplate.address)
    internalRouter = await ethers.getContractAt("InternalRouter", clonedContractAddress);
    console.log("InternalRouter is :", clonedContractAddress)

    // model token template
    const ModelTokenTemplate = await ethers.getContractFactory("ModelToken");
    modelTokenTemplate = await ModelTokenTemplate.deploy();
    await modelTokenTemplate.deployed();
    console.log("ModelTokenTempalte is :", modelTokenTemplate.address)
    console.log("Transaction hash :", modelTokenTemplate.deployTransaction.hash)
    clonedContractAddress = await deployAndCloneContract(ethers, modelTokenTemplate.address);
    modelToken = await ethers.getContractAt("ModelToken", clonedContractAddress);
    console.log("ModelToken is :", clonedContractAddress)

    const ModelLockTokenTemplate = await ethers.getContractFactory("ModelLockToken");
    modelLockTokenTemplate = await ModelLockTokenTemplate.deploy();
    await modelLockTokenTemplate.deployed();
    console.log("ModelLockTokenTempalte is :", modelLockTokenTemplate.address)
    console.log("Transaction hash :", modelLockTokenTemplate.deployTransaction.hash)
    clonedContractAddress = await deployAndCloneContract(ethers, modelLockTokenTemplate.address);
    modelLockToken = await ethers.getContractAt("ModelLockToken", clonedContractAddress);
    console.log("ModelLockToken is :", clonedContractAddress)

    const ModelFactoryTemplate = await ethers.getContractFactory("ModelFactory");
    modelFactoryTemplate = await ModelFactoryTemplate.deploy();
    await modelFactoryTemplate.deployed();
    console.log("ModelFactoryTemplate is :", modelFactoryTemplate.address)
    console.log("Transaction hash :", modelFactoryTemplate.deployTransaction.hash)
    clonedContractAddress = await deployAndCloneContract(ethers, modelFactoryTemplate.address);
    modelFactory = await ethers.getContractAt("ModelFactory", clonedContractAddress);
    console.log("ModelFactory is :", clonedContractAddress)

    // imo platform entry
    const IMOEntryTemplate = await ethers.getContractFactory("IMOEntry");
    imoEntryTemplate = await IMOEntryTemplate.deploy();
    await imoEntryTemplate.deployed();
    console.log("IMOEntryTemplate is :", imoEntryTemplate.address)
    console.log("Transaction hash :", imoEntryTemplate.deployTransaction.hash)
    clonedContractAddress = await deployAndCloneContract(ethers, imoEntryTemplate.address);
    imoEntry = await ethers.getContractAt("IMOEntry", clonedContractAddress);
    console.log("IMOEntry is :", clonedContractAddress)

    // configure erc20 asset

    // configure internal factory
    await internalFactory.initialize(imoEntry.address /*address taxVault_*/, BUY_TAX, SELL_TAX)
    await internalFactory.grantRole(await internalFactory.CREATOR_ROLE(), imoEntry.address)
    await internalFactory.grantRole(await internalFactory.ADMIN_ROLE(), owner.address)
    await internalFactory.connect(owner).setRouter(internalRouter.address)
    
    // configure internal router
    await internalRouter.initialize(internalFactory.address, assetAddress)
    await internalRouter.grantRole(await internalRouter.EXECUTOR_ROLE(), imoEntry.address)

    // configure model factory
    await modelFactory.initialize(modelToken.address, modelLockToken.address, assetAddress, 1/* next id */)
    await modelFactory.grantRole(await modelFactory.BONDING_ROLE(), imoEntry.address)
    await modelFactory.setTokenAdmin(tokenAdmin)
    await modelFactory.setUniswapRouter(UNISWAP_ROUTER)
    await modelFactory.setTokenTaxParams(0, 0, 0) // set extra external swap tax
    await modelFactory.setMaturityDuration(MATURITY_DURATION) //set 10 years of initial asset lock time

    // configure IMOEntry
    await imoEntry.initialize(
      internalFactory.address, 
      internalRouter.address, 
      imoEntry.address /*address feeTo_*/, 
      500 /** fee 10 **12 */, 
      1000000000 /* uint256 initialSupply_ */, 
      30000 /*uint256 assetRate_, 100 top -> 10^12 liquid K*/,
      50 /* %,uint256 maxTx_ */, 
      modelFactory.address, 
      ethers.utils.parseEther("1000000"),// gradThreshold
      UNISWAP_ROUTER,
      AI_MODELS
    )
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});