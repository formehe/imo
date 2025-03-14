async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0xC1E449E7F5EB927f41A14E0E0d2039A6f1518b40"
    const AIMODELS = "0xdB32354C6a32ff61AEaBa581fCF90D4eD696bA8e"
    const ASSET_ERC20 = "0x760cfB5D96216a9F3565063400EF550f97f2f723"
    const MODEL_NAME = "model1"

    aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    await aiModels.recordModelUpload(MODEL_NAME, "v1.0", "", 1)

    assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    await assetToken.approve(IMOENTRY, ethers.utils.parseEther("500"));

    imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);
    const tx = await imoEntry.launch(MODEL_NAME, "TT" /* token alias name */, "Test Description", ethers.utils.parseEther("500"));
    await tx.wait();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});