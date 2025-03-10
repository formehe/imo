const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Wallet } = require("ethers");

describe("NodesGovernance Contract", function () {
    let NodesGovernance;
    let nodesGovernance;
    let owner;

    const DETECT_DURATION_TIME = 3600; // 1 hour
    const ROUND_DURATION_TIME = 3600;  // 1 hour

    beforeEach(async function () {
        [owner, verifier, addr1, addr2, addr3, addr4, addr5, addr6, addr7] = await ethers.getSigners();
        let nodeInfos = [
            {
                identifier: addr1.address,
                aliasIdentifier: "11111111111111111",
                wallet: addr1.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            },
            {
                identifier: addr2.address,
                aliasIdentifier: "21111111111111111",
                wallet: addr2.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            },
            {
                identifier: addr3.address,
                aliasIdentifier: "31111111111111111",
                wallet: addr3.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            },
            {
                identifier: addr4.address,
                aliasIdentifier: "41111111111111111",
                wallet: addr4.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            },
            {
                identifier: addr5.address,
                aliasIdentifier: "51111111111111111",
                wallet: addr5.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            },
            {
                identifier: addr6.address,
                aliasIdentifier: "61111111111111111",
                wallet: addr6.address,
                gpuTypes: ["A100", "V100"],
                gpuNums: [2, 3]
            }
        ]

        // 部署合约
        const NodesGovernanceFactory = await ethers.getContractFactory("NodesGovernance");
        nodesGovernance = await NodesGovernanceFactory.deploy();
        await nodesGovernance.deployed();

        const AssetManagement = await ethers.getContractFactory("AssetManagement");
        const assetManagement = await AssetManagement.deploy();
        await assetManagement.deployed();

        const ERC20sample = await ethers.getContractFactory("ERC20Sample");
        const erc20 = await ERC20sample.deploy("Asset Token", "ASSET");
        await erc20.deployed();
        await nodesGovernance.nodesGovernance_initialize(nodeInfos, verifier.address, ROUND_DURATION_TIME, assetManagement.address)
    });

    it("should start a new validation round", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();

        const currentRoundId = await nodesGovernance.currentRoundId();
        expect(currentRoundId).to.equal(1);
    });

    it("should not start a new validation round if the previous round has not ended", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();
        await expect(nodesGovernance.startNewValidationRound()).to.be.revertedWith("Previous round is not ending");
    });

    it("should allow validators to vote", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();
        const currentRoundId = await nodesGovernance.currentRoundId();
        const candidates = await nodesGovernance.getRoundCandidates(currentRoundId);
        const candidate = candidates[0]
        const validators = await nodesGovernance.getValidatorsOfCandidate(currentRoundId, candidate)
        const VOTERS = [addr1, addr2, addr3, addr4, addr5, addr6]
        let voter;
        
        for (let i = 0; i < VOTERS.length; i++) 
            if (VOTERS[i].address == validators[0]) 
                voter = VOTERS[i]

        // 模拟验证人投票
        await nodesGovernance.connect(voter).vote(currentRoundId, candidate, true);
        const voted = await nodesGovernance.votedPerCandidate(currentRoundId, candidate);

        expect(voted.yesVotes).to.equal(1);
        expect(voted.noVotes).to.equal(0);
    });

    it("should complete validation if majority votes yes", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();
        let currentRoundId = await nodesGovernance.currentRoundId();

        const candidates = await nodesGovernance.getRoundCandidates(currentRoundId);
        const candidate = candidates[0]
        const validators = await nodesGovernance.getValidatorsOfCandidate(currentRoundId, candidates[0]);
        const VOTERS = [addr1, addr2, addr3, addr4, addr5, addr6]
        let voters = []
        for (let j = 0; j < validators.length; j++)
            for (let i = 0; i < VOTERS.length; i++)
                if (VOTERS[i].address == validators[j])
                    voters[j] = VOTERS[i]

        // 模拟多名验证人投票
        await expect(nodesGovernance.connect(owner).vote(currentRoundId, candidate, true)).to.be.revertedWith("Invalid validator");
        await nodesGovernance.connect(voters[0]).vote(currentRoundId, candidate, true);
        await nodesGovernance.connect(voters[1]).vote(currentRoundId, candidate, true);
        await nodesGovernance.connect(voters[2]).vote(currentRoundId, candidate, false);
        
        let voted = await nodesGovernance.votedPerCandidate(currentRoundId, candidate);
        expect(voted.completed).to.equal(false);
        await nodesGovernance.connect(voters[3]).vote(currentRoundId, candidate, true);
        await expect(nodesGovernance.connect(voters[4]).vote(currentRoundId, candidate, true)).to.be.revertedWith("Validation already completed");

        voted = await nodesGovernance.votedPerCandidate(currentRoundId, candidate);
        expect(voted.completed).to.equal(true);
        expect(Number(voted.yesVotes)).to.be.greaterThan(Number(voted.noVotes));
    });

    it("register and active if majority votes yes", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");

        await nodesGovernance.connect(addr7).registerNode(addr7.address, "71111111111111111", ["A100", "V100"], [3, 2]);
        let node = await nodesGovernance.get(addr7.address);
        expect(node.identifier).to.equal(addr7.address);
        expect(node.wallet).to.equal(addr7.address);
        expect(node.active).to.be.false;
        expect(node.gpus[0].gpuType).to.equal("A100");
        expect(node.gpus[0].totalNum).to.equal(3);
        expect(node.gpus[1].gpuType).to.equal("V100");
        expect(node.gpus[1].totalNum).to.equal(2);
        const currentRoundId = await nodesGovernance.currentRoundId();

        const candidates = await nodesGovernance.getRoundCandidates(currentRoundId);
        const candidate = candidates[0]
        const validators = await nodesGovernance.getValidatorsOfCandidate(currentRoundId, candidates[0]);
        const VOTERS = [addr1, addr2, addr3, addr4, addr5, addr6]
        let voters = []
        for (let j = 0; j < validators.length; j++)
            for (let i = 0; i < VOTERS.length; i++)
                if (VOTERS[i].address == validators[j])
                    voters[j] = VOTERS[i]

        // 模拟多名验证人投票
        await nodesGovernance.connect(voters[0]).vote(currentRoundId, candidate, true);
        await nodesGovernance.connect(voters[1]).vote(currentRoundId, candidate, true);
        await nodesGovernance.connect(voters[2]).vote(currentRoundId, candidate, false);
        
        let voted = await nodesGovernance.votedPerCandidate(currentRoundId, candidate);
        expect(voted.completed).to.equal(false);
        node = await nodesGovernance.get(addr7.address);
        expect(node.identifier).to.equal(addr7.address);
        expect(node.wallet).to.equal(addr7.address);
        expect(node.active).to.be.false;
        await nodesGovernance.connect(voters[3]).vote(currentRoundId, candidate, true);
        await expect(nodesGovernance.connect(voters[4]).vote(currentRoundId, candidate, true)).to.be.revertedWith("Validation already completed");

        voted = await nodesGovernance.votedPerCandidate(currentRoundId, candidate);
        expect(voted.completed).to.equal(true);
        node = await nodesGovernance.get(addr7.address);
        expect(node.identifier).to.equal(addr7.address);
        expect(node.wallet).to.equal(addr7.address);
        expect(node.active).to.be.true;
        expect(Number(voted.yesVotes)).to.be.greaterThan(Number(voted.noVotes));
    });

    it("should revert if validation time is exceeded", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();
        
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");

        const currentRoundId = await nodesGovernance.currentRoundId();
        await expect(nodesGovernance.vote(currentRoundId, verifier.address, true)).to.be.revertedWith("Validation time exceeded");
    });

    it("should allow owner to settle a period", async function () {
        await ethers.provider.send("evm_increaseTime", [ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();
        const detectPeriodId = await nodesGovernance.currentDetectCircleId();

        await ethers.provider.send("evm_increaseTime", [24 * ROUND_DURATION_TIME + 1]);
        await ethers.provider.send("evm_mine");
        await nodesGovernance.startNewValidationRound();

        await expect(nodesGovernance.settlementOnePeriod(100)).to.be.revertedWith("Settlement for detected period");
        await expect(nodesGovernance.settlementOnePeriod(0)).to.be.revertedWith("Detect period id is not exist");
        await nodesGovernance.settlementOnePeriod(detectPeriodId);
        const [states, totalQuotas] = await nodesGovernance.getOnePeriodSettlement(detectPeriodId);
        expect(states).to.be.an('array');
        expect(totalQuotas.toNumber()).to.be.a('number');
    });
});