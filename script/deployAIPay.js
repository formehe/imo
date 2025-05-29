const toWei = (val) => ethers.utils.parseEther("" + val);
const { deployAndCloneContract } = require("../tests/utils")

async function main() {
  [owner] = await ethers.getSigners();

  // const AIworkloadCon = "0xE77935C5c3D1110e7626C48d086Ec3F224D730c1";
  const assetManagement = "0xBF92451984eC894D10256e2cc43965756325f9D6";
  const nodesRegistry = "0xF8363849557eAD01dF37513BDd3693BCEe057aD5";
  const aiModelUpload = "0x4d3aec3d99d5B1Edf2C375657d0765D960175a3b";
  const usdtToken = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D";
  const topToken = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b";

  const BankFactory = await ethers.getContractFactory("Bank");
  bank = await BankFactory.deploy(usdtToken, topToken);
  await bank.deployed();

  // const updateRateTx = await bank.updateRate(toWei("1"));
  // await updateRateTx.wait();

  console.log("bank is :", bank.address);
  console.log("bank deploy Transaction hash :", bank.deployTransaction.hash);

  // deposit
  const DepositFactory = await ethers.getContractFactory("Deposit");
  DepositCon = await DepositFactory.deploy(usdtToken, bank.address, topToken);
  await DepositCon.deployed();
  console.log("DepositCon  is :", DepositCon.address);
  console.log("Transaction hash :", DepositCon.deployTransaction.hash);

  //settlement
  const SettlementFactory = await ethers.getContractFactory("Settlement");
  SettlementCon = await SettlementFactory.deploy(
    DepositCon.address,
    bank.address,
    aiModelUpload
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

  const TaxVaultTemplate = await ethers.getContractFactory("TaxVault");
  taxVaultTemplate = await TaxVaultTemplate.deploy();
  await taxVaultTemplate.deployed();
  console.log("Transaction hash :", taxVaultTemplate.deployTransaction.hash);
  clonedContractAddress = await deployAndCloneContract(ethers, taxVaultTemplate.address);
  taxVault = await ethers.getContractAt("TaxVault", clonedContractAddress);
  console.log("TaxVault is :", taxVault.address);
  
  const grantRoleTx = await SettlementCon.grantRole(
    MINTER_ROLE,
    aiWorkload.address
  );
  const grantRoleReceipt = await grantRoleTx.wait();
  console.log(
    "SettlementCon grantRole transaction hash:",
    grantRoleReceipt.transactionHash
  );

  const depositGrantRoleTx = await DepositCon.grantRole(
    MINTER_ROLE,
    SettlementCon.address
  );
  const depositGrantRoleReceipt = await depositGrantRoleTx.wait();
  console.log(
    "DepositCon grantRole transaction hash:",
    depositGrantRoleReceipt.transactionHash
  );

  console.log("bank:", bank.signer.address);
  const ishas = await bank.hasRole(await bank.IMO_ROLE(), bank.signer.address);
  console.log("ishas:", ishas);

  console.log("bank:", bank.signer.address);
  await bank.updateUsdtTopRate(1, 1);

  const [toprate, usdtrate] = await bank.usdtToTopRate();
  console.log(
    "++ toprate: ",
    toprate.toString(),
    " ++usdtrate:",
    usdtrate.toString()
  );

  await SettlementCon.updateInferenceTax(1)
  await SettlementCon.updateTaxVault(taxVault.address)
  await taxVault.initialize(topToken)
  await taxVault.setDeposit(DepositCon.address)
  await taxVault.grantRole(await taxVault.WITHDRAW_ROLE(), owner.address)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
