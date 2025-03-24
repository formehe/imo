async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0x3981D89c79990950AD5AD2DD6b576aFedBf318E4"
    const AIMODELS = "0x13c9447432C6E06503F446d593Cc50aC5C0195A0"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
    const MODEL_NAME = "model7"
    // const USDT = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D"

    aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    await aiModels.recordModelUpload(MODEL_NAME, "v1.0", "v1.0", 1)

    assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    decimal = await assetToken.decimals();
    amount = ethers.BigNumber.from(10).pow(decimal).mul(500)
    await assetToken.approve(IMOENTRY, amount);
    balance = await assetToken.balanceOf(owner.address);

    imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);
    const tx = await imoEntry.launch(MODEL_NAME, "TT" /* token alias name */, "Test Description", amount);
    await tx.wait();

    // usdtAssetToken = await ethers.getContractAt("ERC20Sample", USDT);
    // decimal = await usdtAssetToken.decimals();
    // amount = ethers.BigNumber.from(10).pow(decimal).mul(500)
    // await usdtAssetToken.approve(IMOENTRY, amount);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});