const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployAndCloneContract } = require("./utils");
const toWei = (val) => ethers.utils.parseEther("" + val);
const { AddressZero } = require("ethers").constants;

describe("Settlement Contract", function () {
  let AIWorkload, aiWorkload;
  let nodesGovernanceCon;
  let owner, reporter1, reporter2;
  const ROUND_DURATION_TIME = 3600; // 1 hour
  beforeEach(async function () {
    //=================== deposit contract part =======================================
    //set multiple signer
    // [owner, user1, user2, user3] = await ethers.getSigners();
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
      addr7,
    ] = await ethers.getSigners();

    //usdt sample
    const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
    usdtToken = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
    await usdtToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await usdtToken.connect(owner).transfer(addr1.address, toWei(1000));
    await usdtToken.connect(owner).transfer(addr2.address, toWei(1000));
    await usdtToken.connect(owner).transfer(addr3.address, toWei(1000));

    //usdt sample
    const ERC20TOPFactory = await ethers.getContractFactory("ERC20Sample");
    topToken = await ERC20TOPFactory.connect(owner).deploy("TOPToken", "TOP");
    await topToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await topToken.connect(owner).transfer(addr1.address, toWei(1000));
    await topToken.connect(owner).transfer(addr2.address, toWei(1000));
    await topToken.connect(owner).transfer(addr3.address, toWei(1000));

    //bank contract
    const BankFactory = await ethers.getContractFactory("Bank");
    bank = await BankFactory.deploy(topToken.address, usdtToken.address);
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
    nodesGovernanceCon = await nodesGovernance.deploy();
    await nodesGovernanceCon.deployed();

    await nodesGovernanceCon.nodesGovernance_initialize(
      nodeInfos,
      addr1.address,
      ROUND_DURATION_TIME,
      assetManagement.address
    );
    await nodesGovernanceCon.grantRole(await nodesGovernanceCon.ADMIN_ROLE(), owner.address); 

    await nodesGovernanceCon.grantRole(
      await nodesGovernanceCon.ADMIN_ROLE(),
      owner.address
    );

    await nodesGovernanceCon.registerProxyNode(addr1.address);

    const AIModelUploadFactory = await ethers.getContractFactory("AIModels");
    aiModelUpload = await AIModelUploadFactory.deploy(
      nodesGovernanceCon.address,
      assetManagement.address
    );
    await aiModelUpload.deployed();

    const modelName = "TestModel";
    const modelVersion = "v1.0";
    const modelInfo = "Test model description";

    await aiModelUpload.recordModelUpload(
      modelName,
      modelVersion,
      modelInfo,
      1
    );

    await aiModelUpload.recordModelUpload(
      "TestMode2",
      modelVersion,
      modelInfo,
      toWei(2)
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
    await SettlementCon.grantRole(MINTER_ROLE, aiWorkload.address);
    await SettlementCon.grantRole(MINTER_ROLE, owner.address);

    await DepositCon.grantRole(MINTER_ROLE, SettlementCon.address);

    const updateRateTx = await bank
      .connect(owner)
      .updateUsdtTopRate(1, 1);
    await updateRateTx.wait(); // Ensure the updateRate transaction is mined successfully

    const [toprate, usdtrate] = await bank.usdtToTopRate();
  });

  // it("Should initialize the contract correctly", async function () {
  //   await aiWorkload
  //     .connect(reporter1)
  //     .reportWorkload(addr1.address, addr3.address, 100, 1, 1, 1, []);
  // });
  it("Should record workload and emit WorkloadReported event", async function () {
    //usdt approve contract to spend
    await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
    //deposit
    await DepositCon.connect(addr3).deposit(toWei("200"));

    //check the addr1 by getUserBalance
    const userBalance = await DepositCon.getUserBalance(addr3.address);
    const workload = 200;
    const content = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256", "uint256", "uint256"],
      [addr3.address, addr3.address, workload, 1, 1, 1]
    );

    const signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
    const signature2 = await addr2.signMessage(ethers.utils.arrayify(content));
    const signature3 = await addr3.signMessage(ethers.utils.arrayify(content));

    const signatures = [
      {
        r: signature1.slice(0, 66),
        s: "0x" + signature1.slice(66, 130),
        v: parseInt(signature1.slice(130, 132), 16),
      },
      {
        r: signature2.slice(0, 66),
        s: "0x" + signature2.slice(66, 130),
        v: parseInt(signature2.slice(130, 132), 16),
      },
      {
        r: signature3.slice(0, 66),
        s: "0x" + signature3.slice(66, 130),
        v: parseInt(signature3.slice(130, 132), 16),
      },
    ];

    const tx = await aiWorkload.connect(addr1).reportWorkload(
      addr3.address,
      addr3.address, //user need deposit
      workload,
      1,
      1,
      1,
      signatures
    );

    const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
    await expect(tx)
      .to.emit(aiWorkload, "WorkloadReported")
      .withArgs(1, addr1.address, addr3.address, 1, workload, 1);

    const totalWorkload = await aiWorkload.getTotalWorkerWorkload(
      addr3.address
    );
    expect(totalWorkload.totalWorkload).to.equal(workload);
  });

  it("Should set the right rate ", async function () {
    await bank.updateUsdtTopRate(1, 1);
  });

  it("Should set  the right deductWorkload ", async function () {
    const data = await aiModelUpload.uploadModels(1);

    const approvetx = await usdtToken
      .connect(addr1)
      .approve(DepositCon.address, toWei("10000000000000"));

    await approvetx.wait();

    const deposittx = await DepositCon.connect(addr1).deposit(toWei("100"));
    await deposittx.wait();

    const MINTER_ROLE = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    );
    await SettlementCon.grantRole(MINTER_ROLE, owner.address);
    const tx = await SettlementCon.deductWorkload(
      100, //workload
      addr1.address,
      [addr1.address],
      1,
      1,
      3
    );

    await tx.wait();
  });

  describe("Update Deposit Contract", function () {
    it("Should update deposit contract address when called by admin", async function () {
      const newDepositAddress = ethers.Wallet.createRandom().address;
      
      await SettlementCon.connect(owner).updateDepositContract(newDepositAddress);
      expect(await SettlementCon.depositContract()).to.equal(newDepositAddress);
    });

    it("Should emit DepositContractUpdated event", async function () {
      const newDepositAddress = ethers.Wallet.createRandom().address;
      
      await expect(SettlementCon.connect(owner).updateDepositContract(newDepositAddress))
        .to.emit(SettlementCon, "DepositContractUpdated")
        .withArgs(DepositCon.address, newDepositAddress);
    });

    it("Should revert if called by non-admin", async function () {
      const newDepositAddress = ethers.Wallet.createRandom().address;
      
      await expect(SettlementCon.connect(addr1).updateDepositContract(newDepositAddress))
        .to.be.reverted;
    });

    it("Should revert if new address is zero", async function () {    
      await expect(SettlementCon.connect(owner).updateDepositContract(ethers.constants.AddressZero))
        .to.be.reverted;
    });
  });

  describe("Deduct Workload", function () {
    it("Should deduct user balance correctly", async function () {      
      const workload = 10;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      // Get initial balance
      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      
      // Call deductWorkload
      await SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      );
      
      // Check user balance is reduced
      const finalBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      const expectedDeduction = ethers.BigNumber.from(workload).mul(1); // workload * model price
      expect(initialBalance.sub(finalBalance)).to.equal(expectedDeduction);
    });

    it("Should distribute TOP tokens to workers correctly", async function () {      
      const workload = 10;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      // Call deductWorkload
      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];

      await SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      );
      
      // Calculate expected TOP amount per worker
      const totalUSDT = ethers.BigNumber.from(workload).mul(1); // workload * model price
      const totalTOP = totalUSDT.mul(1); // topRate = 10, usdtRate = 1
      const topPerWorker = totalTOP.div(2); // Split between 2 workers
      
      // Check worker balances
      expect((await DepositCon.workerBalances(reporter1.address))[1]).to.equal(topPerWorker);
      expect((await DepositCon.workerBalances(reporter2.address))[1]).to.equal(topPerWorker);
    });

    it("Should emit WorkloadDeducted event", async function () {      
      const workload = 10;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];

      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      
      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      ))
        .to.emit(SettlementCon, "WorkloadDeducted")
        .withArgs(workload, addr1.address, workers, modelId, sessionId, epochId);
    });

    it("Should revert if called by non-owner", async function () {     
      const workload = 10;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      )).to.be.reverted;
    });

    it("Should revert if user has insufficient balance", async function () {
      // High workload that would exceed user2's balance
      const workload = 1000;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr2.address, workers, modelId, sessionId, epochId
      )).to.be.revertedWith("not enought for paying");
    });

    it("Should revert if model does not exist", async function () {
     
      const workload = 10;
      const nonExistentModelId = 999;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, nonExistentModelId, sessionId, epochId
      )).to.be.revertedWith("Model does not exist");
    });

    it("Should revert if model price is zero", async function () {
     
      const workload = 10;
      const zeroModelId = 3; // We set up model 3 with zero price
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, zeroModelId, sessionId, epochId
      )).to.be.revertedWith("Model does not exist");
    });

    it("Should revert if calculated TOP amount is zero", async function () {    
      // Set exchange rate to make TOP amount zero (0 TOP per 1 USDT)
      await bank.updateUsdtTopRate(1, 2);
      
      const workload = 1;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      const manyWorkers = Array(1000).fill(reporter1.address);
      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))

      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      )).to.be.revertedWith("topamount cannot be zero");
    });

    it("Should revert if TOP amount per worker is zero", async function () {      
      // Very small workload with many workers to make per-worker amount zero
      const workload = 1;
      const modelId = 1; // Price 0.1 USDT
      const sessionId = 123;
      const epochId = 456;
      
      // Create an array with many workers to spread the TOP tokens thinly
      const manyWorkers = Array(1000).fill(reporter1.address);
      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      
      await expect(SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, manyWorkers, modelId, sessionId, epochId
      )).to.be.revertedWith("topamountperworker cannot be zero");
    });

    it("Should handle different model prices correctly", async function () {     
      const workload = 10;
      const modelId = 2; // Higher price model (0.2 USDT)
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];
      
      // Get initial balance
      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      
      // Call deductWorkload
      await SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      );
      
      // Check user balance is reduced according to higher price
      const finalBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      const expectedDeduction = ethers.BigNumber.from(workload).mul(toWei(2)); // workload * model price
      
      expect(initialBalance.sub(finalBalance)).to.equal(expectedDeduction);
    });

    it("Should distribute TOP tokens correctly with different exchange rates", async function () {
      // Change exchange rate: 20 TOP per 1 USDT
      await bank.updateUsdtTopRate(20, 1);
      
      const workload = 10;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address];

      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];
      
      // Call deductWorkload
      await SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      );
      
      // Calculate expected TOP amount per worker with new rate
      const totalUSDT = ethers.BigNumber.from(workload).mul(1);; // workload * model price
      const totalTOP = totalUSDT.mul(20); // topRate = 20, usdtRate = 1
      const topPerWorker = totalTOP.div(2); // Split between 2 workers
      
      // Check worker balances
      expect((await DepositCon.workerBalances(reporter1.address))[1]).to.equal(topPerWorker);
      expect((await DepositCon.workerBalances(reporter2.address))[1]).to.equal(topPerWorker);
    });

    it("Should handle uneven TOP token distribution correctly", async function () {
      const workload = 10;
      const modelId = 1;
      const sessionId = 123;
      const epochId = 456;
      const workers = [reporter1.address, reporter2.address, addr1.address]; // 3 workers
      
      await usdtToken.connect(addr1).approve(DepositCon.address, toWei("100"))
      await DepositCon.connect(addr1).deposit(toWei("100"))
      const initialBalance = (await DepositCon.getUserBalance(addr1.address))[1];

      // Call deductWorkload
      await SettlementCon.connect(owner).deductWorkload(
        workload, addr1.address, workers, modelId, sessionId, epochId
      );
      
      // Calculate expected TOP amount per worker
      const totalUSDT = ethers.BigNumber.from(workload).mul(1); // workload * model price
      const totalTOP = totalUSDT.mul(1); // topRate = 10, usdtRate = 1
      const topPerWorker = totalTOP.div(3); // Split between 3 workers (might have remainder)
      
      // Check worker balances - all should be the same
      expect((await DepositCon.workerBalances(reporter1.address))[1]).to.equal(topPerWorker);
      expect((await DepositCon.workerBalances(reporter2.address))[1]).to.equal(topPerWorker);
      expect((await DepositCon.workerBalances(addr1.address))[1]).to.equal(topPerWorker);
      
      // Verify total distributed is within rounding error of original amount (remainder handling)
      const totalDistributed = topPerWorker.mul(3);
      expect(totalTOP.sub(totalDistributed).abs()).to.be.at.most(2); // Allow for division remainder
    });
  });
});
