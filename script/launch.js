async function main() {
    const [owner] = await ethers.getSigners();
    const IMOENTRY = "0xd0f82eb271Ab78B76A669eD1288041495249A768"
    const TOKEN_VAULT = "0x8258C2C45B4ad9bEa8AD62bf4Cfa470B3B9B2ca7"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
    const USDT = "0xc9B4e5c5CD83EfA16bC89b49283381aD2c74710D"
    const AIMODELS = "0x4d3aec3d99d5B1Edf2C375657d0765D960175a3b"
    const MODEL_NAME = "test3"
    
    aiModels = await ethers.getContractAt("AIModels", AIMODELS);
    await aiModels.recordModelUpload(MODEL_NAME, "v1.0", "v1.0", 0, 1)

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