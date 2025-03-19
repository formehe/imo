async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0xEA9945c23719F2abE4A450133A5f189b8c9Bb096"
    const AIMODELS = "0x13c9447432C6E06503F446d593Cc50aC5C0195A0"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
    const MODEL_NAME = "model6"

    aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    await aiModels.recordModelUpload(MODEL_NAME, "v1.0", "v1.0", 1)

    amount = ethers.BigNumber.from(10).pow(decimal).mul(500)
    assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    decimal = await assetToken.decimals();
    await assetToken.approve(IMOENTRY, amount);
    balance = await assetToken.balanceOf(owner.address);

    imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);
    const tx = await imoEntry.launch(MODEL_NAME, "TT" /* token alias name */, "Test Description", amount);
    await tx.wait();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});