const { deployAndProxyContract } = require("../tests/utils")

let   deployedContracts = [
    {name: "ProxyAdmin", address: "0xcF153C14FD9cf6f275a00b7384ABc8aDc5aeab11"},
    {name: "InternalFactory", address: "0x9380DE638b84E50C0d53b16a577eac3414F6D905"},
    {name: "InternalRouter", address: "0x3301Fd23d63CE30cDC3D203839E7A8B67c81a7D0"},
    {name: "ModelToken", address: "0xe038F6D2453Acc12220d4B638Ea98A4A73f3aFB7"},
    {name: "ModelLockToken", address: "0x5Cbf049109220556eD961710e163bA4D4e1A0308"},
    {name: "ModelFactory", address: "0xC9836f34f87Ae61Fee9F8bB2cfe819342D095CB8"},
    {name: "IMOEntry", address: "0xc1558A8C5690dC7f919A8604d8039D1e9fc16a97"},
    {name: "TokenVault", address: "0x07a6045A800ca8329883CbbE105a3057439Ca1bA"},
]

function getAddressByName(name) {
    let contract = deployedContracts.find(c => c.name === name);
    return contract ? contract.address : undefined;
}

async function main() {
    [owner] = await ethers.getSigners();

    const UNISWAP_ROUTER = "0x626459cF9438259ed0812D71650568306486CB00";
    const AI_MODELS = "0x7Bc531Ff53F5ae9cA11F8f0fbBD8A364A3baeE12";
    const BUY_TAX = 1; //%, internal swap tax
    const SELL_TAX = 1; //%, internal swap tax
    const MATURITY_DURATION = 315360000;// 10 years
    let   assetAddress;
    let   tokenAdmin = owner.address;

    //address taxVault_ = //

    // token
    // const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    // const erc20Sample = await ERC20Sample.deploy("Asset Token", "ASSET");
    // await erc20Sample.deployed();
    // console.log("ERC20Sample is :", erc20Sample.address)
    // console.log("Transaction hash :", erc20Sample.deployTransaction.hash)
    assetAddress = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b"

    const proxyAdmin = await (async () => {
        contract = getAddressByName("ProxyAdmin")
        if (contract === "0x") {
            const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
            const proxyAdmin = await ProxyAdmin.deploy();
            await proxyAdmin.deployed();
            console.log("ProxyAdmin is :", proxyAdmin.address)
            return proxyAdmin
        } else {
            const proxyAdmin = await ethers.getContractAt("ProxyAdmin", contract)
            return proxyAdmin
        }
    })()

    // internal swap
    // internal factory
    const internalFactory = await (async () => {
        contract = getAddressByName("InternalFactory")
        const InternalFactoryTemplate = await ethers.getContractFactory("InternalFactory");
        const internalFactoryTemplate = await InternalFactoryTemplate.deploy();
        await internalFactoryTemplate.deployed();
        console.log("InternalFactoryTemplate is :", internalFactoryTemplate.address)
        console.log("Transaction hash :", internalFactoryTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, internalFactoryTemplate.address, proxyAdmin.address)
            const internalFactory = await InternalFactoryTemplate.attach(proxyAddress);
            console.log("InternalFactory is :", proxyAddress)
            return internalFactory
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, internalFactoryTemplate.address);
            const internalFactory = await InternalFactoryTemplate.attach(contract);
            console.log("InternalFactory is :", contract)
            return internalFactory
        }
    })()

    // internal router
    const internalRouter = await (async () => {
        contract = getAddressByName("InternalRouter")
        const InternalRouterTemplate = await ethers.getContractFactory("InternalRouter");
        const internalRouterTemplate = await InternalRouterTemplate.deploy();
        await internalRouterTemplate.deployed();
        console.log("InternalRouterTemplate is :", internalRouterTemplate.address)
        console.log("Transaction hash :", internalRouterTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, internalRouterTemplate.address, proxyAdmin.address)
            const internalRouter = await InternalRouterTemplate.attach(proxyAddress);
            console.log("InternalRouter is :", proxyAddress)
            return internalRouter
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, internalRouterTemplate.address);
            const internalRouter = await InternalRouterTemplate.attach(contract);
            console.log("InternalRouter is :", contract)
            return internalRouter
        }
    })()

    // model token template
    const modelToken = await (async () => {
        contract = getAddressByName("ModelToken")
        const ModelTokenTemplate = await ethers.getContractFactory("ModelToken");
        modelTokenTemplate = await ModelTokenTemplate.deploy();
        await modelTokenTemplate.deployed();
        console.log("ModelTokenTempalte is :", modelTokenTemplate.address)
        console.log("Transaction hash :", modelTokenTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, modelTokenTemplate.address, proxyAdmin.address)
            const modelToken = await ModelTokenTemplate.attach(proxyAddress);
            console.log("ModelToken is :", proxyAddress)
            return modelToken
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, modelTokenTemplate.address);
            const modelToken = await ModelTokenTemplate.attach(contract);
            console.log("ModelToken is :", contract)
            return modelToken
        }
    })()

    const modelLockToken = await (async () => {
        contract = getAddressByName("ModelLockToken")
        const ModelLockTokenTemplate = await ethers.getContractFactory("ModelLockToken");
        modelLockTokenTemplate = await ModelLockTokenTemplate.deploy();
        await modelLockTokenTemplate.deployed();
        console.log("ModelLockTokenTempalte is :", modelLockTokenTemplate.address)
        console.log("Transaction hash :", modelLockTokenTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, modelLockTokenTemplate.address, proxyAdmin.address)
            const modelLockToken = await ModelLockTokenTemplate.attach(proxyAddress);
            console.log("ModelLockToken is :", proxyAddress)
            return modelLockToken
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, modelLockTokenTemplate.address);
            const modelLockToken = await ModelLockTokenTemplate.attach(contract);
            console.log("ModelLockToken is :", contract)
            return modelLockToken
        }
    })()

    const modelFactory = await (async () => {
        contract = getAddressByName("ModelFactory")
        const ModelFactoryTemplate = await ethers.getContractFactory("ModelFactory");
        modelFactoryTemplate = await ModelFactoryTemplate.deploy();
        await modelFactoryTemplate.deployed();
        console.log("ModelFactoryTemplate is :", modelFactoryTemplate.address)
        console.log("Transaction hash :", modelFactoryTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, modelFactoryTemplate.address, proxyAdmin.address)
            const modelFactory = await ModelFactoryTemplate.attach(proxyAddress);
            console.log("ModelFactory is :", proxyAddress)
            return modelFactory
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, modelFactoryTemplate.address);
            const modelFactory = await ModelFactoryTemplate.attach(contract);
            console.log("ModelFactory is :", contract)
            return modelFactory
        }
    })()

    // imo platform entry
    const imoEntry = await (async () => {
        contract = getAddressByName("IMOEntry")
        const IMOEntryTemplate = await ethers.getContractFactory("IMOEntry");
        imoEntryTemplate = await IMOEntryTemplate.deploy();
        await imoEntryTemplate.deployed();
        console.log("IMOEntryTemplate is :", imoEntryTemplate.address)
        console.log("Transaction hash :", imoEntryTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, imoEntryTemplate.address, proxyAdmin.address)
            const imoEntry = await IMOEntryTemplate.attach(proxyAddress);
            console.log("IMOEntry is :", proxyAddress)
            return imoEntry
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, imoEntryTemplate.address);
            const imoEntry = await IMOEntryTemplate.attach(contract);
            console.log("IMOEntry is :", contract)
            return imoEntry
        }
    })()

    const tokenVault = await (async () => {
        contract = getAddressByName("TokenVault")
        const TokenVaultTemplate = await ethers.getContractFactory("TokenVault");
        tokenVaultTemplate = await TokenVaultTemplate.deploy();
        await tokenVaultTemplate.deployed();
        console.log("TokenVaultTemplate is :", tokenVaultTemplate.address)
        console.log("Transaction hash :", tokenVaultTemplate.deployTransaction.hash)
        if (contract === "0x") {
            const proxyAddress = await deployAndProxyContract(ethers, tokenVaultTemplate.address, proxyAdmin.address)
            const tokenVault = await TokenVaultTemplate.attach(proxyAddress);
            console.log("TokenVault is :", proxyAddress)
            return tokenVault
        } else {
            const proxy = await ethers.getContractAt("TransparentUpgradeableProxy", contract)
            await proxyAdmin.upgrade(proxy.address, tokenVaultTemplate.address);
            const tokenVault = await TokenVaultTemplate.attach(contract);
            console.log("TokenVault is :", contract)
            return tokenVault
        }
    })()

    // configure token vault
    contract = getAddressByName("TokenVault")
    if (contract === "0x") {
        await tokenVault.initialize(assetAddress)
        await tokenVault.grantRole(await tokenVault.WITHDRAW_ROLE(), owner.address)
    }

    // configure internal factory
    contract = getAddressByName("InternalFactory")
    if (contract === "0x") {
        await internalFactory.initialize(tokenVault.address /*address taxVault_*/, BUY_TAX, SELL_TAX)
        await internalFactory.grantRole(await internalFactory.CREATOR_ROLE(), imoEntry.address)
        await internalFactory.grantRole(await internalFactory.ADMIN_ROLE(), owner.address)
        await internalFactory.connect(owner).setRouter(internalRouter.address)
    }

    // configure internal router
    contract = getAddressByName("InternalRouter")
    if (contract === "0x") {
        await internalRouter.initialize(internalFactory.address, assetAddress)
        await internalRouter.grantRole(await internalRouter.EXECUTOR_ROLE(), imoEntry.address)
    }

    // configure model factory
    contract = getAddressByName("ModelFactory")
    if (contract === "0x") {
        await modelFactory.initialize(modelToken.address, modelLockToken.address, assetAddress, 1/* next id */)
        await modelFactory.grantRole(await modelFactory.BONDING_ROLE(), imoEntry.address)
        await modelFactory.setTokenAdmin(tokenAdmin)
        await modelFactory.setUniswapRouter(UNISWAP_ROUTER)
        await modelFactory.setTokenTaxParams(0, 0, 0) // set extra external swap tax
        await modelFactory.setMaturityDuration(MATURITY_DURATION) //set 10 years of initial asset lock time
    }

    // configure IMOEntry
    contract = getAddressByName("IMOEntry")
    if (contract === "0x") {
        await imoEntry.initialize(
            internalFactory.address, 
            internalRouter.address, 
            tokenVault.address /*address feeTo_*/,
            500 /** fee 10 **12 */, 
            1000000000 /* uint256 initialSupply_ */, 
            30000 /*uint256 assetRate_, 100 top -> 10^12 liquid K*/,
            50 /* %,uint256 maxTx_ */, 
            modelFactory.address, 
            ethers.utils.parseEther("1000000"),// gradThreshold
            UNISWAP_ROUTER,
            AI_MODELS
          )
    }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});