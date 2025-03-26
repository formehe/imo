const { expect } = require("chai");
const { ethers } = require("hardhat");
const { AddressZero } = require("ethers").constants

describe("NodesRegistry", function () {
    let NodesRegistry;
    let nodesRegistry;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

        let nodeInfos =[
            {
                identifier: addr1.address,
                aliasIdentifier: "1111111111111111",
                wallet: addr1.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            },
            {
                identifier: addr2.address,
                aliasIdentifier: "2111111111111111",
                wallet: addr2.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            }
        ]

        NodesRegistry = await ethers.getContractFactory("NodesRegistryImpl");
        nodesRegistry = await NodesRegistry.deploy();
        await nodesRegistry.deployed();

        const ERC20sample = await ethers.getContractFactory("ERC20Sample");
        const erc20 = await ERC20sample.deploy("Asset Token", "ASSET");
        await erc20.deployed();

        const AssetManagement = await ethers.getContractFactory("AssetManagement");
        const assetManagement = await AssetManagement.deploy();
        await assetManagement.deployed();

        await nodesRegistry.nodesRegistryImpl_initialize(nodeInfos, addr5.address, assetManagement.address)
    });

    describe("owner", function () {
        const gpuTypes = ["A100", "V100"];
        const gpuNums = [2, 3];

        it("not owner deregister node", async function () {
            await nodesRegistry.connect(addr3).registerNode(addr3.address, "3111111111111111", gpuTypes, gpuNums, true)
            await expect(nodesRegistry["deregisterNode()"]())
                .to.be.revertedWith("Identifier not exist");
        });
    });

    describe("Node registration", function () {
        const gpuTypes = ["A100", "V100"];
        const gpuNums = [2, 3];
        it("Should register a new node", async function () {
            await nodesRegistry.connect(addr3).registerNode(addr3.address,  "3111111111111111", gpuTypes, gpuNums, true, { value: ethers.utils.parseEther("2")});
            await expect(nodesRegistry.connect(addr3).registerNode(AddressZero, "3111111111111111", gpuTypes, gpuNums, true)).to.be.revertedWith("Invalid wallet or identifier");
            const node = await nodesRegistry.get(addr3.address);
            expect(node.identifier).to.equal(addr3.address);
            expect(node.wallet).to.equal(addr3.address);
            expect(node.active).to.be.true;
            expect(node.gpus[0].gpuType).to.equal("A100");
            expect(node.gpus[0].totalNum).to.equal(2);
            expect(node.gpus[1].gpuType).to.equal("V100");
            expect(node.gpus[1].totalNum).to.equal(3);
            expect(node.stake).to.equal(ethers.utils.parseEther("2"));
        });

        it("Should not register a node with a zero address wallet", async function () {
            await expect(nodesRegistry.connect(addr1).registerNode(AddressZero, "3111111111111111", gpuTypes, gpuNums, true))
                .to.be.revertedWith(/Invalid wallet/);
            await expect(nodesRegistry.connect(addr1).registerNode(addr1.address, "", gpuTypes, gpuNums, true))
                .to.be.revertedWith(/Invalid wallet/);
        });

        it("Should revert when trying to register an existing node with a different wallet", async function () {
            const gpuNums1 = [2];
            await expect(nodesRegistry.connect(addr3).registerNode(addr3.address, "3111111111111111", gpuTypes, gpuNums1, true))
                .to.be.revertedWith("Invalid GPU data");
            await expect(nodesRegistry.connect(addr1).registerNode(addr2.address, "2111111111111111", gpuTypes, gpuNums, true))
                .to.be.revertedWith("Identifier exist");
            await expect(nodesRegistry.connect(addr3).registerNode(addr3.address, "1111111111111111", gpuTypes, gpuNums, true))
                .to.be.revertedWith("Alias identifier exist");
        });

        it("Should activate an existing node if registered again with the same wallet", async function () {
            await nodesRegistry.connect(addr1)["deregisterNode()"]();
            await nodesRegistry.connect(addr1).registerNode(addr1.address, "1111111111111111", gpuTypes, gpuNums, true);
            const node = await nodesRegistry.get(addr1.address);
            expect(node.active).to.be.true;
        });

        it("should correctly count nodes", async function () {
            await nodesRegistry.connect(addr3).registerNode(addr3.address, "3111111111111111", ["A100"], [2], true);
            await nodesRegistry.connect(addr4).registerNode(addr4.address, "4111111111111111", ["V100"], [3], true);
            expect(await nodesRegistry.length()).to.equal(4);
        });
    });

    describe("Node deregistration", function () {
        it("Should deregister an active node", async function () {
            await nodesRegistry.connect(addr1)["deregisterNode()"]();
            const node = await nodesRegistry.get(addr1.address);
            expect(node.active).to.be.false;
        });

        it("Should revert when trying to deregister a non-existent node", async function () {
            await expect(nodesRegistry.connect(addr3)["deregisterNode()"]())
                .to.be.revertedWith("Identifier not exist");
        });

        it("Should revert when trying to deregister an already deregistered node", async function () {
            await nodesRegistry.connect(addr1)["deregisterNode()"]();
            await expect(nodesRegistry.connect(addr1)["deregisterNode()"]())
                .to.be.revertedWith("Identifier not exist");
        });

        // it("Should authorize other user to deregister a node", async function () {
        //     await nodesRegistry.connect(addr1).approve(addr4.address)
        //     await nodesRegistry.connect(addr4)["deregisterNode(address)"](addr1.address);
        //     await expect(nodesRegistry.connect(addr4)["deregisterNode(address)"](addr1.address))
        //         .to.be.revertedWith("Not authorized");
        //     await expect(nodesRegistry.connect(addr1)["deregisterNode()"]())
        //         .to.be.revertedWith("Identifier not exist");
            
        //     const gpuTypes = ["A100", "V100"];
        //     const gpuNums = [2, 3];
        //     await nodesRegistry.connect(addr3).registerNode(addr3.address, "3111111111111111", gpuTypes, gpuNums);
        //     await nodesRegistry.connect(addr3).approve(addr4.address)
        //     await nodesRegistry.connect(addr3)["deregisterNode()"]()
        //     await expect(nodesRegistry.connect(addr4)["deregisterNode(address)"](addr3.address))
        //         .to.be.revertedWith("Not authorized");
        // });
    });

    describe("alloc gpu", function () {
        it("should allocate GPUs successfully", async function () {
            const identifier = addr3;
            const wallet = addr3.address;
            const gpuTypes = ["A100"];
            const gpuNums = [10];
        
            await nodesRegistry.connect(identifier).registerNode(wallet, "3111111111111111", gpuTypes, gpuNums, true);
        
            const allocGpuTypes = ["A100"];
            const allocGpuNums = [5];
            const [allocatedNodes, len] = await nodesRegistry.connect(addr5).callStatic.allocGPU(3, allocGpuTypes, allocGpuNums);

            const expectAllocatedNodes = [{
                identifier: addr1.address,
                used: 2
            },
            {
                identifier: addr2.address,
                used: 2
            },
            {
                identifier: addr3.address,
                used: 1
            }];
            
            expect(len).to.equal(3);
            for (let i = 0; i < allocatedNodes.length; i++) {
                expect(allocatedNodes[i].identifier).to.equal(expectAllocatedNodes[i].identifier);
                expect(allocatedNodes[i].gpuType).to.equal("A100");
                expect(allocatedNodes[i].used).to.equal(expectAllocatedNodes[i].used);
            }

            const [, len1] = await nodesRegistry.connect(addr5).callStatic.allocGPU(2, allocGpuTypes, allocGpuNums);
            expect(len1).to.equal(1);

            const [, len2] = await nodesRegistry.connect(addr5).callStatic.allocGPU(1, allocGpuTypes, allocGpuNums);
            expect(len2).to.equal(2);

            await nodesRegistry.connect(addr5).allocGPU(1, allocGpuTypes, allocGpuNums);
            summary = await nodesRegistry.gpuSummary("A100")
            expect(summary.totalNum).equal(14)
            expect(summary.used).equal(5)
        });

        it("should fail to alloc gpu", async function () {
            const identifier = addr3;
            const wallet = addr3.address;
            const gpuTypes = ["A100"];
            const gpuNums = [10];
        
            await nodesRegistry.connect(identifier).registerNode(wallet, "3111111111111111", gpuTypes, gpuNums, true);
        
            const allocGpuTypes = ["A100"];
            const allocGpuNums = [15];
            await expect(nodesRegistry.connect(addr4).allocGPU(0, allocGpuTypes, allocGpuNums))
                .to.be.revertedWith("Only for allocator")
            await expect(nodesRegistry.connect(addr5).allocGPU(0, allocGpuTypes, allocGpuNums))
                .to.be.revertedWith("gpu is not enough")
        });
    });

    describe("free gpu", function () {
        it("should free GPUs successfully", async function () {
            const identifier = addr3;
            const wallet = addr3.address;
            const gpuTypes = ["A100"];
            const gpuNums = [10];

            await nodesRegistry.connect(identifier).registerNode(wallet, "3111111111111111", gpuTypes, gpuNums, true);

            const allocGpuTypes = ["A100"];
            const allocGpuNums = [5];
            const [allocatedNodes, len] = await nodesRegistry.connect(addr5).callStatic.allocGPU(0, allocGpuTypes, allocGpuNums);
            await nodesRegistry.connect(addr5).allocGPU(0, allocGpuTypes, allocGpuNums);

            await nodesRegistry.connect(addr5).freeGPU(allocatedNodes);

            for (const identifier of [addr1.address, addr2.address, addr3.address]) {
                const node = await nodesRegistry.get(identifier);
                expect(node.gpus[0].used).to.equal(0);
            }
        });

        it("should free GPUs failure", async function () {
            const identifier = addr3;
            const wallet = addr3.address;
            const gpuTypes = ["A100"];
            const gpuNums = [10];

            await nodesRegistry.connect(identifier).registerNode(wallet, "3111111111111111", gpuTypes, gpuNums, true);

            let freeNodes = [{
                identifier: AddressZero,
                gpuType: "A100",
                used: 2
            }];

            await expect(nodesRegistry.connect(addr5).freeGPU(freeNodes))
                .to.be.revertedWith("Invalid identifier")

            freeNodes = [{
                identifier: addr1.address,
                gpuType: "A700",
                used: 2
            }];

            await expect(nodesRegistry.connect(addr5).freeGPU(freeNodes))
                .to.be.revertedWith("Invalid gpu type")

            await expect(nodesRegistry.connect(addr4).freeGPU(freeNodes))
                .to.be.revertedWith("Only for allocator")
        });
    });

    describe("Node retrieval", function () {
        it("Should retrieve the correct node details", async function () {
            const expectValues = [addr1.address, addr2.address]
            for ( i = 0; i < expectValues.length; i++) {
                const node = await nodesRegistry.get(expectValues[i]);
                expect(node.identifier).to.equal(expectValues[i]);
                expect(node.wallet).to.equal(expectValues[i]);
                expect(node.active).to.be.true;
            }

            for ( i = 0; i < expectValues.length; i++) {
                const node = await nodesRegistry.at(i);
                expect(node.identifier).to.equal(expectValues[i]);
                expect(node.wallet).to.equal(expectValues[i]);
                expect(node.active).to.be.true;
            }
        });

        it("Should return the correct length of registered nodes", async function () {
            expect(await nodesRegistry.length()).to.equal(2);
            await nodesRegistry.connect(addr1)["deregisterNode()"]();
            expect(await nodesRegistry.length()).to.equal(1); // Length should remain the same even if deregistered
        });
    });

    // describe("Node approve", function () {
    //     it("Should node approve", async function () {
    //         await expect(nodesRegistry.connect(addr1).approve(AddressZero))
    //             .to.be.revertedWith("Invalid authorized person")

    //         await expect(nodesRegistry.connect(addr3).approve(addr4.address))
    //         .to.be.revertedWith("None such node")
            
    //         const identifier = addr3;
    //         const wallet = addr3.address;
    //         const gpuTypes = ["A100"];
    //         const gpuNums = [10];

    //         await nodesRegistry.connect(identifier).registerNode(wallet, "3111111111111111", gpuTypes, gpuNums);
    //         await nodesRegistry.connect(addr3).approve(addr4.address)
    //         await nodesRegistry.connect(addr4)["deregisterNode(address)"](addr3.address)
    //         await expect(nodesRegistry.connect(addr4)["deregisterNode(address)"](addr3.address))
    //             .to.be.revertedWith("Not authorized")

    //         await nodesRegistry.connect(identifier).registerNode(wallet, "3111111111111111", gpuTypes, gpuNums);
    //         await nodesRegistry.connect(addr3).approve(addr4.address)
    //         await nodesRegistry.connect(addr3)["deregisterNode()"]()
    //         await expect(nodesRegistry.connect(addr4)["deregisterNode(address)"](addr3.address))
    //             .to.be.revertedWith("Not authorized")
    //     });
    // });
});