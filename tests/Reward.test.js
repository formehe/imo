const { expect } = require("chai");
const { ethers, UniswapV2Deployer} = require("hardhat");
const {deployAndCloneContract} = require("./utils")

describe("Reward Contract", function () {
  let uniswapRouter
  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("ERC20Sample");
    modelToken = await MockToken.deploy("Model Token", "MDL");
    assetToken = await MockToken.deploy("Asset Token", "AST");

    const { factory, router, weth9 } = await UniswapV2Deployer.deploy(owner);
    uniswapRouter = router;
    const tx = await factory.createPair(modelToken.address, assetToken.address);
    await tx.wait();
    // const pairAddr = await factory.getPair(modelToken.address, assetToken.address);
    // console.log("New Pair =", pairAddr);
    const amountA = ethers.utils.parseEther("1000");
    await assetToken.approve(router.address, amountA);
    await modelToken.approve(router.address, amountA);

    await router.addLiquidity(
        modelToken.address,
        assetToken.address,
        amountA,
        amountA,
        0,          // amountAMin
        0,          // amountBMin
        owner.address,
        ethers.constants.MaxUint256
    );

    // Deploy Reward contract
    const RewardTemplate = await ethers.getContractFactory("Reward");
    rewardTemplate = await RewardTemplate.deploy();
    await rewardTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, rewardTemplate.address);
    reward = await ethers.getContractAt("Reward", clonedContractAddress);
    await reward.initialize(assetToken.address, owner.address, modelToken.address, router.address)
    
    // Setup initial state
    await modelToken.transfer(reward.address, ethers.utils.parseEther("1000"));
    await assetToken.transfer(reward.address, ethers.utils.parseEther("1000"));
  });

  describe("Basic Functions", function () {
    it("should return correct total historical rewards", async function () {
      expect(await reward.getTotalHistoricalRewards()).to.equal(0);
    });

    // it("should distribute tax tokens successfully", async function () {
    //   await modelToken.approve(uniswapRouter.address, ethers.constants.MaxUint256);
    //   await reward.distributeTaxTokens();
    //   expect(await modelToken.balanceOf(reward.address)).to.be.gt(0);
    // });

    it("should distribute rewards to user", async function () {
      const amount = ethers.utils.parseEther("100");
      const user1Address = await user1.getAddress();
      
      await reward.distributeReward(user1Address, amount);
      expect(await assetToken.balanceOf(user1Address)).to.equal(amount);
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to distribute rewards", async function () {
      const amount = ethers.utils.parseEther("100");
      const user1Address = await user1.getAddress();
      
      await expect(
        reward.connect(user1).distributeReward(user1Address, amount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Edge Cases", function () {
    it("should revert when distributing zero amount", async function () {
      const user1Address = await user1.getAddress();
      await expect(
        reward.distributeReward(user1Address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("State Changes", function () {
    it("should update total historical rewards after distribution", async function () {
      const amount = ethers.utils.parseEther("100");
      const user1Address = await user1.getAddress();
      
      await reward.distributeReward(user1Address, amount);
      expect(await reward.getTotalHistoricalRewards()).to.equal(amount);
    });

    it("should emit RewardDistributed event", async function () {
      const amount = ethers.utils.parseEther("100");
      const user1Address = await user1.getAddress();
      
      await expect(reward.distributeReward(user1Address, amount))
        .to.emit(reward, "RewardDistributed")
        .withArgs(user1Address, amount);
    });
  });
});