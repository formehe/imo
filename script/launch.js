async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0x6A48698F95ea7AE9f6b08a7EC241Ed6026EF0743"
    const AIMODELS = "0x15A9238912cea445B3827D86B2f8f2b2Ab13370e"
    const ASSET_ERC20 = "0x5aB0d69bc164F3e7502CE0c8C3a9a7BfEf1EB634"

    aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);
    assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    modelInfo = await aiModels.recordModelUpload("model1", "model1", "model1", 1)
    await assetToken.approve(imoEntry.address, ethers.utils.parseEther("500"));
    const tx = await imoEntry.launch("model1", "TT", "Test Description", ethers.utils.parseEther("500"), modelInfo);
    await tx.wait();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});