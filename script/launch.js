async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0x8B7c84783Ac4c42eAE61a7553dBd5f35065b5813"
    const TOKEN_VAULT = "0x79E303e8d11bAaf1920954E3aF80813d05b2D1FA"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
    const USDT = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D"
    const AIMODELS = "0x30c98C8d9e63BC51967a7F35fD9D441A31656EC1"
    const MODEL_NAME = "test30"
    
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
    await tokenVault.withdraw(ethers.BigNumber.from(10).pow(decimal).mul(5), owner.address);

    usdtAssetToken = await ethers.getContractAt("ERC20Sample", USDT);
    decimal = await usdtAssetToken.decimals();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});