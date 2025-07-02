const { expect } = require("chai");
const BN = require('bignumber.js');
const { ethers,  UniswapV2Deployer} = require("hardhat");
const { deployAndCloneContract } = require("./utils")

function getRandomIntBetween100kAnd1M() {
  return Math.floor(Math.random() * (1000000 - 100000 + 1)) + 100000;
}

describe("IMOEntry Contract", function () {
  let imoEntry, internalFactory, internalRouter, aiModels, modelFactory;
  let owner, addr1, admin, feeTo;
  let assetToken;
  let decimal;
  let UNISWAP_ROUTER;

  beforeEach(async function () {
    [owner, addr1, admin, feeTo, withdrawer, platformOwner] = await ethers.getSigners();

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

    const StakingTemplate = await ethers.getContractFactory("Staking");
    stakingTemplate = await StakingTemplate.deploy();
    await stakingTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, stakingTemplate.address);
    const stakingToken = await ethers.getContractAt("Staking", clonedContractAddress);

    const RewardTemplate = await ethers.getContractFactory("Reward");
    rewardTemplate = await RewardTemplate.deploy();
    await rewardTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, rewardTemplate.address);
    const rewardToken = await ethers.getContractAt("Reward", clonedContractAddress);

    const AirdropTemplate = await ethers.getContractFactory("Airdrop");
    airdropTemplate = await AirdropTemplate.deploy();
    await airdropTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, airdropTemplate.address);
    airdropToken = await ethers.getContractAt("Airdrop", clonedContractAddress);

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
    await modelFactory.initialize(modelToken.address, modelLockToken.address, rewardToken.address, 
      stakingToken.address, owner.address, assetToken.address, 1, airdropToken.address, platformOwner.address)
    await modelFactory.grantRole(await modelFactory.BONDING_ROLE(), imoEntry.address)
    await modelFactory.setTokenAdmin(admin.address)
    await modelFactory.setUniswapRouter(UNISWAP_ROUTER)
    await modelFactory.setTokenTaxParams(100, 100, 1)

    await tokenVault.initialize(assetToken.address)
    await tokenVault.grantRole(await tokenVault.WITHDRAW_ROLE(), withdrawer.address)

    // configure IMOEntry
    await imoEntry.initialize(
      internalFactory.address, 
      internalRouter.address,
      tokenVault.address/*address feeTo_*/,
      100000000 /** fee 10**12 */,
      1000000000/* uint256 initialSupply_ */,
      2/*uint256 assetRate_ ~~100 token*/,
      99 /*%,uint256 maxTx_*/,
      modelFactory.address,
      // ethers.utils.parseEther("141819150"), // gradThreshold ~~10^6
      ethers.utils.parseEther("140000000"), // gradThreshold ~~10^6
      UNISWAP_ROUTER,
      aiModels.address,
    )
  });

  it("Should allow selling and update token data and tax is not zero", async function () {
    amount1 = ethers.BigNumber.from(10).pow(decimal).mul(200000000)
    await assetToken.transfer(addr1.address, amount1);
    await assetToken.transfer(admin.address, amount1);
    await assetToken.connect(addr1).approve(imoEntry.address, amount1);
    await assetToken.connect(admin).approve(internalRouter.address, amount1);

    internalBuyTax = BN((await internalFactory.buyTax()).toString())
    internalSellTax = BN((await internalFactory.sellTax()).toString())
    console.log("InternalSwap buy tax:", (internalBuyTax.dividedBy(BN(100))).toFixed(2))
    console.log("InternalSwap sell tax:", (internalSellTax.dividedBy(BN(100))).toFixed(2))

    // launch IMO
    balanceOf = await assetToken.balanceOf(tokenVault.address)
    await aiModels.connect(addr1).recordModelUpload("model1", "model1", "model1", 0, 1)
    let tx = await imoEntry.connect(addr1).launch("model1", "TT", "Test Description", ethers.BigNumber.from(10).pow(decimal).mul(100001));
    await tx.wait();

    expect(await assetToken.balanceOf(tokenVault.address)).to.gt(0)

    const tokenAddress = (await imoEntry.tokenInfos(0)).toString();
    internalPairAddress = await internalFactory.getPair(tokenAddress, assetToken.address);
    expect(internalPairAddress).to.equal((await imoEntry.tokenInfo(tokenAddress)).pair);
    internalToken = await ethers.getContractAt("InternalToken", tokenAddress);
    internalPair = await ethers.getContractAt("IInternalPair", internalPairAddress);
    let reserves = await internalPair.getReserves();
    console.log("quality of intenalswap asset", reserves[1].toString())
    console.log("quality of intenalswap model token", reserves[0].toString())
    console.log("K", (reserves[0].mul(reserves[1])).toString())
    console.log("quality of intenalswap Klast", (await internalPair.kLast()).toString())
    let dividend = BN((ethers.BigNumber.from(10).pow(decimal).mul(reserves[0])).toString())
    let divisor = BN((ethers.BigNumber.from(10).pow(18).mul(reserves[1])).toString())
    console.log("InternalSwap price", (dividend.dividedBy(divisor)).toFixed(3).toString());

    // await assetToken.connect(addr1).approve(internalRouter.address, ethers.BigNumber.from(10).pow(decimal).mul(40000000));
    // await imoEntry.connect(addr1).buy(ethers.BigNumber.from(10).pow(decimal).mul(30000000), tokenAddress);
    let logs;
    for (i = 0; ; i++) {
      randomNumber = getRandomIntBetween100kAnd1M()
      console.log("Spent asset token amount " + i, randomNumber.toString())
      amountTop = ethers.BigNumber.from(10).pow(decimal).mul(randomNumber)
      await assetToken.connect(addr1).approve(internalRouter.address, amountTop);
      tx = await imoEntry.connect(addr1).buy(amountTop, tokenAddress);
      const receipt = await tx.wait();
      const logsTmp = receipt.events.find(e => e.address === modelFactory.address);
      if (logsTmp != undefined) {
        logs = logsTmp
        break;
      }
      reserves = await internalPair.getReserves();
      console.log("K " + i, (reserves[0].mul(reserves[1])).toString())
      console.log("quality of intenalswap asset "+ i, reserves[1].toString())
      console.log("quality of intenalswap modelToken "+ i, reserves[0].toString())
      console.log("quality of intenalswap Klast" + i, (await internalPair.kLast()).toString())
      dividend = BN((ethers.BigNumber.from(10).pow(decimal).mul(reserves[0])).toString())
      divisor = BN((ethers.BigNumber.from(10).pow(18).mul(reserves[1])).toString())
      console.log("InternalSwap price " + i, (dividend.dividedBy(divisor)).toFixed(3).toString());
    }

    // buy
    // await expect(imoEntry.unwrapToken(tokenAddress, [addr1.address])).to.be.revertedWith("Token is not graduated yet")

    // tx = await imoEntry.connect(admin).buy(ethers.BigNumber.from(10).pow(decimal).mul(1000), tokenAddress);
    // let receipt = await tx.wait();
    // const logs = receipt.events.find(e => e.address === modelFactory.address);

    application = await modelFactory.getApplication(logs.data)
    swapPair = await ethers.getContractAt("IUniswapV2Pair", application.lp);
    reserves = await swapPair.getReserves();
    token0 = await swapPair.token0();
    if (token0 == application.token) {
      dividend = BN((ethers.BigNumber.from(10).pow(decimal).mul(reserves.reserve0)).toString())
      divisor = BN((ethers.BigNumber.from(10).pow(18).mul(reserves.reserve1)).toString())
      console.log("quality of uniswap asset", reserves.reserve1.toString())
      console.log("quality of uniswap model token", reserves.reserve0.toString())
      console.log("uniswap price", (dividend.dividedBy(divisor)).toFixed(3).toString());
      console.log("market cap", ((new BN("1000000000")).multipliedBy(divisor).dividedBy(dividend)).toFixed(0).toString())
    } else {
      dividend = BN((ethers.BigNumber.from(10).pow(decimal).mul(reserves.reserve1)).toString())
      divisor = BN((ethers.BigNumber.from(10).pow(18).mul(reserves.reserve0)).toString())
      console.log("quality of uniswap asset", reserves.reserve0.toString())
      console.log("quality of uniswap model token", reserves.reserve1.toString())
      console.log("uniswap price", (dividend.dividedBy(divisor)).toFixed(3).toString());
      console.log("market cap", ((new BN("1000000000")).multipliedBy(divisor).dividedBy(dividend)).toFixed(0).toString())
    }
    modelToken = await ethers.getContractAt("ModelToken", application.token)
    console.log("airdrop reserved:", (await modelToken.balanceOf(application.airdropToken)).toString())
    swapBuyTax = BN((await modelToken.projectBuyTaxBasisPoints()).toString())
    swapSellTax = BN((await modelToken.projectSellTaxBasisPoints()).toString())
    console.log("Uniswap buy tax:", (swapBuyTax.dividedBy(BN(10000))).toFixed(4))
    console.log("Uniswap sell tax:", (swapSellTax.dividedBy(BN(10000))).toFixed(4))
    console.log("Internal totoal tax", ((await assetToken.balanceOf(tokenVault.address)).sub(balanceOf)).toString())
    expect((await internalToken.balanceOf(admin.address)).add(await internalToken.balanceOf(addr1.address))).to.equal(await modelToken.balanceOf(internalPairAddress))

    // transfer from internal router to uniswap router
    await imoEntry.unwrapToken(tokenAddress, [addr1.address])
    await modelToken.connect(addr1).transfer(UNISWAP_ROUTER, 100)
    swapRouter = await ethers.getContractAt("IUniswapV2Router02", UNISWAP_ROUTER);

    staking = await ethers.getContractAt("Staking", application.stakeToken);
    modelToken = await ethers.getContractAt("ModelToken", application.token);
    rewardToken = await ethers.getContractAt("Reward", application.rewardToken);
    airdrop = await ethers.getContractAt("Airdrop", application.airdropToken);

    //stake
    await modelToken.connect(addr1).approve(application.stakeToken, ethers.constants.MaxUint256);
    await staking.connect(addr1).stake(ethers.BigNumber.from(10).pow(decimal).mul(1000000));

    //swap
    amount = ethers.BigNumber.from(10).pow(decimal).mul(100000)
    await assetToken.connect(admin).approve(UNISWAP_ROUTER, amount);
    balanceOf = await modelToken.balanceOf(owner.address)
    await swapRouter.connect(admin).swapExactTokensForTokensSupportingFeeOnTransferTokens(
        amount,
        0, // accept any amount of TOP
        [assetToken.address, application.token],
        owner.address,
        ethers.constants.MaxUint256
    );
    expect(await modelToken.balanceOf(owner.address)).to.gt(balanceOf)

    //reward
    await rewardToken.distributeTaxTokens();
    await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]); // Advance 1 day
    await ethers.provider.send("evm_mine");
    balanceOf = await assetToken.balanceOf(addr1.address);
    await staking.connect(addr1).claimReward();
    expect(await assetToken.balanceOf(addr1.address)).to.be.gt(balanceOf);

    //airdrop
    recipients = [withdrawer.address, platformOwner.address];
    amounts = [ethers.utils.parseEther("100"), ethers.utils.parseEther("200")];
    
    const description = "Test Airdrop";
    tx = await airdrop.connect(addr1).proposeAirdrop(
      recipients, amounts, description
    );
    
    receipt = await tx.wait();
    proposalId = receipt.events[0].args.proposalId;
    await airdrop.connect(platformOwner).confirmAirdrop(proposalId);
    await airdrop.connect(addr1).executeAirdrop(
        recipients, amounts, description
    );
    
    expect(await modelToken.balanceOf(withdrawer.address)).to.equal(amounts[0]);
    expect(await modelToken.balanceOf(platformOwner.address)).to.equal(amounts[1]);

    balanceOf = await modelToken.projectTaxPendingSwap()
    await modelToken.connect(owner).transfer(admin.address, ethers.utils.parseEther("1"))
    expect(await modelToken.projectTaxPendingSwap()).to.equal(balanceOf)
  });
});