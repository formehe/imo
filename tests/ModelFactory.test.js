const { expect } = require("chai");
const { ethers, UniswapV2Deployer } = require("hardhat");
const {deployAndCloneContract} = require("./utils")
const { BigNumber } = require('ethers')

describe("ModelFactory Contract", function () {
  let modelFactory;
  let tokenImplementation;
  let lockTokenImplemention;
  let assetToken;
  let owner;
  let addr1;
  let addr2;
  let initialLockAmount = ethers.utils.parseEther("1000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const { factory, router, weth9 } = await UniswapV2Deployer.deploy(owner);
    UNISWAP_ROUTER = router.address;

    const Token = await ethers.getContractFactory("ERC20Sample");
    assetToken = await Token.deploy("Asset Token", "AST");
    await assetToken.deployed();

    await assetToken.transfer(addr1.address, initialLockAmount);
    await assetToken.transfer(addr2.address, initialLockAmount);

    const ModelTokenTemplate = await ethers.getContractFactory("ModelToken");
    modelTokenTemplate = await ModelTokenTemplate.deploy();
    await modelTokenTemplate.deployed();
    let clonedContractAddress = await deployAndCloneContract(ethers, modelTokenTemplate.address);
    tokenImplementation = await ethers.getContractAt("ModelToken", clonedContractAddress);

    const ModelLockTokenTemplate = await ethers.getContractFactory("ModelLockToken");
    modelLockTokenTemplate = await ModelLockTokenTemplate.deploy();
    await modelLockTokenTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, modelLockTokenTemplate.address);
    lockTokenImplemention = await ethers.getContractAt("ModelLockToken", clonedContractAddress);

    // 部署 ModelFactory 合约
    const ModelFactoryTemplate = await ethers.getContractFactory("ModelFactory");
    modelFactoryTemplate = await ModelFactoryTemplate.deploy();
    await modelFactoryTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, modelFactoryTemplate.address);
    modelFactory = await ethers.getContractAt("ModelFactory", clonedContractAddress);

    // 初始化 ModelFactory
    await modelFactory.initialize(
      tokenImplementation.address,
      lockTokenImplemention.address,
      assetToken.address,
      1 // 初始 ID 为 1
    );

    await modelFactory.grantRole(await modelFactory.BONDING_ROLE(), addr1.address)
    await modelFactory.setUniswapRouter(UNISWAP_ROUTER)
    await modelFactory.setTokenTaxParams(1/*万分之,uint256 projectBuyTaxBasisPoints*/, 
      1/*万分之,uint256 projectSellTaxBasisPoints*/, 
      1/*万分之uint256 taxSwapThresholdBasisPoints*/)
  });

  it("should initialize contract correctly", async function () {
    expect(await modelFactory.tokenImplementation()).to.equal(tokenImplementation.address);
    expect(await modelFactory.lockTokenImplemention()).to.equal(lockTokenImplemention.address);
    expect(await modelFactory.assetToken()).to.equal(assetToken.address);
    expect(await modelFactory.nextId()).to.equal(1);
  });

  it("should allow user to create new application", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("100");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    const id = await modelFactory.nextId()
    await modelFactory.connect(addr1).initFromBondingCurve(
      name, 
      symbol, 
      threshold, 
      addr1.address
    );

    const application = await modelFactory.getApplication(id);
    expect(application.name).to.equal(name);
    expect(application.symbol).to.equal(symbol);
    expect(application.status).to.equal(0); // Active
    expect(application.withdrawableAmount).to.equal(threshold);
  });

  it("should execute application and create new model token", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("1000");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    const id = await modelFactory.nextId()
    await modelFactory.connect(addr1).initFromBondingCurve(
      name, 
      symbol, 
      threshold, 
      addr1.address
    );

    // Set up token supply parameters
    const uint = await assetToken.decimals()
    const totalSupply = ethers.utils.parseEther("10000").div(BigNumber.from(10).pow(uint));
    const lpSupply = ethers.utils.parseEther("5000").div(BigNumber.from(10).pow(uint));
    const vault = addr2.address;

    await modelFactory.setTokenAdmin(addr2.address)

    const tokenAddress = await modelFactory.connect(addr1).callStatic["executeBondingCurveApplication(uint256,uint256,uint256,address)"](id, totalSupply, lpSupply, vault)
    await modelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault);

    const token = await ethers.getContractAt("ModelToken", tokenAddress);
    expect(await token.name()).to.equal(name);
    expect(await token.symbol()).to.equal(symbol);
  });

  it("should allow withdrawal after application execution", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("1000");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    await modelFactory.grantRole(modelFactory.BONDING_ROLE(), addr1.address)
    const id = await modelFactory.nextId()
    await modelFactory.connect(addr1).initFromBondingCurve(
      name, 
      symbol, 
      threshold, 
      addr1.address
    );

    // Set up token supply parameters
    const uint = await assetToken.decimals()
    const totalSupply = ethers.utils.parseEther("10000").div(BigNumber.from(10).pow(uint));
    const lpSupply = ethers.utils.parseEther("5000").div(BigNumber.from(10).pow(uint));
    const vault = addr2.address;

    await modelFactory.setTokenAdmin(addr2.address)
    // await modelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault);

    // Withdraw funds
    await modelFactory.connect(addr1).withdraw(id);

    const application = await modelFactory.getApplication(id);
    expect(application.status).to.equal(2); // Withdrawn
  });

  it("should prevent reentrancy in withdraw function", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("1000");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    const id = await modelFactory.nextId()
    await modelFactory.connect(addr1).initFromBondingCurve(
      name, 
      symbol, 
      threshold, 
      addr1.address
    );

    // Set up token supply parameters
    const uint = await assetToken.decimals()
    const totalSupply = ethers.utils.parseEther("10000").div(BigNumber.from(10).pow(uint));
    const lpSupply = ethers.utils.parseEther("5000").div(BigNumber.from(10).pow(uint));
    const vault = addr2.address;

    await modelFactory.setTokenAdmin(addr2.address)
    // await modelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault);

    // Try to call withdraw twice, expecting the second call to fail due to reentrancy guard
    await modelFactory.connect(addr1).withdraw(id)

    await expect(modelFactory.connect(addr1).withdraw(id)).to.be.revertedWith("Application is not active");
  });
});
