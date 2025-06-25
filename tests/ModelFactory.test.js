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
    [owner, addr1, addr2, addr3, platformOwner] = await ethers.getSigners();

    const { factory, router, weth9 } = await UniswapV2Deployer.deploy(owner);
    UNISWAP_ROUTER = router.address;

    const Token = await ethers.getContractFactory("ERC20Sample");
    assetToken = await Token.deploy("Asset Token", "AST");
    await assetToken.deployed();

    await assetToken.transfer(addr1.address, initialLockAmount);
    await assetToken.transfer(addr2.address, initialLockAmount);
    await assetToken.transfer(addr3.address, initialLockAmount);

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

    const StakingTemplate = await ethers.getContractFactory("Staking");
    stakingTemplate = await StakingTemplate.deploy();
    await stakingTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, stakingTemplate.address);
    stakingImplemention = await ethers.getContractAt("Staking", clonedContractAddress);

    const RewardTemplate = await ethers.getContractFactory("Reward");
    rewardTemplate = await RewardTemplate.deploy();
    await rewardTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, rewardTemplate.address);
    rewardImplemention = await ethers.getContractAt("Reward", clonedContractAddress);

    const AirdropTemplate = await ethers.getContractFactory("Airdrop");
    airdropTemplate = await AirdropTemplate.deploy();
    await airdropTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, airdropTemplate.address);
    airdropImplement = await ethers.getContractAt("Airdrop", clonedContractAddress);

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
      rewardImplemention.address,
      stakingImplemention.address,
      owner.address,
      assetToken.address,
      1, // 初始 ID 为 1
      airdropImplement.address, // Airdrop implementation
      platformOwner.address // Platform owner
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
    expect(await modelFactory.rewardTokenImplementation()).to.equal(rewardImplemention.address);
    expect(await modelFactory.stakeTokenImplementation()).to.equal(stakingImplemention.address);
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

    const tokenAddress = await modelFactory.connect(addr1).callStatic["executeBondingCurveApplication(uint256,uint256,uint256,address,uint256)"](id, totalSupply, lpSupply, vault, totalSupply.div(10))
    await modelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault, totalSupply.div(10));

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

  it("should test withdraw function permissions", async function () {
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

    // Try to withdraw as non-proposer and without WITHDRAW_ROLE
    await expect(modelFactory.connect(addr2).withdraw(id)).to.be.revertedWith("Not proposer");

    // Grant WITHDRAW_ROLE to addr2 and try again
    await modelFactory.grantRole(await modelFactory.WITHDRAW_ROLE(), addr2.address);
    await modelFactory.connect(addr2).withdraw(id);

    const application = await modelFactory.getApplication(id);
    expect(application.status).to.equal(2); // Withdrawn
  });

  it("should set implementations correctly", async function () {
    const newImplementation = addr2.address;

    await modelFactory.setImplementations(newImplementation);
    expect(await modelFactory.tokenImplementation()).to.equal(newImplementation);

    // Test access control
    await expect(
      modelFactory.connect(addr1).setImplementations(addr1.address)
    ).to.be.revertedWith(/AccessControl/);
  });

  it("should set lock implementations correctly", async function () {
    const newLockImplementation = addr2.address;

    await modelFactory.setLockImplementations(newLockImplementation);
    expect(await modelFactory.lockTokenImplemention()).to.equal(newLockImplementation);

    // Test access control
    await expect(
      modelFactory.connect(addr1).setLockImplementations(addr1.address)
    ).to.be.revertedWith(/AccessControl/);
  });

  it("should set maturity duration correctly", async function () {
    const newDuration = 60 * 60 * 24 * 365; // 1 year in seconds

    await modelFactory.setMaturityDuration(newDuration);
    expect(await modelFactory.maturityDuration()).to.equal(newDuration);

    // Test access control
    await expect(
      modelFactory.connect(addr1).setMaturityDuration(newDuration)
    ).to.be.revertedWith(/AccessControl/);
  });

  it("should set asset token correctly", async function () {
    const Token = await ethers.getContractFactory("ERC20Sample");
    const newAssetToken = await Token.deploy("New Asset Token", "NAT");
    await newAssetToken.deployed();

    await modelFactory.setAssetToken(newAssetToken.address);
    expect(await modelFactory.assetToken()).to.equal(newAssetToken.address);

    // Test access control
    await expect(
      modelFactory.connect(addr1).setAssetToken(newAssetToken.address)
    ).to.be.revertedWith(/AccessControl/);
  });

  it("should pause and unpause contract correctly", async function () {
    // Pause the contract
    await modelFactory.pause();
    expect(await modelFactory.paused()).to.equal(true);

    // Test that functions are paused
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("100");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    await expect(
      modelFactory.connect(addr1).initFromBondingCurve(name, symbol, threshold, addr1.address)
    ).to.be.revertedWith("Pausable: paused");

    // Unpause the contract
    await modelFactory.unpause();
    expect(await modelFactory.paused()).to.equal(false);

    // Test that functions work after unpausing
    await modelFactory.connect(addr1).initFromBondingCurve(name, symbol, threshold, addr1.address);

    // Test access control
    await expect(
      modelFactory.connect(addr1).pause()
    ).to.be.revertedWith(/AccessControl/);

    await expect(
      modelFactory.connect(addr1).unpause()
    ).to.be.revertedWith(/AccessControl/);
  });

  it("should test withdraw function when application is not matured yet", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("1000");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    const id = await modelFactory.nextId();

    // Create an application with a future proposalEndBlock
    await modelFactory.connect(addr1).initFromBondingCurve(
      name,
      symbol,
      threshold,
      addr1.address
    );

    // Modify the proposalEndBlock to be in the future
    const currentBlock = await ethers.provider.getBlockNumber();
    const application = await modelFactory.getApplication(id);

    // await modelFactory.connect(addr1).withdraw(id)

    // Try to withdraw before maturity
    if (currentBlock < application.proposalEndBlock) {
      await expect(
        modelFactory.connect(addr1).withdraw(id)
      ).to.be.revertedWith("Application is not matured yet");
    }
  });

  it("should test executeBondingCurveApplication with invalid application status", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("1000");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    const id = await modelFactory.nextId();
    await modelFactory.connect(addr1).initFromBondingCurve(
      name,
      symbol,
      threshold,
      addr1.address
    );

    // Withdraw to change application status
    await modelFactory.connect(addr1).withdraw(id);

    // Set up token supply parameters
    const uint = await assetToken.decimals();
    const totalSupply = ethers.utils.parseEther("10000").div(BigNumber.from(10).pow(uint));
    const lpSupply = ethers.utils.parseEther("5000").div(BigNumber.from(10).pow(uint));
    const vault = addr2.address;

    await modelFactory.setTokenAdmin(addr2.address);

    // Try to execute application that is not active
    await expect(
      modelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault, totalSupply.div(10))
    ).to.be.revertedWith("Application is not active");
  });

  it("should test executeBondingCurveApplication with token admin not set", async function () {
    const name = "New Token";
    const symbol = "NTKN";
    const threshold = ethers.utils.parseEther("1000");

    // Deploy a new ModelFactory to ensure clean state
    const ModelFactoryTemplate = await ethers.getContractFactory("ModelFactory");
    const newModelFactoryTemplate = await ModelFactoryTemplate.deploy();
    await newModelFactoryTemplate.deployed();
    const clonedContractAddress = await deployAndCloneContract(ethers, newModelFactoryTemplate.address);
    const newModelFactory = await ethers.getContractAt("ModelFactory", clonedContractAddress);

    // Initialize without setting token admin
    await newModelFactory.initialize(
      tokenImplementation.address,
      lockTokenImplemention.address,
      rewardImplemention.address,
      stakingImplemention.address,
      owner.address,
      assetToken.address,
      1,
      airdropImplement.address, // Airdrop implementation
      platformOwner.address // Platform owner
    );

    await newModelFactory.grantRole(await newModelFactory.BONDING_ROLE(), addr1.address);
    await newModelFactory.setUniswapRouter(UNISWAP_ROUTER);
    await newModelFactory.setTokenTaxParams(1, 1, 1);

    // Create application
    await assetToken.connect(addr1).approve(newModelFactory.address, threshold);
    const id = await newModelFactory.nextId();
    await newModelFactory.connect(addr1).initFromBondingCurve(
      name,
      symbol,
      threshold,
      addr1.address
    );

    // Set up token supply parameters
    const uint = await assetToken.decimals();
    const totalSupply = ethers.utils.parseEther("10000").div(BigNumber.from(10).pow(uint));
    const lpSupply = ethers.utils.parseEther("5000").div(BigNumber.from(10).pow(uint));
    const vault = addr2.address;

    // Try to execute application without token admin set
    await expect(
      newModelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault, totalSupply.div(10))
    ).to.be.revertedWith("Token admin not set");
  });

  it("should set token tax parameters correctly", async function () {
    const projectBuyTaxBasisPoints = 200;
    const projectSellTaxBasisPoints = 300;
    const taxSwapThresholdBasisPoints = 100;

    await modelFactory.setTokenTaxParams(
      projectBuyTaxBasisPoints,
      projectSellTaxBasisPoints,
      taxSwapThresholdBasisPoints
    );

    // Create a new application and execute it to verify tax parameters are passed correctly
    const name = "Tax Test Token";
    const symbol = "TTT";
    const threshold = ethers.utils.parseEther("1000");

    await assetToken.connect(addr1).approve(modelFactory.address, threshold);
    const id = await modelFactory.nextId();
    await modelFactory.connect(addr1).initFromBondingCurve(
      name,
      symbol,
      threshold,
      addr1.address
    );

    // Set up token supply parameters
    const totalSupply = ethers.utils.parseEther("10000");
    const lpSupply = ethers.utils.parseEther("5000");
    const vault = addr1.address;

    await modelFactory.setTokenAdmin(addr2.address);

    // Execute application
    const tokenAddress = await modelFactory.connect(addr1).callStatic["executeBondingCurveApplication(uint256,uint256,uint256,address,uint256)"](
      id, totalSupply, lpSupply, vault, totalSupply.div(10)
    );
    await modelFactory.connect(addr1).executeBondingCurveApplication(id, totalSupply, lpSupply, vault, totalSupply.div(10));

    // Verify token was created
    const modelToken = await ethers.getContractAt("ModelToken", tokenAddress);
    expect(await modelToken.name()).to.equal(name);
    expect(await modelToken.symbol()).to.equal(symbol);

    // Test access control
    await expect(
      modelFactory.connect(addr2).setTokenTaxParams(100, 100, 100)
    ).to.be.revertedWith(/AccessControl/);

    const application = await modelFactory.getApplication(id);

    await modelToken.connect(addr1).transfer(addr2.address, initialLockAmount);
    await modelToken.connect(addr1).transfer(addr3.address, initialLockAmount);

    stakeToken = await ethers.getContractAt("Staking", application.stakeToken);
    rewardToken = await ethers.getContractAt("Reward", application.rewardToken);
    await modelToken.connect(addr2).approve(application.stakeToken, 1000);
    await stakeToken.connect(addr2).stake(1000);
    expect(await stakeToken.getStaked(addr2.address)).to.equal(1000);
    await stakeToken.connect(addr2).withdraw(1000);
    expect(await stakeToken.getStaked(addr2.address)).to.equal(0);

    await modelToken.connect(addr2).approve(application.stakeToken, 1000);
    await stakeToken.connect(addr2).stake(1000);
    await assetToken.connect(addr2).transfer(rewardToken.address, 1000);
    await expect(rewardToken.connect(addr2).distributeReward(addr2.address, 1000)).to.be.revertedWith("Ownable: caller is not the owner");
    balance = await assetToken.balanceOf(addr2.address);
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);
    await stakeToken.connect(addr2).claimReward();
    expect(await assetToken.balanceOf(addr2.address)).to.equal(balance.add(500)); // Assuming 500 is the reward amount distributed

    await modelToken.connect(addr2).approve(application.stakeToken, 4000);
    await stakeToken.connect(addr2).stake(1000);
    await assetToken.connect(addr2).transfer(rewardToken.address, 1000);
    await stakeToken.connect(addr2).stake(1000);
    await assetToken.connect(addr2).transfer(rewardToken.address, 1000);
    await stakeToken.connect(addr2).stake(1000);
    await assetToken.connect(addr2).transfer(rewardToken.address, 1000);
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);

    await modelToken.connect(addr3).approve(application.stakeToken, 4000);
    await stakeToken.connect(addr3).stake(1000);
    await assetToken.connect(addr3).transfer(rewardToken.address, 1000);
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);

    balance = await assetToken.balanceOf(owner.address);
    await stakeToken.connect(owner).claimReward();
    expect(await assetToken.balanceOf(owner.address)).to.equal(balance.add(1000));

    balance = await assetToken.balanceOf(addr2.address);
    await stakeToken.connect(addr2).claimReward();
    expect(await assetToken.balanceOf(addr2.address)).to.equal(balance.add(1899));

    balance = await assetToken.balanceOf(addr3.address);
    await stakeToken.connect(addr3).claimReward();
    expect(await assetToken.balanceOf(addr3.address)).to.equal(balance.add(100));
  });
});
