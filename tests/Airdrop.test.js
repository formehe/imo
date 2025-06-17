const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const {deployAndCloneContract} = require("./utils")

describe("Airdrop Contract Tests", function() {
  const ZERO_ADDRESS = ethers.constants.AddressZero;
  const TEST_TOKEN_SUPPLY = ethers.utils.parseEther("1000000");
  const AIRDROP_AMOUNT = ethers.utils.parseEther("10000");

  beforeEach(async function() {
    // Get signers
    [owner, modelProvider, modelPlatform, recipient1, recipient2, other] = await ethers.getSigners();

    // Deploy Token
    Token = await ethers.getContractFactory("ERC20Sample");
    token = await Token.deploy("Test Token", "TEST");
    await token.deployed();
    await token.mint(owner.address, TEST_TOKEN_SUPPLY);

    // Deploy Airdrop via proxy
    AirdropTemplate = await ethers.getContractFactory("Airdrop");
    airdropTemplate = await AirdropTemplate.deploy();
    await airdropTemplate.deployed();
    let clonedContractAddress = await deployAndCloneContract(ethers, airdropTemplate.address);
    airdrop = await ethers.getContractAt("Airdrop", clonedContractAddress);

    await expect(
        airdrop.initialize(ZERO_ADDRESS, modelPlatform.address, token.address)
    ).to.be.revertedWith("Invalid model provider address");
    await expect(
        airdrop.initialize(modelProvider.address, ZERO_ADDRESS, token.address)
    ).to.be.revertedWith("Invalid model platform address");
        await expect(
        airdrop.initialize(modelProvider.address, modelPlatform.address, ZERO_ADDRESS)
    ).to.be.revertedWith("Invalid model token address");
    await airdrop.initialize(modelProvider.address, modelPlatform.address, token.address);

    // Transfer tokens to Airdrop contract
    await token.transfer(airdrop.address, AIRDROP_AMOUNT);
  });

  describe("Initialization", function() {
    it("should set correct initial values", async function() {
      expect(await airdrop.modelPorivder()).to.equal(modelProvider.address);
      expect(await airdrop.modelPlatform()).to.equal(modelPlatform.address);
      expect(await airdrop.modelToken()).to.equal(token.address);
    });
  });

  describe("Propose Airdrop", function() {
    const description = "Test Airdrop";
    const amounts = [ethers.utils.parseEther("100"), ethers.utils.parseEther("200")];
    let recipients;

    beforeEach(async function() {
      recipients = [recipient1.address, recipient2.address];
    });

    it("should allow modelProvider to propose airdrop", async function() {
      await expect(
        airdrop.connect(modelProvider).proposeAirdrop(recipients, amounts, description)
      ).to.emit(airdrop, "AirdropProposed");
    });

    it("should allow modelPlatform to propose airdrop", async function() {
      await expect(
        airdrop.connect(modelPlatform).proposeAirdrop(recipients, amounts, description)
      ).to.emit(airdrop, "AirdropProposed");
    });

    it("should revert if caller is not authorized", async function() {
      await expect(
        airdrop.connect(other).proposeAirdrop(recipients, amounts, description)
      ).to.be.revertedWith("Not authorized");
    });

    it("should revert if recipients and amounts length mismatch", async function() {
      await expect(
        airdrop.connect(modelProvider).proposeAirdrop(recipients, [amounts[0]], description)
      ).to.be.revertedWith("Length mismatch");
    });
  });

  describe("Confirm Airdrop", function() {
    beforeEach(async function() {
      const tx = await airdrop.connect(modelProvider).proposeAirdrop(
        [recipient1.address, recipient2.address],
        [100, 200],
        "Test Airdrop"
      );
      const receipt = await tx.wait();
      proposalId = receipt.events[0].args.proposalId;
    });

    it("should allow modelPlatform to confirm", async function() {
      await expect(
        airdrop.connect(modelPlatform).confirmAirdrop(proposalId)
      ).to.emit(airdrop, "AirdropConfirmed")
        .withArgs(proposalId, modelPlatform.address);
    });

    it("should not allow double confirmation", async function() {
      await airdrop.connect(modelPlatform).confirmAirdrop(proposalId);
      await expect(
        airdrop.connect(modelPlatform).confirmAirdrop(proposalId)
      ).to.be.revertedWith("Already confirmed");
    });
  });

  describe("Execute Airdrop", function() {
    const description = "Test Airdrop";

    beforeEach(async function() {
      recipients = [recipient1.address, recipient2.address];
      amounts = [ethers.utils.parseEther("100"), ethers.utils.parseEther("200")];
      
      await airdrop.connect(modelProvider).proposeAirdrop(
        recipients, amounts, description
      );

      const tx = await airdrop.connect(modelProvider).proposeAirdrop(
        recipients, amounts, description
      );
      const receipt = await tx.wait();
      proposalId = receipt.events[0].args.proposalId;
      
      await airdrop.connect(modelPlatform).confirmAirdrop(proposalId);
    });

    it("should execute airdrop successfully", async function() {
      await expect(
        airdrop.connect(modelProvider).executeAirdrop(
          recipients, amounts, description
        )
      ).to.emit(airdrop, "AirdropExecuted");

      expect(await token.balanceOf(recipient1.address)).to.equal(amounts[0]);
      expect(await token.balanceOf(recipient2.address)).to.equal(amounts[1]);
    });

    it("should not execute twice", async function() {
      await airdrop.connect(modelProvider).executeAirdrop(
        recipients, amounts, description
      );

      await expect(
        airdrop.connect(modelProvider).executeAirdrop(
          recipients, amounts, description
        )
      ).to.be.revertedWith("Already executed");
    });
  });

  describe("Cancel Airdrop", function() {
    const description = "Test Airdrop";

    beforeEach(async function() {
      recipients = [recipient1.address, recipient2.address];
      amounts = [ethers.utils.parseEther("100"), ethers.utils.parseEther("200")];
      
      const tx = await airdrop.connect(modelProvider).proposeAirdrop(
       recipients, amounts, description
      );
      const receipt = await tx.wait();
      proposalId = receipt.events[0].args.proposalId;
    });

    it("should allow proposer to cancel", async function() {
      await expect(
        airdrop.connect(modelProvider).cancelAirdrop(
          recipients, amounts, description
        )
      ).to.emit(airdrop, "AirdropCancelled");
    });

    it("should not allow non-proposer to cancel", async function() {
      await expect(
        airdrop.connect(other).cancelAirdrop(
          recipients, amounts, description
        )
      ).to.be.revertedWith("Not the proposer");

      await airdrop.connect(modelPlatform).confirmAirdrop(proposalId);
      await expect(
        airdrop.connect(modelPlatform).cancelAirdrop(
          recipients, amounts, description
        )
      ).to.emit(airdrop, "AirdropCancelled");
    });

    it("should not cancel executed airdrop", async function() {
      await airdrop.connect(modelPlatform).confirmAirdrop(proposalId);
      
      await airdrop.connect(modelProvider).executeAirdrop(
        recipients, amounts, description
      );

      await expect(
        airdrop.connect(modelProvider).cancelAirdrop(
          recipients, amounts, description
        )
      ).to.be.revertedWith("Already executed");
    });
  });
});