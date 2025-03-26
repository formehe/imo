async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0xA9B23D3598F032770f67E882eF08F747e4D07aA1"
    const AIMODELS = "0x7Bc531Ff53F5ae9cA11F8f0fbBD8A364A3baeE12"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
    const MODEL_NAME = "model3"
    const INTERNAL_ROUTER = "0xD6bf714bA6ded8653B85F21f9A0588C855c59Bd9"
    const tokenAddress = "0x55c25cBC64883828f2a887Be6e2A51E79dF13F9B"
    const USDT = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D"

    // aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    // await aiModels.recordModelUpload(MODEL_NAME, "v1.0", "v1.0", 1)

    // assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    // decimal = await assetToken.decimals();
    // amount = ethers.BigNumber.from(10).pow(decimal).mul(500)
    // await assetToken.approve(IMOENTRY, amount);

    imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);

    // const tx = await imoEntry.launch(MODEL_NAME, "TT" /* token alias name */, "Test Description", amount);
    // await tx.wait();

    // await assetToken.approve(INTERNAL_ROUTER,  amount);
    // await imoEntry.buy(amount, tokenAddress);

    internalToken = await ethers.getContractAt("InternalToken", tokenAddress);
    await internalToken.approve(INTERNAL_ROUTER, ethers.utils.parseEther("500"));
    await imoEntry.sell(ethers.utils.parseEther("500"), tokenAddress);

    // usdtAssetToken = await ethers.getContractAt("ERC20Sample", USDT);
    // decimal = await usdtAssetToken.decimals();
    // amount = ethers.BigNumber.from(10).pow(decimal).mul(500)
    // await usdtAssetToken.approve(IMOENTRY, amount);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});