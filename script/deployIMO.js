const { deployAndProxyContract } = require("../tests/utils")

let   deployedContracts = [
    {name: "ProxyAdmin", address: "0x358888998028882dF6d81B74224d61DbaA3Ba298"},
    {name: "InternalFactory", address: "0x1C7D9B2B0e18A164F4E55eD692F00D3B91ff05ef"},
    {name: "InternalRouter", address: "0xB5D4dd5b6deE28c6b5B0268ad4ac7Cb9f8791090"},
    {name: "ModelToken", address: "0xf2C6d0db7A5B699d03342ecA9c809689a03ac49e"},
    {name: "ModelLockToken", address: "0xAE755002307dF04404441d0dF6720b844A302790"},
    {name: "ModelFactory", address: "0x9C54e18bA9b986216914742a9a0f6e82a57F6AcB"},
    {name: "IMOEntry", address: "0x73C3F4bE6f3Ba94830D915C99fC1cC5786232fF3"},
    {name: "TokenVault", address: "0xB7A66569019d6B70169677f465D2c6a543636c6c"},
]

async function deployWithRetry(factory, retries = 5, delay = 5000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`尝试部署合约 (${i + 1}/${retries})...`);
            const contract = await factory.deploy(); // 触发部署
            console.log("交易已提交:", contract.deployTransaction.hash);

            await waitForDeploymentWithRetry(contract); // 等待部署完成
            console.log("合约已成功部署:", contract.address);
            return contract;
        } catch (error) {
            lastError = error;
            console.error(`部署失败: ${error.message}, ${i < retries - 1 ? "重试中..." : "已达最大重试次数"}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

async function waitForDeploymentWithRetry(contract, retries = 5, delay = 3000) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`尝试等待合约部署 (${i + 1}/${retries})...`);
            await contract.deployed();
            console.log("合约已成功部署:", contract.address);
            return contract;
        } catch (error) {
            lastError = error;
            console.error(`等待失败: ${error.message}, ${i < retries - 1 ? "重试中..." : "已达最大重试次数"}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

function getAddressByName(name) {
    let contract = deployedContracts.find(c => c.name === name);
    return contract ? contract.address : undefined;
}

async function main() {
    [owner] = await ethers.getSigners();

    const UNISWAP_ROUTER = "0x626459cF9438259ed0812D71650568306486CB00";
    const AI_MODELS = "0x30c98C8d9e63BC51967a7F35fD9D441A31656EC1";
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
            const proxyAdmin = await deployWithRetry(ProxyAdmin)
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
        const internalFactoryTemplate = await deployWithRetry(InternalFactoryTemplate)
        console.log("InternalFactoryTemplate is :", internalFactoryTemplate.address)
        
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
        const internalRouterTemplate = await deployWithRetry(InternalRouterTemplate);
        console.log("InternalRouterTemplate is :", internalRouterTemplate.address)
        
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
        modelTokenTemplate = await deployWithRetry(ModelTokenTemplate)
        console.log("ModelTokenTempalte is :", modelTokenTemplate.address)
        
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
        modelLockTokenTemplate = await deployWithRetry(ModelLockTokenTemplate)
        console.log("ModelLockTokenTempalte is :", modelLockTokenTemplate.address)
        
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
        modelFactoryTemplate = await deployWithRetry(ModelFactoryTemplate);
        console.log("ModelFactoryTemplate is :", modelFactoryTemplate.address)
        
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
        imoEntryTemplate = await deployWithRetry(IMOEntryTemplate);
        console.log("IMOEntryTemplate is :", imoEntryTemplate.address)
        
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
        tokenVaultTemplate = await deployWithRetry(TokenVaultTemplate);
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
        console.log("TokenVault")
        await tokenVault.initialize(assetAddress)
        await tokenVault.grantRole(await tokenVault.WITHDRAW_ROLE(), owner.address)
    }

    // configure internal factory
    contract = getAddressByName("InternalFactory")
    if (contract === "0x") {
        console.log("InternalFactory")
        await internalFactory.initialize(tokenVault.address /*address taxVault_*/, BUY_TAX, SELL_TAX)
        await internalFactory.grantRole(await internalFactory.CREATOR_ROLE(), imoEntry.address)
        await internalFactory.grantRole(await internalFactory.ADMIN_ROLE(), owner.address)
        await internalFactory.connect(owner).setRouter(internalRouter.address)
    }

    // configure internal router
    contract = getAddressByName("InternalRouter")
    if (contract === "0x") {
        console.log("InternalRouter")
        await internalRouter.initialize(internalFactory.address, assetAddress)
        await internalRouter.grantRole(await internalRouter.EXECUTOR_ROLE(), imoEntry.address)
    }

    // configure model factory
    contract = getAddressByName("ModelFactory")
    if (contract === "0x") {
        console.log("ModelFactory")
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
        console.log("IMOEntry")
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