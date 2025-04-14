async function main() {
    const NODES_REGISTRY = "0xDee66F4500079041Fe2A795d9ADab04aFf9b04e8"
    const proxyNodes = [
        "0x51199B51174e19a4c617595a30B6691b5899DD2D",
        "0xab57EF2B6477d7966E0c26f5869CCE9f1732c711",
        "0xe6Cdc90Ed91a623071A71dc6D6e132f621869A9d",
        "0x991EAcE8e06d75F99D3153169531100F37f03cCF"
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