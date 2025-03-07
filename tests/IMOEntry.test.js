const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployAndCloneContract } = require("./utils")

describe("IMOEntry Contract", function () {
  let imoEntry, internalFactory, internalRouter;
  let owner, addr1, admin, feeTo;
  let assetToken;

  beforeEach(async function () {
    [owner, addr1, admin, feeTo] = await ethers.getSigners();

    const UNISWAP_ROUTER = "0xD516492bb58F07bc91c972DCCB2DF654653d4D33";
    // token
    const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    assetToken = await ERC20Sample.deploy("Asset Token", "ASSET");
    await assetToken.deployed();

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
    const modelFactory = await ethers.getContractAt("ModelFactory", clonedContractAddress);

    // imo platform entry
    const IMOEntryTemplate = await ethers.getContractFactory("IMOEntry");
    imoEntryTemplate = await IMOEntryTemplate.deploy();
    await imoEntryTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, imoEntryTemplate.address);
    imoEntry = await ethers.getContractAt("IMOEntry", clonedContractAddress);

    // configure erc20 asset

    // configure internal factory
    await internalFactory.initialize(imoEntry.address /*address taxVault_*/, 1 /* %, uint256 buyTax_ */, 1 /*%， uint256 sellTax_*/)
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
    await modelFactory.setTokenTaxParams(0, 0, 0, ethers.constants.AddressZero)
  
    // configure IMOEntry
    await imoEntry.initialize(
      internalFactory.address, 
      internalRouter.address, 
      imoEntry.address/*address feeTo_*/, 
      500 /** fee 10**12 */, 
      1000000000/* uint256 initialSupply_ */, 
      30000/*uint256 assetRate_ ~~100 token*/, 
      99 /*%,uint256 maxTx_*/, 
      modelFactory.address, 
      ethers.utils.parseEther("1000000") // gradThreshold ~~10^6
    )
  });

  it("Should initialize the contract correctly", async function () {
    expect(await imoEntry.factory()).to.equal(internalFactory.address);
    expect(await imoEntry.router()).to.equal(internalRouter.address);
    expect(await imoEntry.fee()).to.equal(ethers.utils.parseEther("1").mul(500).div(1000));
  });

  it("Should allow the owner to set initial supply", async function () {
    await imoEntry.setInitialSupply(2000000);
    expect(await imoEntry.initialSupply()).to.equal(2000000);
  });

  it("Should create a user profile on launch", async function () {
    await assetToken.transfer(addr1.address, ethers.utils.parseEther("1000"));
    await assetToken.connect(addr1).approve(imoEntry.address, ethers.utils.parseEther("1000"));

    const tx = await imoEntry.connect(addr1).launch("Test Token", "TT", "Test Description", ethers.utils.parseEther("2"));
    await tx.wait();

    const profile = await imoEntry.profile(addr1.address);
    expect(profile).to.equal(addr1.address);
  });

  it("Should allow buying and update token data", async function () {
    await assetToken.transfer(addr1.address, ethers.utils.parseEther("1000"));
    await assetToken.connect(addr1).approve(imoEntry.address, ethers.utils.parseEther("1000"));

    const tx = await imoEntry.connect(addr1).launch("Test Token", "TT", "Test Description", ethers.utils.parseEther("500"));
    await tx.wait();

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    expect(tokenAddress).to.not.equal(ethers.constants.AddressZero);

    await assetToken.connect(addr1).approve(internalRouter.address, ethers.utils.parseEther("500"));

    await imoEntry.connect(addr1).buy(ethers.utils.parseEther("10"), tokenAddress);
    const tokenData = await imoEntry.tokenInfo(tokenAddress);
    expect(tokenData.data.volume).to.not.equal(0);
  });

  it("Should allow selling and update token data", async function () {
    await assetToken.transfer(addr1.address, ethers.utils.parseEther("2000000"));
    await assetToken.connect(addr1).approve(imoEntry.address, ethers.utils.parseEther("2000000"));

    const tx = await imoEntry.connect(addr1).launch("Test Token", "TT", "Test Description", ethers.utils.parseEther("500"));
    await tx.wait();

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    expect(tokenAddress).to.not.equal(ethers.constants.AddressZero);

    await assetToken.connect(addr1).approve(internalRouter.address, ethers.utils.parseEther("1100000"));
    imoEntry.connect(addr1).buy(ethers.utils.parseEther("100"), tokenAddress);

    internalToken = await ethers.getContractAt("InternalToken", tokenAddress);
    await internalToken.connect(addr1).approve(internalRouter.address, ethers.utils.parseEther("500"));
    await imoEntry.connect(addr1).sell(ethers.utils.parseEther("5"), tokenAddress);

    const tokenData = await imoEntry.tokenInfo(tokenAddress);
    expect(tokenData.data.volume).to.not.equal(0);
    await expect(imoEntry.connect(addr1).buy(ethers.utils.parseEther("1090000"), tokenAddress)).to.emit(imoEntry, "Graduated");
  });
});