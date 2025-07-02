const { deployAndProxyContract,deployAndCloneContract} = require("../tests/utils")

// Asset Management is : 0x1582D0d87D3518216b7A780b2e452fdf81BA338F
// Node registry is : 0xDee66F4500079041Fe2A795d9ADab04aFf9b04e8
// AI model is : 0xf64CDc1493a9bf3e7D47D853FB621F046e8E10F4

// bank is : 0x4abec927Ea1D4d2d811681D3447e8e4E9a542989
// Deposit is : 0x74699d1174006A03924413ec280ba3feD44d8689
// Settlement is : 0x71Ea5Bc359F583fc7aB39dc6e967999fA2146cE8
// AI Workload is : 0x67b0B9B2194705b9a494dc6ddd5a0E3c5758F8b4

// {name: "ProxyAdmin", address: "0xA7F590c8B2D0435824B15CD41B66173473C71CCE"},
// {name: "InternalFactory", address: "0xB40fA8Ea39005dB6Aa500654666f0A58A861FA05"},
// {name: "InternalRouter", address: "0x790e610E51d55ef82EB272102C9bc5833eDFB99c"},
// {name: "ModelToken", address: "0xaB49c2F12b7B98cEf29d4a3441FFDf0782039c5B"},
// {name: "ModelLockToken", address: "0x1cFb5fbd5b9f4e9c88db8019E220dc5E59D7835B"},
// {name: "ModelFactory", address: "0xa8773c3c9d70bF5C5d274A3b1c8Db9238c638Abe"},
// {name: "IMOEntry", address: "0xd0f82eb271Ab78B76A669eD1288041495249A768"},
// {name: "TokenVault", address: "0x8258C2C45B4ad9bEa8AD62bf4Cfa470B3B9B2ca7"},

let   deployedContracts = [
    {name: "ProxyAdmin", address: "0xc3600232936F933BA530d121A9c286c0459c47e7"},
    {name: "InternalFactory", address: "0x9a636bd4A969c2A36035BB3D5397e1A6AFAd2228"},
    {name: "InternalRouter", address: "0x94ff4Cd3145B8cdA11aC246e7172270d54c58018"},
    {name: "ModelToken", address: "0x1BCe45ebdD26Ad053E52f6c50F4e3Ca7617Db4f8"},
    {name: "ModelLockToken", address: "0x7E658bE8ca9E0F1120cCaEdDe1cB155f9e5ad3C7"},
    {name: "Staking", address: "0x350181C5917dc5Dce4f4fCa331c7a246B218a450"},
    {name: "Reward", address: "0xCC5229392e6B9fB5B9E30f0c5d37Cedcf70Bd4f8"},
    {name: "Airdrop", address: "0x3c0e60D4188d426496359275EE3811026c35D1Ac"},
    {name: "ModelFactory", address: "0x4E1520E3a5D4917762CA636Eff7061162F56Eb63"},
    {name: "IMOEntry", address: "0x50b77eA763832FB6Ff4C089A81f99893aA728f5A"},
    {name: "TokenVault", address: "0xA9E3eb7Dbc675A3cF9fef5770Ea800f20211E65d"},
    {name: "Redeem", address: "0x541DA870291251cf87a36A72eCD17ED5F21e816A"},
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
    [owner, platformOperator, platformAirdropOwner] = await ethers.getSigners();

    const TAX_VAULT = "0xF2EB27C06F8A4C72710765E29923Ea9b21Dea912";
    const UNISWAP_ROUTER = "0x626459cF9438259ed0812D71650568306486CB00";
    const AI_MODELS = "0x4d3aec3d99d5B1Edf2C375657d0765D960175a3b";
    const BUY_TAX = 1; //%, internal swap tax
    const SELL_TAX = 1; //%, internal swap tax
    const MATURITY_DURATION = 315360000;// 10 years
    let   assetAddress = "0x7e5eF930DA3b4F777dA4fAfb958047A5CaAe5D8b";
    let   tokenAdmin = owner.address;

    //address taxVault_ = //

    // token
    // const ERC20Sample = await ethers.getContractFactory("ERC20Sample");
    // const erc20Sample = await ERC20Sample.deploy("Asset Token", "ASSET");
    // await erc20Sample.deployed();
    // console.log("ERC20Sample is :", erc20Sample.address)
    // console.log("Transaction hash :", erc20Sample.deployTransaction.hash)

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
            const proxyAddress = await deployAndCloneContract(ethers, modelTokenTemplate.address)
            console.log("ModelToken is :", proxyAddress)
            const modelToken = await ethers.getContractAt("ModelToken", proxyAddress);
            return modelToken
        } else {
            const modelToken = await ethers.getContractAt("ModelToken", contract);
            return modelToken
        }
    })()

    const modelLockToken = await (async () => {
        contract = getAddressByName("ModelLockToken")
        const ModelLockTokenTemplate = await ethers.getContractFactory("ModelLockToken");
        modelLockTokenTemplate = await deployWithRetry(ModelLockTokenTemplate)
        console.log("ModelLockTokenTempalte is :", modelLockTokenTemplate.address)

        if (contract === "0x") {
            const proxyAddress = await deployAndCloneContract(ethers, modelLockTokenTemplate.address)
            console.log("ModelLockToken is :", proxyAddress)
            const modelLockToken = await ethers.getContractAt("ModelLockToken", proxyAddress);
            return modelLockToken
        } else {
            const modelLockToken = await ethers.getContractAt("ModelLockToken", contract);
            return modelLockToken
        }
    })()

    const stakingToken = await (async () => {
        contract = getAddressByName("Staking")
        const StakingTemplate = await ethers.getContractFactory("Staking");
        stakingTemplate = await deployWithRetry(StakingTemplate)
        console.log("StakingTempalte is :", stakingTemplate.address)

        if (contract === "0x") {
            const proxyAddress = await deployAndCloneContract(ethers, stakingTemplate.address)
            console.log("Staking is :", proxyAddress)
            const stakingToken = await ethers.getContractAt("Staking", proxyAddress);
            return stakingToken
        } else {
            const stakingToken = await ethers.getContractAt("Staking", contract);
            return stakingToken
        }
    })()

    const rewardToken = await (async () => {
        contract = getAddressByName("Reward")
        const RewardTemplate = await ethers.getContractFactory("Reward");
        rewardTemplate = await deployWithRetry(RewardTemplate)
        console.log("RewardTempalte is :", rewardTemplate.address)

        if (contract === "0x") {
            const proxyAddress = await deployAndCloneContract(ethers, rewardTemplate.address)
            console.log("Reward is :", proxyAddress)
            const rewardToken = await ethers.getContractAt("Reward", proxyAddress);
            return rewardToken
        } else {
            const rewardToken = await ethers.getContractAt("Reward", contract);
            return rewardToken
        }
    })()

    const airdropToken = await (async () => {
        contract = getAddressByName("Airdrop")
        const AirdropTemplate = await ethers.getContractFactory("Airdrop");
        airdropTemplate = await deployWithRetry(AirdropTemplate)
        console.log("AirdropTempalte is :", airdropTemplate.address)

        if (contract === "0x") {
            const proxyAddress = await deployAndCloneContract(ethers, airdropTemplate.address)
            console.log("Airdrop is :", proxyAddress)
            const airdropToken = await ethers.getContractAt("Airdrop", proxyAddress);
            return airdropToken
        } else {
            const airdropToken = await ethers.getContractAt("Airdrop", contract);
            return airdropToken
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

    const redeem = await (async () => {
        contract = getAddressByName("Redeem")
        if (contract === "0x") {
            const Redeem = await ethers.getContractFactory("Redeem");
            const redeem = await Redeem.deploy(assetAddress, UNISWAP_ROUTER)
            await redeem.deployed()
            console.log("Redeem is :", redeem.address)
            console.log("Transaction hash :", redeem.deployTransaction.hash)
            return redeem
        } else {
            const redeem = await ethers.getContractAt("Redeem", contract);
            console.log("Redeem is :", redeem.address)
            return redeem
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
        await modelFactory.initialize(modelToken.address, modelLockToken.address, rewardToken.address, 
            stakingToken.address, platformOperator.address, assetAddress, 1/* next id */, airdropToken.address, platformAirdropOwner.address)
        await modelFactory.grantRole(await modelFactory.BONDING_ROLE(), imoEntry.address)
        await modelFactory.setTokenAdmin(tokenAdmin)
        await modelFactory.setUniswapRouter(UNISWAP_ROUTER)
        await modelFactory.setTokenTaxParams(100, 100, 1) // set extra external swap tax, unit is %oo
        await modelFactory.setMaturityDuration(MATURITY_DURATION) //set 10 years of initial asset lock time
    }

    const taxVault = await ethers.getContractAt("TaxVault", TAX_VAULT)
    await taxVault.setRedeem(redeem.address)

    // configure IMOEntry
    contract = getAddressByName("IMOEntry")
    if (contract === "0x") {
        console.log("IMOEntry")
        await imoEntry.initialize(
            internalFactory.address, 
            internalRouter.address, 
            tokenVault.address /*address feeTo_*/,
            100000000 /** fee 10 **12 */,
            1000000000 /* uint256 initialSupply_ */,
            2 /*uint256 assetRate_, 100 top -> 10^12 liquid K*/,
            50 /* %,uint256 maxTx_ */, 
            modelFactory.address, 
            //ethers.utils.parseEther("141819150"),// gradThreshold
            ethers.utils.parseEther("140000000"),
            UNISWAP_ROUTER,
            AI_MODELS
          )
    }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});