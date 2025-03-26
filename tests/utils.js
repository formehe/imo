async function deployAndCloneContract(ethers, modelLockTokenTemplateAddress) {
    // 1. 部署 CloneFactory
    const CloneFactory = await ethers.getContractFactory("CloneFactory");
    const cloneFactory = await CloneFactory.deploy();
    await cloneFactory.deployed();

    // 2. 使用 CloneFactory 创建克隆合约
    const tx = await cloneFactory.cloneContract(modelLockTokenTemplateAddress);
    const receipt = await tx.wait();

    // 3. 获取 CloneCreated 事件中的新合约地址
    const event = receipt.events.find(e => e.event === "CloneCreated");
    return event.args.cloneAddress;
}

// async function deployAndProxyContract(ethers, modelLockTokenTemplateAddress, abi) {
//     // 1. 部署 CloneFactory
//     const ProxyAdmin = await ethers.getContractFactory("MyProxyAdmin");
//     const proxyAdmin = await ProxyAdmin.deploy();
//     await proxyAdmin.deployed();

//     // 2. 使用 CloneFactory 创建克隆合约
//     const tx = await cloneFactory.cloneContract(modelLockTokenTemplateAddress);
//     const receipt = await tx.wait();

//     // 3. 获取 CloneCreated 事件中的新合约地址
//     const event = receipt.events.find(e => e.event === "CloneCreated");
//     return event.args.cloneAddress;
// }

// 导出方法，供其他文件使用
module.exports = { deployAndCloneContract};