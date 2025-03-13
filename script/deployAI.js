async function main() {
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

    AIWorkload = await ethers.getContractFactory("AIWorkload");
    aiWorkload = await AIWorkload.deploy(nodesRegistry.address, aiModelUpload.address, assetManagement.address);
    await aiWorkload.deployed();
    console.log("AI Work is :", aiWorkload.address)
    console.log("Transaction hash :", aiWorkload.deployTransaction.hash)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});