const hre = require("hardhat");

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
    
  //   let nodeInfos = [
  //     {
  //         identifier: addr1.address,
  //         aliasIdentifier: "11111111111111111",
  //         wallet: addr1.address,
  //         gpuTypes: ["A100", "V100"],
  //         gpuNums: [2, 3]
  //     },
  //     {
  //         identifier: addr2.address,
  //         aliasIdentifier: "21111111111111111",
  //         wallet: addr2.address,
  //         gpuTypes: ["A100", "V100"],
  //         gpuNums: [2, 3]
  //     }
  // ]
  // await nodesRegistry.nodesGovernance_initialize(nodeInfos, addr1.address, ROUND_DURATION_TIME)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});