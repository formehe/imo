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

    // const INTERNAL_ROUTER = "0x94ff4Cd3145B8cdA11aC246e7172270d54c58018"
    // const MODEL_FACTORY = "0x4E1520E3a5D4917762CA636Eff7061162F56Eb63"
    // const SWAP_ROUTER = "0x626459cF9438259ed0812D71650568306486CB00"
    // assetToken = await ethers.getContractAt("ERC20Sample", ASSET_ERC20);
    // decimal = await assetToken.decimals();
    // imoEntry = await ethers.getContractAt("IMOEntry", IMOENTRY);
    // const tokenAddress = (await imoEntry.tokenInfos(0)).toString();

    // amount = ethers.BigNumber.from(10).pow(decimal).mul(1100000)

    // for (let i = 0; i < 29; i++) {
    //     await assetToken.approve(INTERNAL_ROUTER, amount);
    //     await imoEntry.buy(amount, tokenAddress);
    // }

    // await imoEntry.unwrapToken(tokenAddress, [owner.address])
    // const tokenInfo = await imoEntry.tokenInfo(tokenAddress);
    // modelFactory = await ethers.getContractAt("ModelFactory", MODEL_FACTORY);
    // const application = await modelFactory.getApplication(tokenInfo.applicationId);
    // internalRouter = await ethers.getContractAt("InternalRouter", INTERNAL_ROUTER);
    // swapRouter = await ethers.getContractAt("IUniswapV2Router02", SWAP_ROUTER);

    // staking = await ethers.getContractAt("Staking", application.stakeToken);
    // modelToken = await ethers.getContractAt("ModelToken", application.token);
    // rewardToken = await ethers.getContractAt("Reward", application.rewardToken);

    // await modelToken.approve(application.stakeToken, ethers.constants.MaxUint256);
    // await staking.stake(ethers.BigNumber.from(10).pow(decimal).mul(1000000));
    // amount = ethers.BigNumber.from(10).pow(decimal).mul(100000)
    // await assetToken.approve(SWAP_ROUTER, amount);
    // await swapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
    //     amount,
    //     0, // accept any amount of TOP
    //     [ASSET_ERC20, application.token],
    //     owner.address,
    //     Math.floor(Date.now() / 1000) + 60 * 20 // deadline 20 minutes from now
    // );

    // await rewardToken.distributeTaxTokens();
    // await staking.claimReward();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});