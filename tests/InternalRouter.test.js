const { expect } = require("chai");
const { ethers, upgrades, UniswapV2Deployer} = require("hardhat");
const {deployAndCloneContract} = require("./utils");
const internal = require("stream");

describe("InternalRouter Contract", function () {
    let internalFactory, internalRouter;
    let owner, executor, user1, user2, taxVault, creator, admin;
    let internalToken, assetToken;
    const buyTax  = 2;  // 2% 购买税
    const sellTax = 3; // 3% 卖出税
    const totalSupply = 10000000000;
    let UNISWAP_ROUTER;

    beforeEach(async function () {
        [owner, executor, user1, user2, taxVault, creator, admin] = await ethers.getSigners();

        const { factory, router, weth9 } = await UniswapV2Deployer.deploy(owner);
        UNISWAP_ROUTER = router.address; 

        const Token = await ethers.getContractFactory("ERC20Sample");
        assetToken = await Token.deploy("Asset Token", "AST");
        await assetToken.deployed();

        const InternalToken = await ethers.getContractFactory("InternalToken");
        internalToken = await InternalToken.deploy("TokenA", "TKA", totalSupply, 1, UNISWAP_ROUTER);
        await internalToken.deployed();

        const InternalFactoryTemplate = await ethers.getContractFactory("InternalFactory");
        const internalFactoryTemplate = await InternalFactoryTemplate.deploy();
        await internalFactoryTemplate.deployed();
        let clonedContractAddress = await deployAndCloneContract(ethers, internalFactoryTemplate.address)
        internalFactory = await ethers.getContractAt("InternalFactory", clonedContractAddress);
    
        // internal router
        const InternalRouterTemplate = await ethers.getContractFactory("InternalRouter");
        const internalRouterTemplate = await InternalRouterTemplate.deploy();
        await internalRouterTemplate.deployed();
        clonedContractAddress = await deployAndCloneContract(ethers, internalRouterTemplate.address)
        internalRouter = await ethers.getContractAt("InternalRouter", clonedContractAddress);

        await internalFactory.initialize(taxVault.address /*address taxVault_*/, buyTax /* %, uint256 buyTax_ */, sellTax /*%， uint256 sellTax_*/)
        await internalRouter.initialize(internalFactory.address, assetToken.address)    

        // configure internal factory
        await internalFactory.grantRole(await internalFactory.CREATOR_ROLE(), creator.address)
        await internalFactory.grantRole(await internalFactory.ADMIN_ROLE(), admin.address)
        await internalFactory.connect(admin).setRouter(internalRouter.address)

        // configure internal router
        await internalRouter.grantRole(await internalRouter.EXECUTOR_ROLE(), executor.address)
    });

    it("should initialize correctly", async function () {
        expect(await internalRouter.factory()).to.equal(internalFactory.address);
        expect(await internalRouter.assetToken()).to.equal(assetToken.address);
    });

    it("should allow executor to add liquidity", async function () {
        await internalFactory.connect(creator).createPair(internalToken.address, assetToken.address);
        await internalToken.transfer(executor.address, ethers.utils.parseEther("100"));
        await assetToken.transfer(executor.address, ethers.utils.parseEther("100"));

        await internalToken.connect(executor).approve(internalRouter.address, ethers.utils.parseEther("100"));
        await assetToken.connect(executor).approve(internalRouter.address, ethers.utils.parseEther("100"));

        await internalRouter.connect(executor).addInitialLiquidity(
            internalToken.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("10")
        )
    });

    it("should allow executor to sell tokens", async function () {
        await internalFactory.connect(creator).createPair(internalToken.address, assetToken.address);
        await internalToken.transfer(executor.address, ethers.utils.parseEther("50"));

        await internalToken.connect(executor).approve(internalRouter.address, ethers.utils.parseEther("50"));
        pair = await internalFactory.getPair(internalToken.address, assetToken.address)
        await assetToken.transfer(pair, ethers.utils.parseEther("50"));
        await internalRouter.connect(executor).addInitialLiquidity(
            internalToken.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("10")
        )

        amount = await internalRouter.connect(executor).callStatic["sell(uint256,address,address)"](ethers.utils.parseEther("5"), internalToken.address, executor.address)
        await internalRouter.connect(executor).sell(
            ethers.utils.parseEther("5"),
            internalToken.address,
            executor.address
        );

        // await assetToken.balanceOf(executor.address)
    });

    it("should allow executor to buy tokens", async function () {
        await internalFactory.connect(creator).createPair(internalToken.address, assetToken.address);
        await assetToken.transfer(executor.address, ethers.utils.parseEther("50"));

        await assetToken.connect(executor).approve(internalRouter.address, ethers.utils.parseEther("50"));
        await internalToken.transfer(executor.address, ethers.utils.parseEther("50"));
        await internalToken.connect(executor).approve(internalRouter.address, ethers.utils.parseEther("50"));

        await internalRouter.connect(executor).addInitialLiquidity(
            internalToken.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("10")
        )

        await internalRouter.connect(executor).buy(
            ethers.utils.parseEther("5"),
            internalToken.address,
            executor.address
        )
    });

    it("should prevent non-executor from adding liquidity", async function () {
        await internalFactory.connect(creator).createPair(internalToken.address, assetToken.address);

        await expect(internalRouter.connect(user1).addInitialLiquidity(
            internalToken.address,
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("10")
        )).to.be.revertedWith(/is missing role/);
    });

    it("should prevent non-executor from selling tokens", async function () {
        await internalFactory.connect(creator).createPair(internalToken.address, assetToken.address);

        await expect(internalRouter.connect(user1).sell(
            ethers.utils.parseEther("5"),
            internalToken.address,
            user1.address
        )).to.be.revertedWith(/is missing role/);
    });

    it("should prevent non-executor from buying tokens", async function () {
        await internalFactory.connect(creator).createPair(internalToken.address, assetToken.address);

        await expect(internalRouter.connect(user1).buy(
            ethers.utils.parseEther("5"),
            internalToken.address,
            user1.address
        )).to.be.revertedWith(/is missing role/);
    });
});
