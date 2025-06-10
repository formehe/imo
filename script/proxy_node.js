async function main() {
    const NODES_REGISTRY = "0xF8363849557eAD01dF37513BDd3693BCEe057aD5"
    const proxyNodes = [
        "0x51199B51174e19a4c617595a30B6691b5899DD2D",
    ]

    nodesReigstry = await ethers.getContractAt("NodesGovernance", NODES_REGISTRY);

    for (const proxy of proxyNodes) {
        // console.log(await nodesReigstry.proxyNodes(proxy))
        await nodesReigstry.registerProxyNode(proxy)
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});