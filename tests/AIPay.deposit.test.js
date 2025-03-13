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
  const Test = "0xD516492bb58F07bc91c972DCCB2DF654653d4D33";

  beforeEach(async function () {
    //set multiple signer
    [owner, user1, user2, user3] = await ethers.getSigners();

    //usdt sample
    const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
    usdtToken = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
    await usdtToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await usdtToken.connect(owner).transfer(user1.address, toWei(100));
    await usdtToken.connect(owner).transfer(user2.address, toWei(100));
    await usdtToken.connect(owner).transfer(user3.address, toWei(100));

    //bank contract
    const BankFactory = await ethers.getContractFactory("Bank");
    bank = await BankFactory.deploy(usdtToken.address, usdtToken.address);
    await bank.deployed();

    const updateRateTx = await bank.connect(owner).updateRate(toWei("1"));
    await updateRateTx.wait(); // Ensure the updateRate transaction is mined successfully

    // deposit
    const DepositFactory = await ethers.getContractFactory("Deposit");
    DepositCon = await DepositFactory.deploy(usdtToken.address, bank.address);
    await DepositCon.deployed();

    //settlement
    const SettlementFactory = await ethers.getContractFactory("Settlement");
    SettlementCon = await SettlementFactory.connect(owner).deploy(
      DepositCon.address
    );
    await SettlementCon.deployed();

    // address list
    console.log("usdtToken: ", usdtToken.address);
    console.log("bank: ", bank.address);
    console.log("DepositCon: ", DepositCon.address);
    console.log("SettlementCon: ", SettlementCon.address);
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

    // change current usdt
    const settlement_refresh = await SettlementCon.connect(
      owner
    ).refreshUserBalance(owner.address, toWei("0.5"));

    await settlement_refresh.wait();

    //check if user balance has been refresh

    (, userBalance) = await DepositCon.getUserBalance(owner.address);

    // Log updated user balance
    console.log(
      "Updated User USDT Balance: ",
      ethers.utils.formatEther(userBalance)
    );

    // Expect the user balance to be equal to the refreshed amount
    expect(userBalance).to.equal(toWei("0.5"));
  });

  //---------------------------------------bank---------------------------------------
  it("Should deposit usdt to contract successfully", async function () {
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
