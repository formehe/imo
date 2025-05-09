const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
  let treasury;
  let owner;
  let fundsController;
  let recipient;
  let user;
  let mockToken;

  const transferLimit = ethers.utils.parseEther("10");
  const delayDuration = 3600; // 1 hour

  beforeEach(async function () {
    // 获取测试账户
    [owner, fundsController, recipient, user] = await ethers.getSigners();

    // 部署模拟ERC20代币
    const MockToken = await ethers.getContractFactory("ERC20Sample");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.deployed();

    // 部署国库合约
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(fundsController.address, transferLimit, delayDuration);
    await treasury.deployed();

    // 向国库合约转入一些ETH
    await owner.sendTransaction({
      to: treasury.address,
      value: ethers.utils.parseEther("20")
    });

    // 向国库合约转入一些代币
    await mockToken.mint(treasury.address, ethers.utils.parseEther("100"));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await treasury.owner()).to.equal(owner.address);
    });

    it("Should set the right funds controller", async function () {
      expect(await treasury.fundsController()).to.equal(fundsController.address);
    });

    it("Should set the right transfer limit", async function () {
      expect(await treasury.transferLimit()).to.equal(transferLimit);
    });

    it("Should set the right delay duration", async function () {
      expect(await treasury.delayDuration()).to.equal(delayDuration);
    });
  });

  describe("Configuration", function () {
    it("Should allow owner to change funds controller", async function () {
      await treasury.setFundsController(user.address);
      expect(await treasury.fundsController()).to.equal(user.address);
    });

    it("Should allow owner to change transfer limit", async function () {
      const newLimit = ethers.utils.parseEther("20");
      await treasury.setTransferLimit(newLimit);
      expect(await treasury.transferLimit()).to.equal(newLimit);
    });

    it("Should allow owner to change delay duration", async function () {
      const newDuration = 7200; // 2 hours
      await treasury.setDelayDuration(newDuration);
      expect(await treasury.delayDuration()).to.equal(newDuration);
    });

    it("Should not allow non-owner to change configuration", async function () {
      await expect(
        treasury.connect(user).setFundsController(user.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        treasury.connect(user).setTransferLimit(ethers.utils.parseEther("20"))
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await expect(
        treasury.connect(user).setDelayDuration(7200)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Transaction Management", function () {
    it("Should allow funds controller to submit ETH transaction", async function () {
      const amount = ethers.utils.parseEther("1");
      blockTime = await getBlockTimestamp()
      await expect(
        treasury.connect(fundsController).submitETHTransaction(recipient.address, amount)
      ).to.emit(treasury, "TransactionSubmitted")
        .withArgs(0, ethers.constants.AddressZero, recipient.address, amount, await getBlockTimestamp() + delayDuration + 1);
            
      const tx = await treasury.transactions(0);
      expect(tx.token).to.equal(ethers.constants.AddressZero);
      expect(tx.recipient).to.equal(recipient.address);
      expect(tx.amount).to.equal(amount);
      expect(tx.executed).to.equal(false);
      expect(tx.cancelled).to.equal(false);
    });

    it("Should allow funds controller to submit token transaction", async function () {
      const amount = ethers.utils.parseEther("5");

      await expect(
        treasury.connect(fundsController).submitTokenTransaction(mockToken.address, recipient.address, amount)
      ).to.emit(treasury, "TransactionSubmitted")
        .withArgs(0, mockToken.address, recipient.address, amount, await getBlockTimestamp() + delayDuration + 1);
      
      const tx = await treasury.transactions(0);
      expect(tx.token).to.equal(mockToken.address);
      expect(tx.recipient).to.equal(recipient.address);
      expect(tx.amount).to.equal(amount);
      expect(tx.executed).to.equal(false);
      expect(tx.cancelled).to.equal(false);
    });

    it("Should not allow non-controller to submit transactions", async function () {
      const amount = ethers.utils.parseEther("1");
      await expect(
        treasury.connect(user).submitETHTransaction(recipient.address, amount)
      ).to.be.revertedWith("Caller is not the funds controller");

      await expect(
        treasury.connect(user).submitTokenTransaction(mockToken.address, recipient.address, amount)
      ).to.be.revertedWith("Caller is not the funds controller");
    });

    it("Should allow funds controller to cancel pending transaction", async function () {
      const amount = ethers.utils.parseEther("1");
      await treasury.connect(fundsController).submitETHTransaction(recipient.address, amount);

      await expect(
        treasury.connect(fundsController).cancelTransaction(0)
      ).to.emit(treasury, "TransactionCancelled")
        .withArgs(0);

      const tx = await treasury.transactions(0);
      expect(tx.cancelled).to.equal(true);
    });

    it("Should not allow execution of transaction before delay period", async function () {
      const amount = ethers.utils.parseEther("1");
      await treasury.connect(fundsController).submitETHTransaction(recipient.address, amount);

      await expect(
        treasury.connect(user).executeTransaction(0)
      ).to.be.revertedWith("Transaction is not ready for execution");
    });

    it("Should allow execution of transaction after delay period", async function () {
      const amount = ethers.utils.parseEther("1");
      await treasury.connect(fundsController).submitETHTransaction(recipient.address, amount);

      // 增加时间
      await ethers.provider.send("evm_increaseTime", [delayDuration + 1]);
      await ethers.provider.send("evm_mine");

      const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);

      await expect(
        treasury.connect(user).executeTransaction(0)
      ).to.emit(treasury, "TransactionExecuted")
        .withArgs(0);

      const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);
      expect(recipientBalanceAfter.sub(recipientBalanceBefore)).to.equal(amount);

      const tx = await treasury.transactions(0);
      expect(tx.executed).to.equal(true);
    });

    it("Should not allow execution of cancelled transaction", async function () {
      const amount = ethers.utils.parseEther("1");
      await treasury.connect(fundsController).submitETHTransaction(recipient.address, amount);
      await treasury.connect(fundsController).cancelTransaction(0);

      // 增加时间
      await ethers.provider.send("evm_increaseTime", [delayDuration + 1]);
      await ethers.provider.send("evm_mine");

      await expect(
        treasury.connect(user).executeTransaction(0)
      ).to.be.revertedWith("Transaction was cancelled");
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause and unpause", async function () {
      await treasury.pause();
      expect(await treasury.paused()).to.equal(true);

      await treasury.unpause();
      expect(await treasury.paused()).to.equal(false);
    });

    it("Should not allow transactions when paused", async function () {
      await treasury.pause();

      const amount = ethers.utils.parseEther("1");
      await expect(
        treasury.connect(fundsController).submitETHTransaction(recipient.address, amount)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  // 辅助函数：获取当前区块时间戳
  async function getBlockTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
  }
});

// 测试结束
