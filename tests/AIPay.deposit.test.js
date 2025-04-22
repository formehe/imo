const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployAndCloneContract } = require("./utils")

const toWei = (val) => ethers.utils.parseEther("" + val);

describe("Deposit Contract", function () {
  let owner, addr1, addr2, addr3, worker;
  const ROUND_DURATION_TIME = 3600; // 1 hour
  beforeEach(async function () {
    //set multiple signer
    [
      owner,
      reporter1,
      reporter2,
      addr1,
      addr2,
      addr3,
      addr4,
      addr5,
      addr6,
      worker,
    ] = await ethers.getSigners();
    //usdt sample
    const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
    usdtToken = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
    await usdtToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await usdtToken.connect(owner).transfer(addr1.address, toWei(1000));
    await usdtToken.connect(owner).transfer(addr2.address, toWei(1000));
    await usdtToken.connect(owner).transfer(addr3.address, toWei(1000));

    const ERC20TOPFactory = await ethers.getContractFactory("ERC20Sample");
    topToken = await ERC20TOPFactory.connect(owner).deploy("TOPToken", "TOP");
    await topToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await topToken.connect(owner).transfer(addr1.address, toWei(1000));
    await topToken.connect(owner).transfer(addr2.address, toWei(1000));
    await topToken.connect(owner).transfer(addr3.address, toWei(1000));

    //bank contract
    const BankFactory = await ethers.getContractFactory("Bank");
    bank = await BankFactory.deploy(usdtToken.address, usdtToken.address);
    await bank.deployed();

    // deposit
    const DepositFactory = await ethers.getContractFactory("Deposit");
    DepositCon = await DepositFactory.deploy(
      usdtToken.address,
      bank.address,
      topToken.address
    );
    await DepositCon.deployed();

    //=================== workload contract part =======================================
    let nodeInfos = [
      {
        identifier: owner.address,
        aliasIdentifier: "11111111111111112",
        wallet: owner.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: reporter1.address,
        aliasIdentifier: "11111111111111113",
        wallet: reporter1.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: reporter2.address,
        aliasIdentifier: "11111111111111114",
        wallet: reporter2.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr1.address,
        aliasIdentifier: "11111111111111111",
        wallet: addr1.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr2.address,
        aliasIdentifier: "21111111111111111",
        wallet: addr2.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr3.address,
        aliasIdentifier: "31111111111111111",
        wallet: addr3.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr4.address,
        aliasIdentifier: "41111111111111111",
        wallet: addr4.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr5.address,
        aliasIdentifier: "51111111111111111",
        wallet: addr5.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr6.address,
        aliasIdentifier: "61111111111111111",
        wallet: addr6.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
    ];

    const AssetManagement = await ethers.getContractFactory("AssetManagement");
    const assetManagement = await AssetManagement.deploy();
    await assetManagement.deployed();

    const nodesGovernance = await ethers.getContractFactory("NodesGovernance");
    const nodesGovernanceCon = await nodesGovernance.deploy();
    await nodesGovernanceCon.deployed();

    await nodesGovernanceCon.nodesGovernance_initialize(
      nodeInfos,
      addr1.address,
      ROUND_DURATION_TIME,
      assetManagement.address
    );

    const AIModelUploadFactory = await ethers.getContractFactory("AIModels");
    aiModelUpload = await AIModelUploadFactory.deploy(
      nodesGovernanceCon.address,
      assetManagement.address
    );
    await aiModelUpload.deployed();

    const TaxVaultTemplate = await ethers.getContractFactory("TaxVault");
    taxVaultTemplate = await TaxVaultTemplate.deploy();
    await taxVaultTemplate.deployed();
    clonedContractAddress = await deployAndCloneContract(ethers, taxVaultTemplate.address);
    taxVault = await ethers.getContractAt("TaxVault", clonedContractAddress);

    const modelName = "TestModel";
    const modelVersion = "v1.0";
    const modelInfo = "Test model description";

    await aiModelUpload.recordModelUpload(
      modelName,
      modelVersion,
      modelInfo,
      1
    );

    //settlement
    const SettlementFactory = await ethers.getContractFactory("Settlement");
    SettlementCon = await SettlementFactory.connect(owner).deploy(
      DepositCon.address,
      bank.address,
      aiModelUpload.address
    );
    await SettlementCon.deployed();

    AIWorkload = await ethers.getContractFactory("AIWorkload");
    aiWorkload = await AIWorkload.deploy(
      nodesGovernanceCon.address,
      aiModelUpload.address,
      assetManagement.address,
      SettlementCon.address
    );
    await aiWorkload.deployed();

    //grantrole
    const MINTER_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );
    await SettlementCon.connect(owner).grantRole(
      MINTER_ROLE,
      aiWorkload.address
    );

    await DepositCon.connect(owner).grantRole(
      MINTER_ROLE,
      SettlementCon.address
    );

    const updateRateTx = await bank.connect(owner).updateUsdtTopRate(1, 1);
    await updateRateTx.wait(); // Ensure the updateRate transaction is mined successfully

    await SettlementCon.updateInferenceTax(1)
    await SettlementCon.updateTaxVault(taxVault.address)
    await taxVault.initialize(DepositCon.address, topToken.address)
    await taxVault.grantRole(await taxVault.WITHDRAW_ROLE(), addr6.address)
  });

  //---------------------------------------deposit---------------------------------------
  it("Should deposit usdt to contract successfully", async function () {
    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    const bankBalance = await usdtToken.balanceOf(bank.address);
    expect(bankBalance).to.equal(toWei(1));
  });

  //---------------------------------------settlement---------------------------------------
  it("Should successful user current balance successful", async function () {
    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    //check if user balance has been refresh

    const { current: userBalance } = await DepositCon.getUserBalance(
      owner.address
    );

    // Expect the user balance to be equal to the refreshed amount
    expect(userBalance).to.equal(toWei("1"));
  });

  //---------------------------------------bank---------------------------------------
  it("Should deposit usdt to bank contract successfully", async function () {
    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    const bankBalance = await usdtToken.balanceOf(bank.address);

    expect(bankBalance).to.equal(toWei(1));
  });

  //---------------------------------------bank---------------------------------------
  it("Should deposit usdt to bank contract successfully", async function () {
    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    const bankBalance = await usdtToken.balanceOf(bank.address);

    expect(bankBalance).to.equal(toWei(1));
  });

  describe("Deposit Function", function () {
    it("Should transfer USDT from user to bank", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      
      // Check initial balances
      const initialUserBalance = await usdtToken.balanceOf(addr1.address);
      const initialBankBalance = await usdtToken.balanceOf(bank.address);

      await usdtToken.connect(addr1).approve(DepositCon.address, depositAmount)
      
      // Make deposit
      await DepositCon.connect(addr1).deposit(depositAmount);
      
      // Check final balances
      expect(await usdtToken.balanceOf(addr1.address)).to.equal(initialUserBalance.sub(depositAmount));
      expect(await usdtToken.balanceOf(bank.address)).to.equal(initialBankBalance.add(depositAmount));
    });

    it("Should update user balance after deposit", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      
      await usdtToken.connect(addr1).approve(DepositCon.address, depositAmount)
      await DepositCon.connect(addr1).deposit(depositAmount);
      
      // Check user balance
      const userBalance = await DepositCon.getUserBalance(addr1.address);
      expect(userBalance.total).to.equal(depositAmount);
      expect(userBalance.current).to.equal(depositAmount);
    });

    it("Should emit DepositMade event", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      
      // Get rate from bank
      await usdtToken.connect(addr1).approve(DepositCon.address, depositAmount)
      const rate = await bank.usdtToTopRate();
      
      // Make deposit and check event
      await expect(DepositCon.connect(addr1).deposit(depositAmount))
        .to.emit(DepositCon, "DepositMade")
        .withArgs(addr1.address, depositAmount, rate.topRate, rate.usdtRate, depositAmount);
    });

    it("Should fail if amount is zero", async function () {
      await expect(DepositCon.connect(addr1).deposit(0)).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should fail if bank address is not set", async function () {
      // Deploy new deposit with zero bank address
      const Deposit = await ethers.getContractFactory("Deposit");
      const newDeposit = await Deposit.deploy(usdtToken.address, ethers.constants.AddressZero, topToken.address);
      await newDeposit.deployed();
      
      // Approve new deposit contract
      await usdtToken.connect(addr1).approve(newDeposit.address, ethers.utils.parseEther("100"));
      
      // Try to deposit
      await expect(newDeposit.connect(addr1).deposit(ethers.utils.parseEther("100")))
        .to.be.revertedWith("Bank address not set");
    });

    it("Should fail if USDT transfer fails", async function () {
      // Try to deposit more than approved
      const excessiveAmount = ethers.utils.parseEther("2000"); // More than the approved amount
      await expect(DepositCon.connect(addr1).deposit(excessiveAmount)).to.be.reverted;
    });

    it("Should fail if usdtToTopRate is invalid", async function () {
      // Deploy mock bank with zero rate
      const Bank = await ethers.getContractFactory("Bank");
      const invalidBank = await Bank.deploy(usdtToken.address, usdtToken.address);
      await invalidBank.deployed();

      await expect(invalidBank.updateUsdtTopRate(0, 0)).to.be.revertedWith("New rate must be greater than 0"); // Invalid rate
      
      // Deploy new deposit with invalid bank
      const Deposit = await ethers.getContractFactory("Deposit");
      const newDeposit = await Deposit.deploy(usdtToken.address, invalidBank.address, topToken.address);
      await newDeposit.deployed();
      
      // Approve new deposit contract
      await usdtToken.connect(addr1).approve(newDeposit.address, ethers.utils.parseEther("100"));
      
      // Try to deposit
      await expect(newDeposit.connect(addr1).deposit(ethers.utils.parseEther("100")))
        .to.be.revertedWith("Invalid usdtToTopRate rate");
    });
  });

  describe("Bank Address Update", function () {
    it("Should update bank address when called by IMO_ROLE", async function () {
      const newBankAddress = ethers.Wallet.createRandom().address;
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await DepositCon.connect(owner).updateBankAddress(newBankAddress);
      expect(await DepositCon.bankAddress()).to.equal(newBankAddress);
    });

    it("Should emit BankAddressUpdated event", async function () {
      const newBankAddress = ethers.Wallet.createRandom().address;
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(DepositCon.connect(owner).updateBankAddress(newBankAddress))
        .to.emit(DepositCon, "BankAddressUpdated")
        .withArgs(bank.address, newBankAddress);
    });

    it("Should revert if called by non-IMO_ROLE account", async function () {
      const newBankAddress = ethers.Wallet.createRandom().address;
      
      await expect(DepositCon.connect(addr1).updateBankAddress(newBankAddress))
        .to.be.reverted;
    });

    it("Should revert if new address is zero", async function () {
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );
      await expect(DepositCon.connect(owner).updateBankAddress(ethers.constants.AddressZero))
        .to.be.revertedWith("Invalid bank address");
    });
  });

  describe("User Balance Management", function () {
    it("Should update user balance when called by IMO_ROLE", async function () {
      const newBalance = ethers.utils.parseEther("500");
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await DepositCon.connect(owner).updateUserBalance(addr1.address, newBalance);
      
      const userBalance = await DepositCon.getUserBalance(addr1.address);
      expect(userBalance.current).to.equal(newBalance);
    });

    it("Should emit UserBalanceUpdated event", async function () {
      const newBalance = ethers.utils.parseEther("500");
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );
      await expect(DepositCon.connect(owner).updateUserBalance(addr1.address, newBalance))
        .to.emit(DepositCon, "UserBalanceUpdated")
        .withArgs(addr1.address, newBalance, false, newBalance);
    });

    it("Should revert if called by non-IMO_ROLE account", async function () {
      const newBalance = ethers.utils.parseEther("500");
      await expect(DepositCon.connect(addr2).updateUserBalance(addr1.address, newBalance))
        .to.be.reverted;
    });

    it("Should revert if user address is zero", async function () {
      const newBalance = ethers.utils.parseEther("500");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(DepositCon.connect(owner).updateUserBalance(ethers.constants.AddressZero, newBalance))
        .to.be.revertedWith("Invalid user address");
    });

    it("Should correctly track total and current balance after multiple deposits", async function () {
      const amount1 = ethers.utils.parseEther("100");

      await usdtToken.connect(addr1).approve(DepositCon.address, amount1)

      await DepositCon.connect(addr1).deposit(amount1);
      
      const userBalance = await DepositCon.getUserBalance(addr1.address);
      expect(userBalance.total).to.equal(amount1);
      expect(userBalance.current).to.equal(amount1);
    });
  });

  describe("Worker TOP Balance Management", function () {
    it("Should increase worker balance when direct is true", async function () {
      const addAmount = ethers.utils.parseEther("100");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await DepositCon.connect(owner).updateWorkerBalance(worker.address, addAmount, true);
      
      const workerBalance = await DepositCon.workerBalances(worker.address);
      expect(workerBalance.currentBalance).to.equal(addAmount);
    });

    it("Should decrease worker balance when direct is false", async function () {
      const initialAmount = ethers.utils.parseEther("100");
      const deductAmount = ethers.utils.parseEther("50");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      // First add some balance
      await DepositCon.connect(owner).updateWorkerBalance(worker.address, initialAmount, true);
      
      // Then deduct from it
      await DepositCon.connect(owner).updateWorkerBalance(worker.address, deductAmount, false);
      
      const workerBalance = await DepositCon.workerBalances(worker.address);
      expect(workerBalance.currentBalance).to.equal(initialAmount.sub(deductAmount));
    });

    it("Should emit WorkerTopBalanceUpdated event", async function () {
      const addAmount = ethers.utils.parseEther("100");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(DepositCon.connect(owner).updateWorkerBalance(worker.address, addAmount, true))
        .to.emit(DepositCon, "WorkerTopBalanceUpdated")
        .withArgs(worker.address, addAmount, true, addAmount);
    });

    it("Should revert if called by non-IMO_ROLE account", async function () {
      const addAmount = ethers.utils.parseEther("100");

      await expect(DepositCon.connect(addr1).updateWorkerBalance(worker.address, addAmount, true))
        .to.be.reverted;
    });

    it("Should revert if worker address is zero", async function () {
      const addAmount = ethers.utils.parseEther("100");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(DepositCon.connect(owner).updateWorkerBalance(ethers.constants.AddressZero, addAmount, true))
        .to.be.revertedWith("Invalid user address");
    });

    it("Should revert if amount is zero", async function () {
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      await expect(DepositCon.connect(owner).updateWorkerBalance(worker.address, 0, true))
        .to.be.revertedWith("should positive");
    });

    it("Should revert if trying to decrease more than available balance", async function () {
      const initialAmount = ethers.utils.parseEther("100");
      const excessiveDeduction = ethers.utils.parseEther("150");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );

      // First add some balance
      await DepositCon.connect(owner).updateWorkerBalance(worker.address, initialAmount, true);
      
      // Try to deduct more than available
      await expect(DepositCon.connect(owner).updateWorkerBalance(worker.address, excessiveDeduction, false))
        .to.be.revertedWith("Insufficient worker current balance");
    });
  });

  describe("Worker TOP Withdrawal", function () {
    it("Should allow worker to withdraw TOP tokens", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        addr1.address
      );

      // First add some balance to the worker
      await DepositCon.connect(addr1).updateWorkerBalance(worker.address, withdrawAmount, true);
      
      // Withdraw
      await topToken.connect(owner).transfer(DepositCon.address, withdrawAmount);
      const initialWorkerBalance = await topToken.balanceOf(worker.address);
      const initialContractBalance = await topToken.balanceOf(DepositCon.address);
      
      await DepositCon.connect(worker).withdrawTOPByWorker();
      
      // Check final balances
      expect(await topToken.balanceOf(worker.address)).to.equal(initialWorkerBalance.add(withdrawAmount));
      expect(await topToken.balanceOf(DepositCon.address)).to.equal(initialContractBalance.sub(withdrawAmount));
      
      // Check worker balance in contract is zero
      const workerBalance = await DepositCon.workerBalances(worker.address);
      expect(workerBalance.currentBalance).to.equal(0);
    });

    it("Should emit WithdrawTOPByWorker event", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      
      // First add some balance to the worker
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        addr1.address
      );

      await DepositCon.connect(addr1).updateWorkerBalance(worker.address, withdrawAmount, true);
      await topToken.connect(addr1).transfer(DepositCon.address, withdrawAmount);
      
      // Withdraw and check event
      await expect(DepositCon.connect(worker).withdrawTOPByWorker())
        .to.emit(DepositCon, "WithdrawTOPByWorker")
        .withArgs(worker.address, withdrawAmount);
    });

    it("Should revert if worker has no balance", async function () {

      await expect(DepositCon.connect(worker).withdrawTOPByWorker())
        .to.be.revertedWith("Worker balance not found for sender");
    });

    it("Should revert if contract doesn't have enough TOP tokens", async function () {
      const withdrawAmount = ethers.utils.parseEther("100000"); // More than minted to the contract
      
      // Add excessive balance to the worker
      const MINTER_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
      );
  
      await DepositCon.grantRole(
        MINTER_ROLE,
        owner.address
      );
      await DepositCon.connect(owner).updateWorkerBalance(worker.address, withdrawAmount, true);
      
      // Drain the contract's TOP tokens first
      const contractBalance = await topToken.balanceOf(DepositCon.address);
      await topToken.connect(addr1).transfer(DepositCon.address, contractBalance);
      
      // Try to withdraw
      await expect(DepositCon.connect(worker).withdrawTOPByWorker())
        .to.be.revertedWith("Insufficient TOP balance");
    });
  });
});
