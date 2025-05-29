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
    await modelFactory.setTokenTaxParams(0, 0, 0)

    await tokenVault.initialize(assetToken.address)
    await tokenVault.grantRole(await tokenVault.WITHDRAW_ROLE(), withdrawer.address)

  
    // configure IMOEntry
    await imoEntry.initialize(
      internalFactory.address, 
      internalRouter.address, 
      tokenVault.address/*address feeTo_*/, 
      500 /** fee 10**12 */, 
      1000000000/* uint256 initialSupply_ */, 
      30000/*uint256 assetRate_ ~~100 token*/, 
      50 /*%,uint256 maxTx_*/, 
      modelFactory.address, 
      ethers.utils.parseEther("1000000"), // gradThreshold ~~10^6
      UNISWAP_ROUTER,
      aiModels.address,
    )
  });

  it("Should initialize the contract correctly", async function () {
    expect(await imoEntry.factory()).to.equal(internalFactory.address);
    expect(await imoEntry.router()).to.equal(internalRouter.address);
    expect(await imoEntry.fee()).to.equal(ethers.BigNumber.from(10).pow(decimal).mul(500).div(1000));
    const InternalToken = await ethers.getContractFactory("InternalToken");
    internalToken = await InternalToken.deploy("test", "test", 100000000, 50, UNISWAP_ROUTER);
    await internalToken.deployed();
    uniswap_router_v2 = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);
    const amountA = ethers.utils.parseEther("10");
    const amountB = ethers.BigNumber.from(10).pow(decimal).mul(10)

    const blockNumber = await ethers.provider.getBlockNumber(); // 获取最新区块号
    const block = await ethers.provider.getBlock(blockNumber);  // 获取区块详情
    
    // **5. 允许 Router 转移代币**
    await expect(internalToken.approve(uniswap_router_v2.address, amountA)).to.be.revertedWith("No router");
    await assetToken.approve(uniswap_router_v2.address, amountB);

    await expect(uniswap_router_v2.connect(owner).addLiquidity(
        internalToken.address,
        assetToken.address,
        amountA,
        amountB,
        0, // 最小 TokenA
        0, // 最小 TokenB
        owner.address,
        block.timestamp + 60000000 * 10 // 超时时间
    )).to.be.revertedWith(/TRANSFER_FROM_FAILED/);
  });

  it("Should allow the owner to set initial supply", async function () {
    await imoEntry.setInitialSupply(2000000);
    expect(await imoEntry.initialSupply()).to.equal(2000000);
  });

  it("Should create a user profile on launch", async function () {
    amount = ethers.BigNumber.from(10).pow(decimal).mul(1000)
    await assetToken.transfer(addr1.address, amount);
    
    await aiModels.connect(addr1).recordModelUpload("model1", "model1", "model1", 0, 1)
    await expect(imoEntry.connect(addr1).launch("model1", "TT", "Test Description", 2)).
      to.be.revertedWith("Purchase amount must be greater than fee")
    await expect(imoEntry.connect(addr1).launch("model1", "TT", "Test Description", ethers.BigNumber.from(10).pow(decimal).mul(2))).
      to.be.revertedWith(/insufficient/)
    await assetToken.connect(addr1).approve(imoEntry.address, amount);
    const tx = await imoEntry.connect(addr1).launch("model1", "TT", "Test Description", ethers.BigNumber.from(10).pow(decimal).mul(2));
    await tx.wait();

    const profile = await imoEntry.profile(addr1.address);
    expect(profile).to.equal(addr1.address);
  });

  it("Should allow buying and update token data", async function () {
    amount1 = ethers.BigNumber.from(10).pow(decimal).mul(1000)
    amount2 = ethers.BigNumber.from(10).pow(decimal).mul(500)
    await assetToken.transfer(addr1.address,  amount1);
    await assetToken.connect(addr1).approve(imoEntry.address,  amount1);

    await aiModels.connect(addr1).recordModelUpload("model1", "model1", "model1", 0, 1)
    await expect(imoEntry.connect(admin).launch("model1", "TT", "Test Description",  amount2)).to.be.revertedWith("Model is not exist or model not your's")
    const tx = await imoEntry.connect(addr1).launch("model1", "TT", "Test Description",  amount2);
    await tx.wait();

    await expect(imoEntry.connect(addr1).launch("model1", "TT", "Test Description",  amount2)).to.be.revertedWith("Model has been launched")

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    expect(tokenAddress).to.not.equal(ethers.constants.AddressZero);

    await assetToken.connect(addr1).approve(internalRouter.address,  amount2);

    await imoEntry.connect(addr1).buy( ethers.BigNumber.from(10).pow(decimal).mul(10), tokenAddress);
    const tokenData = await imoEntry.tokenInfo(tokenAddress);
    expect(tokenData.data.volume).to.not.equal(0);
  });

  it("Should allow selling and update token data", async function () {
    amount1 = ethers.BigNumber.from(10).pow(decimal).mul(2000000)
    await assetToken.transfer(addr1.address, amount1);
    await assetToken.transfer(admin.address, amount1);
    await assetToken.connect(addr1).approve(imoEntry.address, amount1);

    await aiModels.connect(addr1).recordModelUpload("model1", "model1", "model1", 0, 1)
    let tx = await imoEntry.connect(addr1).launch("model1", "TT", "Test Description", ethers.BigNumber.from(10).pow(decimal).mul(500));
    await tx.wait();

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    expect(tokenAddress).to.not.equal(ethers.constants.AddressZero);

    await assetToken.connect(addr1).approve(internalRouter.address, ethers.BigNumber.from(10).pow(decimal).mul(1300000));
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100), tokenAddress);

    internalToken = await ethers.getContractAt("InternalToken", tokenAddress);
    await internalToken.connect(addr1).approve(internalRouter.address, ethers.utils.parseEther("500"));
    await imoEntry.connect(addr1).sell(ethers.utils.parseEther("5"), tokenAddress);
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);
    await internalToken.connect(addr1).approve(internalRouter.address, 1);
    await imoEntry.connect(addr1).sell(1, tokenAddress);

    await assetToken.connect(admin).approve(internalRouter.address, ethers.BigNumber.from(10).pow(decimal).mul(1100000));
    await imoEntry.connect(admin).buy(ethers.BigNumber.from(10).pow(decimal).mul(100), tokenAddress);
    await expect(imoEntry.unwrapToken(tokenAddress, [admin.address])).to.be.revertedWith("Token is not graduated yet")
    const tokenData = await imoEntry.tokenInfo(tokenAddress);
    expect(tokenData.data.volume).to.not.equal(0);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(1000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(400000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(400000), tokenAddress);
    // await expect(imoEntry.connect(addr1).buy(ethers.utils.parseEther("1090000"), tokenAddress)).to.emit(imoEntry, "Graduated");
    tx = await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    // tx = await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(1090000), tokenAddress);
    const receipt = await tx.wait(); 
    const logs = receipt.events.find(e => e.address === modelFactory.address);
    
    application = await modelFactory.getApplication(logs.data)
    modelLockToken = await ethers.getContractAt("ModelLockToken", application.lockToken)
    amount = await modelLockToken.balanceOf(application.proposer)

    await modelLockToken.connect(addr1).withdraw(amount)
    await imoEntry.unwrapToken(tokenAddress, [admin.address])
    await imoEntry.unwrapToken(tokenAddress, [admin.address])
    modelToken = await ethers.getContractAt("ModelToken", application.token)
    balance = await modelToken.balanceOf(admin.address)
    await modelToken.connect(admin).burn(10)
    await modelToken.increaseAllowance(addr1.address, 100)
    await modelToken.decreaseAllowance(addr1.address, 100)
    await expect(modelToken.connect(admin).addLiquidityPool(AddressZero)).to.be.revertedWith("LiquidityPoolCannotBeAddressZero")
    await expect(modelToken.connect(admin).addLiquidityPool(addr1.address)).to.be.revertedWith("LiquidityPoolMustBeAContractAddress")
    await modelToken.connect(admin).addLiquidityPool(modelLockToken.address)
    await modelToken.connect(admin).removeLiquidityPool(modelLockToken.address)
    await modelToken.connect(admin).addValidCaller(ethers.utils.formatBytes32String("hello"))
    expect(await modelToken.connect(admin).isValidCaller(ethers.utils.formatBytes32String("hello"))).to.equal(true)
    await modelToken.connect(admin).removeValidCaller(ethers.utils.formatBytes32String("hello"))
    await modelToken.connect(admin).validCallers()
    await modelToken.connect(admin).setProjectTaxRecipient(addr1.address)
    await modelToken.connect(admin).setSwapThresholdBasisPoints(0)
    await modelToken.connect(admin).setProjectTaxRates(0,0)
    expect(await modelToken.connect(admin).isLiquidityPool(addr1.address)).to.equal(false)
    expect(await modelToken.totalBuyTaxBasisPoints()).to.equal(0)
    expect(await modelToken.totalSellTaxBasisPoints()).to.equal(0)
    await modelToken.totalSupply()

    await expect(imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(1090000), tokenAddress)).to.be.revertedWith("Token not trading");
    await expect(imoEntry.connect(addr1).sell(100, tokenAddress)).to.be.revertedWith("Token not trading")
    remain = await assetToken.balanceOf(tokenVault.address)
    await tokenVault.connect(withdrawer).withdraw(ethers.BigNumber.from(10).pow(decimal).mul(5), owner.address);
    expect(remain.sub(await assetToken.balanceOf(tokenVault.address))).to.equal(ethers.BigNumber.from(10).pow(decimal).mul(5))

    await assetToken.transfer(feeTo.address, amount1);
    await assetToken.connect(feeTo).approve(redeem.address, ethers.BigNumber.from(10).pow(decimal).mul(100))

    await expect(redeem.connect(feeTo).redeemAndBurn(application.token, ethers.BigNumber.from(10).pow(decimal).mul(100), 1)).
      to.emit(redeem, "RedeemedAndBurned").withArgs(feeTo.address, application.token, ethers.BigNumber.from(10).pow(decimal).mul(100), ethers.BigNumber.from("83726058678288586849"));

    await modelToken.connect(admin).approve(feeTo.address, ethers.BigNumber.from(10).pow(decimal).mul(100))
    await modelToken.connect(feeTo).burnFrom(admin.address, 100)
    // await modelToken.connect(addr1).approve(feeTo.address, 100)
    await expect(modelToken.connect(admin).withdrawERC20(modelToken.address, 100)).to.be.revertedWith("CannotWithdrawThisToken")
    await assetToken.transfer(modelToken.address, amount1);
    await modelToken.connect(admin).withdrawERC20(assetToken.address, 100)
    await expect(modelToken.connect(admin).withdrawETH(100)).to.be.revertedWith("TransferFailed")
    await admin.sendTransaction({
      to: modelToken.address,           // 合约地址
      value: ethers.utils.parseEther("1.0"), // 转 1 个主币
    });
    await modelToken.connect(admin).withdrawETH(100)
    await expect(modelToken.connect(admin).approve(AddressZero, ethers.BigNumber.from(10).pow(decimal).mul(100))).to.be.revertedWith("ApproveToTheZeroAddress")

    await modelToken.connect(admin).transfer(UNISWAP_ROUTER, 100)
  });

  it("Should allow selling and update token data and tax is not zero", async function () {
    await modelFactory.setTokenTaxParams(1, 1, 1)
    amount1 = ethers.BigNumber.from(10).pow(decimal).mul(2000000)
    await assetToken.transfer(addr1.address, amount1);
    await assetToken.transfer(admin.address, amount1);
    await assetToken.connect(addr1).approve(imoEntry.address, amount1);

    await aiModels.connect(addr1).recordModelUpload("model1", "model1", "model1", 0, 1)
    let tx = await imoEntry.connect(addr1).launch("model1", "TT", "Test Description", ethers.BigNumber.from(10).pow(decimal).mul(500));
    await tx.wait();

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    expect(tokenAddress).to.not.equal(ethers.constants.AddressZero);

    await assetToken.connect(addr1).approve(internalRouter.address, ethers.BigNumber.from(10).pow(decimal).mul(1300000));
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100), tokenAddress);

    internalToken = await ethers.getContractAt("InternalToken", tokenAddress);
    await internalToken.connect(addr1).approve(internalRouter.address, ethers.utils.parseEther("500"));
    await imoEntry.connect(addr1).sell(ethers.utils.parseEther("5"), tokenAddress);
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);
    await internalToken.connect(addr1).approve(internalRouter.address, 1);
    await imoEntry.connect(addr1).sell(1, tokenAddress);

    await assetToken.connect(admin).approve(internalRouter.address, ethers.BigNumber.from(10).pow(decimal).mul(1100000));
    await imoEntry.connect(admin).buy(ethers.BigNumber.from(10).pow(decimal).mul(100), tokenAddress);
    await expect(imoEntry.unwrapToken(tokenAddress, [admin.address])).to.be.revertedWith("Token is not graduated yet")
    const tokenData = await imoEntry.tokenInfo(tokenAddress);
    expect(tokenData.data.volume).to.not.equal(0);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(1000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(400000), tokenAddress);
    await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(400000), tokenAddress);
    tx = await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(100000), tokenAddress);
    const receipt = await tx.wait(); 
    const logs = receipt.events.find(e => e.address === modelFactory.address);

    application = await modelFactory.getApplication(logs.data)
    modelToken = await ethers.getContractAt("ModelToken", application.token)
    await modelToken.connect(admin).setSwapThresholdBasisPoints(1)
    await modelToken.connect(admin).setProjectTaxRates(1,1)
    await imoEntry.unwrapToken(tokenAddress, [admin.address])
    await modelToken.connect(admin).transfer(UNISWAP_ROUTER, 100)
    await modelToken.distributeTaxTokens()
  });
});