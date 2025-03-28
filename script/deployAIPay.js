const toWei = (val) => ethers.utils.parseEther("" + val);

async function main() {
  // const AIworkloadCon = "0xE77935C5c3D1110e7626C48d086Ec3F224D730c1";
  // {{REWRITTEN_CODE}}
  const assetManagement = "0x0f87DEcFa025e2c9d3c9da509AAE9a58C9437d8B";
  const nodesRegistry = "0x2661c26E13E2F71125815fDB8a057c45Da8AB2bB";
  const aiModelUpload = "0x13c9447432C6E06503F446d593Cc50aC5C0195A0";
  const usdtToken = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D";
  const topToken = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b";

  const BankFactory = await ethers.getContractFactory("Bank");
  bank = await BankFactory.deploy(usdtToken, topToken);
  await bank.deployed();

  const updateRateTx = await bank.updateRate(toWei("1"));
  await updateRateTx.wait();

  console.log("bank is :", bank.address);
  console.log("bank deploy Transaction hash :", bank.deployTransaction.hash);

  // deposit
  const DepositFactory = await ethers.getContractFactory("Deposit");
  DepositCon = await DepositFactory.deploy(usdtToken, bank.address);
  await DepositCon.deployed();
  console.log("DepositCon  is :", DepositCon.address);
  console.log("Transaction hash :", DepositCon.deployTransaction.hash);

  //settlement
  const SettlementFactory = await ethers.getContractFactory("Settlement");
  SettlementCon = await SettlementFactory.deploy(
    DepositCon.address,
    bank.address
  );
  await SettlementCon.deployed();

  console.log("SettlementCon  is :", SettlementCon.address);
  console.log("Transaction hash :", SettlementCon.deployTransaction.hash);

  //grantrole
  const MINTER_ROLE = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("OPERATOR_ROLE")
  );

  AIWorkload = await ethers.getContractFactory("AIWorkload");
  aiWorkload = await AIWorkload.deploy(
    nodesRegistry,
    aiModelUpload,
    assetManagement,
    SettlementCon.address
  );
  await aiWorkload.deployed();
  console.log("AI Work is :", aiWorkload.address);
  console.log("Transaction hash :", aiWorkload.deployTransaction.hash);

  await SettlementCon.grantRole(MINTER_ROLE, aiWorkload.address);

  await DepositCon.grantRole(MINTER_ROLE, SettlementCon.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
