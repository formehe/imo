const { expect } = require("chai");
const { ethers} = require("hardhat");
const {deployAndCloneContract} = require("./utils")

describe("Staking Contract", function () {
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const STAKE_AMOUNT = ethers.utils.parseEther("1000");

  beforeEach(async function () {
    [owner, user1, provider, manager] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("ERC20Sample");
    assetToken = await MockToken.deploy("Asset Token", "AST");
    await assetToken.deployed();

    const StakingTemplate = await ethers.getContractFactory("Staking");
    stakingTemplate = await StakingTemplate.deploy();
    await stakingTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, stakingTemplate.address);
    staking = await ethers.getContractAt("Staking", clonedContractAddress);

    const RewardTemplate = await ethers.getContractFactory("Reward");
    rewardTemplate = await RewardTemplate.deploy();
    await rewardTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, rewardTemplate.address);
    reward = await ethers.getContractAt("Reward", clonedContractAddress);

    await staking.initialize(
      assetToken.address,
      reward.address,
      provider.address,
      manager.address
    )

    await reward.initialize(
        assetToken.address,
        staking.address,
        assetToken.address,  // Using same token for simplicity
        assetToken.address  // Mock router address
    );

    // Setup initial balances
    await assetToken.transfer(user1.address, INITIAL_SUPPLY);
    await assetToken.connect(user1).approve(staking.address, INITIAL_SUPPLY);
  });

  describe("Initialization", function () {
    it("should initialize with correct token addresses", async function () {
      expect(await staking.assetToken()).to.equal(assetToken.address);
      expect(await staking.rewardsToken()).to.equal(reward.address);
    });

    it("should set correct provider and manager addresses", async function () {
      expect(await staking.stakeProvider()).to.equal(await provider.getAddress());
      expect(await staking.stakeManager()).to.equal(await manager.getAddress());
    });
  });

  describe("Staking Functions", function () {
    it("should allow users to stake tokens", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      expect(await staking.balances(await user1.getAddress())).to.equal(STAKE_AMOUNT);
      expect(await staking.totalSupply()).to.equal(STAKE_AMOUNT);
    });

    it("should emit Staked event when staking", async function () {
      await expect(staking.connect(user1).stake(STAKE_AMOUNT))
        .to.emit(staking, "Staked")
        .withArgs(await user1.getAddress(), STAKE_AMOUNT);
    });

    it("should allow users to withdraw staked tokens", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      await staking.connect(user1).withdraw(STAKE_AMOUNT);
      expect(await staking.balances(await user1.getAddress())).to.equal(0);
      expect(await staking.totalSupply()).to.equal(0);
    });
  });

  describe("Reward Calculations", function () {
    it("should calculate rewards correctly", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);

      const earned = await staking.earned(await user1.getAddress());
      expect(earned).to.be.equal(0);
    });

    it("should distribute rewards according to percentages", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      await assetToken.transfer(reward.address, ethers.utils.parseEther("1000")); // Mock reward transfer
      await ethers.provider.send("evm_increaseTime", [86400 + 1]);

      const beforeBalance = await assetToken.balanceOf(await user1.getAddress());
      await staking.connect(user1).claimReward();
      const afterBalance = await assetToken.balanceOf(await user1.getAddress());

      expect(afterBalance.sub(beforeBalance)).to.be.gt(0);
    });
  });

  describe("Edge Cases", function () {
    it("should revert when staking zero amount", async function () {
      await expect(staking.connect(user1).stake(0)).to.be.reverted;
    });

    it("should revert when withdrawing more than staked", async function () {
      await staking.connect(user1).stake(STAKE_AMOUNT);
      await expect(staking.connect(user1).withdraw(STAKE_AMOUNT.add(1)))
        .to.be.revertedWith("Insufficient balance to withdraw");
    });

    it("should handle multiple users staking", async function () {
      const user2 = (await ethers.getSigners())[2];
      await assetToken.mint(await user2.getAddress(), INITIAL_SUPPLY);
      await assetToken.connect(user2).approve(staking.address, INITIAL_SUPPLY);

      await staking.connect(user1).stake(STAKE_AMOUNT);
      await staking.connect(user2).stake(STAKE_AMOUNT);

      await ethers.provider.send("evm_increaseTime", [86400 + 1]);

      const earned1 = await staking.earned(await user1.getAddress());
      const earned2 = await staking.earned(await user2.getAddress());
      expect(earned1).to.equal(earned2);
    });
  });
});