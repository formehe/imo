async function main() {
    const [owner, test1, test2] = await ethers.getSigners();
    const IMOENTRY = "0xc1558A8C5690dC7f919A8604d8039D1e9fc16a97"
    const TOKEN_VAULT = "0x07a6045A800ca8329883CbbE105a3057439Ca1bA"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
    const USDT = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D"
    const AIMODELS = "0x7Bc531Ff53F5ae9cA11F8f0fbBD8A364A3baeE12"
    const MODEL_NAME = "model62"

    aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    await aiModels.recordModelUpload(MODEL_NAME, "v1.0", "v1.0", 1)

    assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    decimal = await assetToken.decimals();
    
    amount = ethers.BigNumber.from(10).pow(decimal).mul(500)
    await assetToken.approve(IMOENTRY, amount);
    imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);
    const tx = await imoEntry.launch(MODEL_NAME, "TT" /* token alias name */, "Test Description", amount);
    await tx.wait();

    tokenVault = await ethers.getContractAt("TokenVault", TOKEN_VAULT);
    await tokenVault.withdraw(ethers.BigNumber.from(10).pow(decimal).mul(5), test1.address);

    usdtAssetToken = await ethers.getContractAt("ERC20Sample", USDT);
    decimal = await usdtAssetToken.decimals();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});