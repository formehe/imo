const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployAndCloneContract } = require("./utils");
var utils = require("ethers").utils;
// const LogF = require('./logwithcolor')
// const logf = new LogF("")
const toWei = (val) => ethers.utils.parseEther("" + val);

describe("Deposit Contract", function () {
  let imoEntry, internalFactory, internalRouter, aiModels;
  let owner, addr1, admin, feeTo;
  let assetToken;
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
      addr7,
    ] = await ethers.getSigners();
    //usdt sample
    const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
    usdtToken = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
    await usdtToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await usdtToken.connect(owner).transfer(addr1.address, toWei(100));
    await usdtToken.connect(owner).transfer(addr2.address, toWei(100));
    await usdtToken.connect(owner).transfer(addr3.address, toWei(100));

    const ERC20TOPFactory = await ethers.getContractFactory("ERC20Sample");
    topToken = await ERC20TOPFactory.connect(owner).deploy("TOPToken", "TOP");
    await topToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await topToken.connect(owner).transfer(addr1.address, toWei(100));
    await topToken.connect(owner).transfer(addr2.address, toWei(100));
    await topToken.connect(owner).transfer(addr3.address, toWei(100));

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

    // address list
    console.log("usdtToken: ", usdtToken.address);
    console.log("bank: ", bank.address);
    console.log("DepositCon: ", DepositCon.address);
    console.log("SettlementCon: ", SettlementCon.address);

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

    const [toprate, usdtrate] = await bank.usdtToTopRate();
    console.log("++ toprate: ", toprate, " ++usdtrate:", usdtrate);
  });

  //---------------------------------------deposit---------------------------------------
  it("Should deposit usdt to contract successfully", async function () {
    console.log("test here ...", usdtToken.address);

    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const ownerUsdtBalance = await usdtToken.balanceOf(owner.address);
    console.log(
      "Owner USDT Balance: ",
      ethers.utils.formatEther(ownerUsdtBalance)
    );

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    const bankBalance = await usdtToken.balanceOf(bank.address);
    console.log("Bank USDT Balance: ", ethers.utils.formatEther(bankBalance));

    expect(bankBalance).to.equal(toWei(1));
  });

  //---------------------------------------settlement---------------------------------------
  it("Should successful user current balance successful", async function () {
    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const ownerUsdtBalance = await usdtToken.balanceOf(owner.address);
    console.log(
      "Owner USDT Balance: ",
      ethers.utils.formatEther(ownerUsdtBalance)
    );

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    //check if user balance has been refresh

    const { current: userBalance } = await DepositCon.getUserBalance(
      owner.address
    );

    // Log updated user balance
    console.log(
      "Updated User USDT Balance: ",
      ethers.utils.formatEther(userBalance)
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

    const ownerUsdtBalance = await usdtToken.balanceOf(owner.address);
    console.log(
      "Owner USDT Balance: ",
      ethers.utils.formatEther(ownerUsdtBalance)
    );

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    const bankBalance = await usdtToken.balanceOf(bank.address);
    console.log("Bank USDT Balance: ", ethers.utils.formatEther(bankBalance));

    expect(bankBalance).to.equal(toWei(1));
  });

  //---------------------------------------bank---------------------------------------
  it("Should deposit usdt to bank contract successfully", async function () {
    const approveTx = await usdtToken
      .connect(owner)
      .approve(DepositCon.address, toWei(1));
    await approveTx.wait(); // Wait for the approval transaction to be mined

    const ownerUsdtBalance = await usdtToken.balanceOf(owner.address);
    console.log(
      "Owner USDT Balance: ",
      ethers.utils.formatEther(ownerUsdtBalance)
    );

    const DepositCon_User_deposit = await DepositCon.connect(owner).deposit(
      toWei(1)
    );
    await DepositCon_User_deposit.wait();

    const bankBalance = await usdtToken.balanceOf(bank.address);
    console.log("Bank USDT Balance: ", ethers.utils.formatEther(bankBalance));

    expect(bankBalance).to.equal(toWei(1));
  });
});
