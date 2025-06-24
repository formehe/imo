async function main() {
    const [owner, platformOperator, platformAirdropOwner] = await ethers.getSigners();
    const IMOENTRY = "0x50b77eA763832FB6Ff4C089A81f99893aA728f5A"
    const TOKEN_VAULT = "0xA9E3eb7Dbc675A3cF9fef5770Ea800f20211E65d"
    const ASSET_ERC20 = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"
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
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});