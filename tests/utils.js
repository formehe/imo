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

async function deployAndProxyContract(ethers, modelLockTokenTemplateAddress, admin) {
    const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
    const proxy = await Proxy.deploy(modelLockTokenTemplateAddress, admin, "0x");
    await proxy.deployed();

    return proxy.address
}

// 导出方法，供其他文件使用
module.exports = {deployAndCloneContract, deployAndProxyContract};