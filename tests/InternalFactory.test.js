const { expect } = require("chai");
const { ethers, UniswapV2Deployer } = require("hardhat");
const { deployAndCloneContract } = require("./utils")
const { AddressZero } = require("ethers").constants

describe("InternalFactory Contract", function () {
    let internalFactory, internalRouter, erc20Sample;
    let owner, creator, user1, user2, admin;
    let internalToken, taxVault;
    const buyTax = 1;  // 1% 购买税
    const sellTax = 2; // 2% 卖出税
    const totalSupply = 10000000000;
    let UNISWAP_ROUTER;

    beforeEach(async function () {
        [owner, creator, user1, user2, taxVault, admin] = await ethers.getSigners();

        const { factory, router, weth9 } = await UniswapV2Deployer.deploy(owner);
        UNISWAP_ROUTER = router.address;

        const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
        erc20Sample = await ERC20Sample.deploy("Asset Token", "ASSET");
        await erc20Sample.deployed();

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
        await internalRouter.initialize(internalFactory.address, erc20Sample.address)    
        // configure erc20 asset

        // configure internal factory
        await internalFactory.grantRole(await internalFactory.CREATOR_ROLE(), creator.address)
        await internalFactory.grantRole(await internalFactory.ADMIN_ROLE(), admin.address)
        await internalFactory.connect(admin).setRouter(internalRouter.address)

        // configure internal router
        await internalRouter.grantRole(await internalRouter.EXECUTOR_ROLE(), admin.address)
    });

    it("should initialize correctly", async function () {
        expect(await internalFactory.taxVault()).to.equal(taxVault.address);
        expect(await internalFactory.buyTax()).to.equal(buyTax);
        expect(await internalFactory.sellTax()).to.equal(sellTax);
        expect(await internalFactory.router()).to.equal(internalRouter.address);
    });

    it("should allow creator to create a pair", async function () {
        const tx = await internalFactory.connect(creator).createPair(erc20Sample.address, internalToken.address);
        const receipt = await tx.wait();
        
        const event = receipt.events.find(e => e.event === "PairCreated");
        expect(event).to.not.be.undefined;

        const pairAddress = event.args.pair;
        expect(await internalFactory.getPair(erc20Sample.address, internalToken.address)).to.equal(pairAddress);
        expect(await internalFactory.getPair(erc20Sample.address, internalToken.address)).to.equal(pairAddress);
        expect(await internalFactory.allPairsLength()).to.equal(1);

        await expect(internalFactory.connect(creator).createPair(AddressZero, internalToken.address)).to.be.revertedWith(/Zero addresses/)
        await expect(internalFactory.connect(creator).createPair(erc20Sample.address, AddressZero)).to.be.revertedWith(/Zero addresses/)
    });

    it("should prevent non-creator from creating a pair", async function () {
        await expect(internalFactory.connect(user1).createPair(erc20Sample.address, internalToken.address))
            .to.be.revertedWith(/is missing role/);
    });

    it("should prevent creating a pair with zero address", async function () {
        await expect(internalFactory.connect(creator).createPair(ethers.constants.AddressZero, internalToken.address))
            .to.be.revertedWith("Zero addresses are not allowed.");
    });

    it("should allow admin to update tax parameters", async function () {
        const newTaxVault = user1.address;
        const newBuyTax = 3;
        const newSellTax = 4;

        await internalFactory.connect(admin).setTaxParams(newTaxVault, newBuyTax, newSellTax);
        
        expect(await internalFactory.taxVault()).to.equal(newTaxVault);
        expect(await internalFactory.buyTax()).to.equal(newBuyTax);
        expect(await internalFactory.sellTax()).to.equal(newSellTax);
    });

    it("should prevent non-admin from updating tax parameters", async function () {
        await expect(internalFactory.connect(user1).setTaxParams(user2.address, buyTax, sellTax))
            .to.be.revertedWith(/is missing role/);
    });

    it("should prevent setting taxVault to zero address", async function () {
        await expect(internalFactory.connect(admin).setTaxParams(ethers.constants.AddressZero, buyTax, sellTax))
            .to.be.revertedWith("Zero addresses are not allowed.");
    });

    it("should allow admin to update router address", async function () {
        const newRouter = user1.address;
        await internalFactory.connect(admin).setRouter(newRouter);
        expect(await internalFactory.router()).to.equal(newRouter);
    });

    it("should prevent non-admin from updating router address", async function () {
        await expect(internalFactory.connect(user1).setRouter(user2.address))
            .to.be.revertedWith(/is missing role/);
    });

    it("should prevent renouncing roles", async function () {
        await expect(internalFactory.connect(owner).renounceRole(await internalFactory.ADMIN_ROLE(), owner.address))
            .to.be.revertedWith("not support");
    });
});