const { expect } = require("chai");
const { ethers,  UniswapV2Deployer} = require("hardhat");
const { deployAndCloneContract } = require("./utils")
const { AddressZero } = require("ethers").constants;
describe("IMOEntry Contract", function () {
  let imoEntry, internalFactory, internalRouter, aiModels, modelFactory;
  let owner, addr1, admin, feeTo;
  let assetToken;
  let decimal;
  let UNISWAP_ROUTER;

  beforeEach(async function () {
    [owner, addr1, admin, feeTo, withdrawer] = await ethers.getSigners();

    const { factory, router, weth9 } = await UniswapV2Deployer.deploy(owner);
    UNISWAP_ROUTER = router.address;

    // token
    const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    assetToken = await ERC20Sample.deploy("Asset Token", "ASSET");
    await assetToken.deployed();

    decimal = await assetToken.decimals()

    const AIModels = await ethers.getContractFactory("AIModels");
    aiModels = await AIModels.deploy(addr1.address, admin.address)
    await aiModels.deployed();

    // internal swap
    // internal factory
    const InternalFactoryTemplate = await ethers.getContractFactory("InternalFactory");
    const internalFactoryTemplate = await InternalFactoryTemplate.deploy();
    await internalFactoryTemplate.deployed();
    let clonedContractAddress = await deployAndCloneContract(ethers, internalFactoryTemplate.address)
    internalFactory = await ethers.getContractAt("InternalFactory", clonedContractAddress);

    // internal router
    const InternalRouterTemplate = await ethers.getContractFactory("InternalRouter");
    const internalRouterTemplate = await InternalRouterTemplate.deploy();
    await internalRouterTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, internalRouterTemplate.address)
    internalRouter = await ethers.getContractAt("InternalRouter", clonedContractAddress);

    // model token template
    const ModelTokenTemplate = await ethers.getContractFactory("ModelToken");
    modelTokenTemplate = await ModelTokenTemplate.deploy();
    await modelTokenTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, modelTokenTemplate.address);
    const modelToken = await ethers.getContractAt("ModelToken", clonedContractAddress);

    const ModelLockTokenTemplate = await ethers.getContractFactory("ModelLockToken");
    modelLockTokenTemplate = await ModelLockTokenTemplate.deploy();
    await modelLockTokenTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, modelLockTokenTemplate.address);
    const modelLockToken = await ethers.getContractAt("ModelLockToken", clonedContractAddress);

    const ModelFactoryTemplate = await ethers.getContractFactory("ModelFactory");
    modelFactoryTemplate = await ModelFactoryTemplate.deploy();
    await modelFactoryTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, modelFactoryTemplate.address);
    modelFactory = await ethers.getContractAt("ModelFactory", clonedContractAddress);

    // imo platform entry
    const IMOEntryTemplate = await ethers.getContractFactory("IMOEntry");
    imoEntryTemplate = await IMOEntryTemplate.deploy();
    await imoEntryTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, imoEntryTemplate.address);
    imoEntry = await ethers.getContractAt("IMOEntry", clonedContractAddress);

    const Redeem = await ethers.getContractFactory("Redeem");
    redeem = await Redeem.deploy(assetToken.address, UNISWAP_ROUTER);
    await redeem.deployed();

    const TokenVaultTemplate = await ethers.getContractFactory("TokenVault");
    tokenVaultTemplate = await TokenVaultTemplate.deploy();
    await tokenVaultTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, tokenVaultTemplate.address);
    tokenVault = await ethers.getContractAt("TokenVault", clonedContractAddress);
    
    // configure erc20 asset

    // configure internal factory
    await internalFactory.initialize(tokenVault.address /*address taxVault_*/, 1 /* %, uint256 buyTax_ */, 1 /*%， uint256 sellTax_*/)
    await internalFactory.grantRole(await internalFactory.CREATOR_ROLE(), imoEntry.address)
    await internalFactory.grantRole(await internalFactory.ADMIN_ROLE(), admin.address)
    await internalFactory.connect(admin).setRouter(internalRouter.address)
    
    // configure internal router
    await internalRouter.initialize(internalFactory.address, assetToken.address)
    await internalRouter.grantRole(await internalRouter.EXECUTOR_ROLE(), imoEntry.address)

    // configure model factory
    await modelFactory.initialize(modelToken.address, modelLockToken.address, assetToken.address, 1)
    await modelFactory.grantRole(await modelFactory.BONDING_ROLE(), imoEntry.address)
    await modelFactory.setTokenAdmin(admin.address)
    await modelFactory.setUniswapRouter(UNISWAP_ROUTER)
    await modelFactory.setTokenTaxParams(100, 100, 0)

    await tokenVault.initialize(assetToken.address)
    await tokenVault.grantRole(await tokenVault.WITHDRAW_ROLE(), withdrawer.address)

  
    // configure IMOEntry
    await imoEntry.initialize(
      internalFactory.address, 
      internalRouter.address, 
      tokenVault.address/*address feeTo_*/, 
      500 /** fee 10**12 */, 
      1000000000/* uint256 initialSupply_ */, 
      6/*uint256 assetRate_ ~~100 token*/, 
      99 /*%,uint256 maxTx_*/, 
      modelFactory.address, 
      // ethers.utils.parseEther("142857150"), // gradThreshold ~~10^6
      ethers.utils.parseEther("144090000"), // gradThreshold ~~10^6
      UNISWAP_ROUTER,
      aiModels.address,
    )
  });

  it("Should allow selling and update token data and tax is not zero", async function () {
    amount1 = ethers.BigNumber.from(10).pow(decimal).mul(40000000)
    await assetToken.transfer(addr1.address, amount1);
    await assetToken.connect(addr1).approve(imoEntry.address, amount1);

    await aiModels.connect(addr1).recordModelUpload("model1", "model1", "model1", 0, 1)
    let tx = await imoEntry.connect(addr1).launch("model1", "TT", "Test Description", ethers.BigNumber.from(10).pow(decimal).mul(1));
    await tx.wait();

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    internalPair = await internalFactory.getPair(tokenAddress, assetToken.address);
    internalToken = await ethers.getContractAt("InternalToken", tokenAddress);
    console.log((await internalToken.balanceOf(internalPair)).toString());

    await assetToken.connect(addr1).approve(internalRouter.address, ethers.BigNumber.from(10).pow(decimal).mul(40000000));
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(30000900), tokenAddress);
    // await expect(imoEntry.unwrapToken(tokenAddress, [addr1.address])).to.be.revertedWith("Token is not graduated yet")

    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(10000), tokenAddress);
    // tx = await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    // const receipt = await tx.wait(); 
    // const logs = receipt.events.find(e => e.address === modelFactory.address);

    // application = await modelFactory.getApplication(logs.data)
    // modelToken = await ethers.getContractAt("ModelToken", application.token)
    // await imoEntry.unwrapToken(tokenAddress, [admin.address])
    // await modelToken.connect(admin).transfer(UNISWAP_ROUTER, 100)
    // await modelToken.distributeTaxTokens()
  });
});