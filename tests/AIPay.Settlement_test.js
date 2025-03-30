const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployAndCloneContract } = require("./utils");
const toWei = (val) => ethers.utils.parseEther("" + val);
const { AddressZero } = require("ethers").constants;

describe("Settlement Contract", function () {
  let AIWorkload, aiWorkload;
  let NodesRegistry, nodesRegistry;
  let owner, reporter1, reporter2;
  const ROUND_DURATION_TIME = 3600; // 1 hour
  beforeEach(async function () {
    //=================== deposit contract part =======================================
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

    // //usdt sample
    // const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
    // usdtToken = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
    // await usdtToken.deployed();

    // // Transfer USDT from owner to user1, user2, user3
    // await usdtToken.connect(owner).transfer(addr1.address, toWei(1000));
    // await usdtToken.connect(owner).transfer(addr2.address, toWei(1000));
    // await usdtToken.connect(owner).transfer(addr3.address, toWei(1000));

    // //bank contract
    // const BankFactory = await ethers.getContractFactory("Bank");
    // bank = await BankFactory.deploy(usdtToken.address, usdtToken.address);
    // await bank.deployed();

    // const updateRateTx = await bank.connect(owner).updateRate(toWei("1"));
    // await updateRateTx.wait(); // Ensure the updateRate transaction is mined successfully

    // // deposit
    // const DepositFactory = await ethers.getContractFactory("Deposit");
    // DepositCon = await DepositFactory.deploy(usdtToken.address, bank.address);
    // await DepositCon.deployed();

    // //settlement
    // const SettlementFactory = await ethers.getContractFactory("Settlement");
    // SettlementCon = await SettlementFactory.connect(owner).deploy(
    //   DepositCon.address,
    //   bank.address
    // );
    // await SettlementCon.deployed();

    //=================== workload contract part =======================================

    let nodeInfos = [
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

    // const AssetManagement = await ethers.getContractFactory("AssetManagement");
    // const assetManagement = await AssetManagement.deploy();
    // await assetManagement.deployed();

    // const nodesGovernance = await ethers.getContractFactory("NodesGovernance");
    // const nodesGovernanceCon = await nodesGovernance.deploy();
    // await nodesGovernanceCon.deployed();

    await nodesGovernanceCon.nodesGovernance_initialize(
      nodeInfos,
      addr1.address,
      ROUND_DURATION_TIME,
      assetManagement.address
    );

    // const AIModelUploadFactory = await ethers.getContractFactory("AIModels");
    // aiModelUpload = await AIModelUploadFactory.deploy(
    //   nodesGovernanceCon.address,
    //   assetManagement.address
    // );
    // await aiModelUpload.deployed();

    // const modelName = "TestModel";
    // const modelVersion = "v1.0";
    // const modelInfo = "Test model description";

    // await aiModelUpload.recordModelUpload(
    //   modelName,
    //   modelVersion,
    //   modelInfo,
    //   1
    // );

    // AIWorkload = await ethers.getContractFactory("AIWorkload");
    // aiWorkload = await AIWorkload.deploy(
    //   nodesGovernanceCon.address,
    //   aiModelUpload.address,
    //   assetManagement.address,
    //   SettlementCon.address
    // );
    // await aiWorkload.deployed();

    // await expect(
    //   AIWorkload.deploy(AddressZero, AddressZero, AddressZero, AddressZero)
    // ).to.be.revertedWith("Invalid node registry");

    // //grantrole
    // const MINTER_ROLE = ethers.utils.keccak256(
    //   ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
    // );
    // await SettlementCon.grantRole(MINTER_ROLE, aiWorkload.address);

    // await DepositCon.grantRole(MINTER_ROLE, SettlementCon.address);
  });

  // it("Should initialize the contract correctly", async function () {
  //   await aiWorkload
  //     .connect(reporter1)
  //     .reportWorkload(addr1.address, addr3.address, 100, 1, 1, 1, []);
  // });
  it("Should record workload and emit WorkloadReported event", async function () {
    // deposit
    const DepositFactory = await ethers.getContractFactory("Deposit");
    const DepositCon = DepositFactory.attach(
      "0xE27b0aF6bd5A4B3cFA0fcBa6EBfB32F6d86C226c"
    );

    const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    const ERC20SampleCon = ERC20Sample.attach(
      "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D"
    );

    const tx1 = await ERC20SampleCon.approve(
      "0xE27b0aF6bd5A4B3cFA0fcBa6EBfB32F6d86C226c",
      toWei("1")
    );
    const receipt1 = await tx1.wait();
    console.log("Transaction hash:", tx1.hash, " receipt1:", receipt1);

    const tx = await DepositCon.deposit(toWei("1"), { gasLimit: 500000 });
    const receipt = await tx.wait();
    console.log("Transaction hash:", tx.hash, " receipt:", receipt);
  });

  it("Should record workload and emit WorkloadReported event", async function () {
    const nodesGovernance = await ethers.getContractFactory("NodesGovernance");
    const nodesGovernanceCon = await nodesGovernance.deploy();
    await nodesGovernanceCon.deployed();

    await nodesGovernanceCon.nodesGovernance_initialize(
      nodeInfos,
      addr1.address,
      ROUND_DURATION_TIME,
      assetManagement.address
    );

    //-----------------------------------------------------------------------------
    //usdt approve contract to spend
    await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
    //deposit
    await DepositCon.connect(addr3).deposit(toWei("200"));

    //check the addr1 by getUserBalance
    const userBalance = await DepositCon.getUserBalance(addr3.address);
    console.log("userBalance:", userBalance);
    const workload = 200;
    const content = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "uint256", "uint256", "uint256"],
      [addr3.address, addr3.address, workload, 1, 1, 1]
    );

    const signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
    const signature2 = await addr1.signMessage(ethers.utils.arrayify(content));
    const signature3 = await addr1.signMessage(ethers.utils.arrayify(content));

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

    console.log("tx......", tx.hash());
  });
});
