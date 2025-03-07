const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = require("ethers/lib/utils");
const {deployAndCloneContract } = require("./utils")

describe("ModelLockToken", function () {
  let assetToken, modelLockToken, founder, user1, user2;
  let initialLockAmount = parseUnits("1000", 18); // 1000 tokens with 18 decimals
  let stakeAmount = parseUnits("500", 18); // 500 tokens with 18 decimals
  let maturityDuration = 365 * 24 * 60 * 60; // 1 year in seconds

  beforeEach(async function () {
    // Get signers
    [founder, user1, user2] = await ethers.getSigners();

    // Deploy a mock ERC20 asset token
    const AssetToken = await ethers.getContractFactory("ERC20Sample");
    assetToken = await AssetToken.deploy("Asset Token", "ASSET");
    await assetToken.deployed();

    // Deploy the ModelLockToken contract
    const ModelLockTokenTemplate = await ethers.getContractFactory("ModelLockToken");
    modelLockTokenTemplate = await ModelLockTokenTemplate.deploy();
    await modelLockTokenTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, modelLockTokenTemplate.address)
    modelLockToken = await ethers.getContractAt("ModelLockToken", clonedContractAddress);

    // Initialize ModelLockToken contract
    await modelLockToken.initialize(
      "Model Lock Token",
      "MLT",
      founder.address,
      assetToken.address,
      (await ethers.provider.getBlock("latest")).timestamp + maturityDuration, // matureAt
      true // canStake
    );

    // Transfer some asset tokens to the users
    await assetToken.transfer(user1.address, initialLockAmount);
    await assetToken.transfer(user2.address, initialLockAmount);
    await assetToken.transfer(founder.address, initialLockAmount);
    await assetToken.connect(user1).approve(modelLockToken.address, stakeAmount);
    await assetToken.connect(user2).approve(modelLockToken.address, stakeAmount);
    await assetToken.connect(founder).approve(modelLockToken.address, stakeAmount);
  });

  describe("Initialization", function () {
    it("should initialize with the correct parameters", async function () {
      expect(await modelLockToken.name()).to.equal("Model Lock Token");
      expect(await modelLockToken.symbol()).to.equal("MLT");
      expect(await modelLockToken.founder()).to.equal(founder.address);
      expect(await modelLockToken.assetToken()).to.equal(assetToken.address);
      expect(await modelLockToken.canStake()).to.equal(true);
    });
  });

  describe("Staking", function () {
    it("should allow users to stake tokens", async function () {
      await modelLockToken.connect(founder).stake(stakeAmount, founder.address);
      await modelLockToken.connect(user1).stake(stakeAmount, user1.address);
      expect(await modelLockToken.balanceOf(user1.address)).to.equal(stakeAmount);
    });

    it("should not allow staking if staking is disabled", async function () {
      await modelLockToken.connect(founder).stake(stakeAmount, founder.address);
      await modelLockToken.connect(user1).stake(stakeAmount, user1.address);
      await modelLockToken.setCanStake(false);
      await expect(modelLockToken.connect(user1).stake(stakeAmount, user1.address))
        .to.be.revertedWith("Staking is disabled for private agent");
    });

    it("should revert if staking 0 tokens", async function () {
      await expect(modelLockToken.connect(user1).stake(0, user1.address))
        .to.be.revertedWith("Cannot stake 0");
    });

    it("should revert if insufficient allowance", async function () {
      await assetToken.connect(user2).approve(modelLockToken.address, stakeAmount.sub(1));
      await expect(modelLockToken.connect(user2).stake(stakeAmount, user2.address))
        .to.be.revertedWith("Insufficient asset token allowance");
    });

    it("should revert if insufficient balance", async function () {
      await expect(modelLockToken.connect(user2).stake(initialLockAmount.add(1), user2.address))
        .to.be.revertedWith("Insufficient asset token balance");
    });
  });

  describe("Withdrawing", function () {
    beforeEach(async function () {
      await modelLockToken.connect(founder).stake(stakeAmount, founder.address);
      await modelLockToken.connect(user1).stake(stakeAmount, user1.address);
    });

    it("should allow users to withdraw staked tokens", async function () {
      await modelLockToken.connect(user1).withdraw(stakeAmount);
      expect(await modelLockToken.balanceOf(user1.address)).to.equal(0);
    });

    it("should revert if balance is insufficient", async function () {
      await expect(modelLockToken.connect(user1).withdraw(stakeAmount.mul(2)))
        .to.be.revertedWith("Insufficient balance");
    });

    it("should not allow withdrawing before maturity if founder is withdrawing", async function () {
      const founderBalanceBefore = await modelLockToken.balanceOf(founder.address);
      console.log(await assetToken.balanceOf(founder.address))
      await expect(
        modelLockToken.connect(founder).withdraw(stakeAmount)
      ).to.be.revertedWith("Not mature yet");
      expect(await modelLockToken.balanceOf(founder.address)).to.equal(founderBalanceBefore);
    });

    it("should allow founder to withdraw after maturity", async function () {
      console.log(await assetToken.balanceOf(founder.address))
      // Fast-forward time to maturity
      await ethers.provider.send("evm_increaseTime", [maturityDuration]);
      await ethers.provider.send("evm_mine", []);

      await modelLockToken.connect(founder).withdraw(stakeAmount);
      expect(await modelLockToken.balanceOf(founder.address)).to.equal(0);
      console.log(await assetToken.balanceOf(founder.address))
    });
  });

  describe("Checkpoints", function () {
    it("should track past balances correctly", async function () {
      await modelLockToken.connect(founder).stake(stakeAmount, founder.address);
      await modelLockToken.connect(user1).stake(stakeAmount, user1.address);
      const blockNumber = await ethers.provider.getBlockNumber();
      const pastBalance = await modelLockToken.getPastBalanceOf(
        user1.address,
        blockNumber - 1
      );
      expect(pastBalance).to.equal(0);
    });
  });

  describe("Non-transferable token", function () {
    it("should revert on transfer", async function () {
      await expect(
        modelLockToken.connect(user1).transfer(user2.address, stakeAmount)
      ).to.be.revertedWith("Transfer not supported");
    });

    it("should revert on transferFrom", async function () {
      await expect(
        modelLockToken.connect(user1).transferFrom(user1.address, user2.address, stakeAmount)
      ).to.be.revertedWith("Transfer not supported");
    });

    it("should revert on approve", async function () {
      await expect(
        modelLockToken.connect(user1).approve(user2.address, stakeAmount)
      ).to.be.revertedWith("Approve not supported");
    });
  });
});