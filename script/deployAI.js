const toWei = (val) => ethers.utils.parseEther("" + val);

async function main() {
    const usdtToken = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D";
    const topToken = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b";

    const AssetManagement = await ethers.getContractFactory("AssetManagement");
    const assetManagement = await AssetManagement.deploy();
    await assetManagement.deployed();
    console.log("Asset Management is :", assetManagement.address)
    console.log("Transaction hash :", assetManagement.deployTransaction.hash)

    const NodesRegistry = await ethers.getContractFactory("NodesGovernance");
    nodesRegistry = await NodesRegistry.deploy();
    await nodesRegistry.deployed();
    console.log("Node registry is :", nodesRegistry.address)
    console.log("Transaction hash :", nodesRegistry.deployTransaction.hash)

    const AIModelUploadFactory = await ethers.getContractFactory("AIModels");
    aiModelUpload = await AIModelUploadFactory.deploy(nodesRegistry.address, assetManagement.address);
    await aiModelUpload.deployed();
    console.log("AI model is :", aiModelUpload.address)
    console.log("Transaction hash :", aiModelUpload.deployTransaction.hash)

    const BankFactory = await ethers.getContractFactory("Bank");
    bank = await BankFactory.deploy(usdtToken, topToken);
    await bank.deployed();
    console.log("bank is :", bank.address);
    console.log("bank deploy Transaction hash :", bank.deployTransaction.hash);

    const updateRateTx = await bank.updateRate(toWei("1"));
    await updateRateTx.wait();

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
    aiWorkload = await AIWorkload.deploy(nodesRegistry.address, aiModelUpload.address, assetManagement.address, SettlementCon.address);
    await aiWorkload.deployed();
    console.log("AIWorkload is :", aiWorkload.address)
    console.log("Transaction hash :", aiWorkload.deployTransaction.hash)

    await SettlementCon.grantRole(MINTER_ROLE, aiWorkload.address);
    await DepositCon.grantRole(MINTER_ROLE, SettlementCon.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});