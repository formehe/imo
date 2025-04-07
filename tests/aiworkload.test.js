const { expect } = require("chai");
const { ethers } = require("hardhat");
const { AddressZero } = require("ethers").constants;
const toWei = (val) => ethers.utils.parseEther("" + val);

describe("AIWorkload", function () {
  let AIWorkload, aiWorkload;
  let usdtToken, nodesRegistry, DepositCon;
  let owner, reporter1, reporter2;
  const ROUND_DURATION_TIME = 3600; // 1 hour

  beforeEach(async function () {
    [
      owner,
      reporter1,
      reporter2,
      addr1,
      addr2,
      addr3,
      addr4,
      addr5,
      addr6,
      addr7,
    ] = await ethers.getSigners();

    let nodeInfos = [
      {
        identifier: addr1.address,
        aliasIdentifier: "11111111111111111",
        wallet: addr1.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr2.address,
        aliasIdentifier: "21111111111111111",
        wallet: addr2.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr3.address,
        aliasIdentifier: "31111111111111111",
        wallet: addr3.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr4.address,
        aliasIdentifier: "41111111111111111",
        wallet: addr4.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr5.address,
        aliasIdentifier: "51111111111111111",
        wallet: addr5.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
      {
        identifier: addr6.address,
        aliasIdentifier: "61111111111111111",
        wallet: addr6.address,
        gpuTypes: ["A100", "V100"],
        gpuNums: [2, 3],
      },
    ];

    const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
    usdtToken = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
    await usdtToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await usdtToken.connect(owner).transfer(addr1.address, toWei(1000));
    await usdtToken.connect(owner).transfer(addr2.address, toWei(1000));
    await usdtToken.connect(owner).transfer(addr3.address, toWei(1000));

    const ERC20TOPFactory = await ethers.getContractFactory("ERC20Sample");
    topToken = await ERC20TOPFactory.connect(owner).deploy("TOPToken", "TOP");
    await topToken.deployed();

    // Transfer USDT from owner to user1, user2, user3
    await topToken.connect(owner).transfer(addr1.address, toWei(1000));
    await topToken.connect(owner).transfer(addr2.address, toWei(1000));
    await topToken.connect(owner).transfer(addr3.address, toWei(1000));

    const AssetManagement = await ethers.getContractFactory("AssetManagement");
    const assetManagement = await AssetManagement.deploy();
    await assetManagement.deployed();

    const BankFactory = await ethers.getContractFactory("Bank");
    bank = await BankFactory.deploy(usdtToken.address, usdtToken.address);
    await bank.deployed();

    // await bank.updateRate(toWei("1"));

    // deposit
    const DepositFactory = await ethers.getContractFactory("Deposit");
    DepositCon = await DepositFactory.deploy(
      usdtToken.address,
      bank.address,
      topToken.address
    );
    await DepositCon.deployed();

    const NodesRegistry = await ethers.getContractFactory("NodesGovernance");
    nodesRegistry = await NodesRegistry.deploy();
    await nodesRegistry.deployed();

    const AIModelUploadFactory = await ethers.getContractFactory("AIModels");
    aiModelUpload = await AIModelUploadFactory.deploy(
      nodesRegistry.address,
      assetManagement.address
    );
    await aiModelUpload.deployed();

    //settlement
    const SettlementFactory = await ethers.getContractFactory("Settlement");
    SettlementCon = await SettlementFactory.deploy(
      DepositCon.address,
      bank.address,
      aiModelUpload.address
    );
    await SettlementCon.deployed();

    const modelName = "TestModel";
    const modelVersion = "v1.0";
    const modelInfo = "Test model description";

    await aiModelUpload.recordModelUpload(
      modelName,
      modelVersion,
      modelInfo,
      1
    );

    AIWorkload = await ethers.getContractFactory("AIWorkload");
    aiWorkload = await AIWorkload.deploy(
      nodesRegistry.address,
      aiModelUpload.address,
      assetManagement.address,
      SettlementCon.address
    );
    await aiWorkload.deployed();

    await expect(
      AIWorkload.deploy(AddressZero, AddressZero, AddressZero, AddressZero)
    ).to.be.revertedWith("Invalid node registry");

    const ERC20sample = await ethers.getContractFactory("ERC20Sample");
    const erc20 = await ERC20sample.deploy("Asset Token", "ASSET");
    await erc20.deployed();
    await nodesRegistry.nodesGovernance_initialize(
      nodeInfos,
      addr1.address,
      ROUND_DURATION_TIME,
      assetManagement.address
    );
    await nodesRegistry.grantRole(
      await nodesRegistry.ADMIN_ROLE(),
      owner.address
    );

    await SettlementCon.grantRole(
      await SettlementCon.OPERATOR_ROLE(),
      aiWorkload.address
    );
    await DepositCon.grantRole(
      await DepositCon.IMO_ROLE(),
      SettlementCon.address
    );

    const updateRateTx = await bank.connect(owner).updateUsdtTopRate(1, 1);
    await updateRateTx.wait(); // Ensure the updateRate transaction is mined successfully

    const [toprate, usdtrate] = await bank.usdtToTopRate();
    console.log("++ toprate: ", toprate, " ++usdtrate:", usdtrate);
  });

  describe("Initialization", function () {
    it("Should initialize with correct registry address", async function () {
      expect(await aiWorkload.nodeRegistry()).to.equal(nodesRegistry.address);
    });
  });

  describe("reportWorkload", function () {
    it("Should revert if worker address is invalid", async function () {
      await expect(
        aiWorkload
          .connect(reporter1)
          .reportWorkload(
            ethers.constants.AddressZero,
            addr3.address,
            100,
            1,
            1,
            1,
            []
          )
      ).to.be.revertedWith("Invalid owner address");
    });

    it("Should revert if workload is zero", async function () {
      await expect(
        aiWorkload
          .connect(reporter1)
          .reportWorkload(owner.address, addr3.address, 0, 1, 1, 1, [])
      ).to.be.revertedWith("Workload must be greater than zero");
    });

    it("Should Length of signatures must more than 3", async function () {
      const signatures = [];
      await expect(
        aiWorkload
          .connect(reporter1)
          .reportWorkload(
            owner.address,
            addr3.address,
            100,
            1,
            1,
            1,
            signatures
          )
      ).to.be.revertedWith("Length of signatures must more than 3");
    });

    it("Should record workload and emit WorkloadReported event", async function () {
      await nodesRegistry.registerProxyNode(addr1.address);
      const workload = 200;
      const content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr3.address, addr3.address, workload, 1, 1, 1]
      );

      const signature1 = await addr1.signMessage(
        ethers.utils.arrayify(content)
      );
      const signature2 = await addr2.signMessage(
        ethers.utils.arrayify(content)
      );
      const signature3 = await addr3.signMessage(
        ethers.utils.arrayify(content)
      );

      const signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature3.slice(0, 66),
          s: "0x" + signature3.slice(66, 130),
          v: parseInt(signature3.slice(130, 132), 16),
        },
      ];

      //usdt approve contract to spend
      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));

      const tx = await aiWorkload
        .connect(addr1)
        .reportWorkload(
          addr3.address,
          addr3.address,
          workload,
          1,
          1,
          1,
          signatures
        );

      const timestamp = (await ethers.provider.getBlock("latest")).timestamp;
      await expect(tx)
        .to.emit(aiWorkload, "WorkloadReported")
        .withArgs(1, addr1.address, addr3.address, 1, workload, 1);

      const totalWorkload = await aiWorkload.getTotalWorkerWorkload(
        addr3.address
      );
      expect(totalWorkload.totalWorkload).to.equal(workload);
    });

    it("should fail if epochId is out of order", async function () {
      await nodesRegistry.registerProxyNode(addr1.address);
      let workload = 200;
      let epochId = 3;
      let content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr3.address, addr3.address, workload, 1, 1, epochId]
      );
      let signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
      let signature2 = await addr2.signMessage(ethers.utils.arrayify(content));
      let signature3 = await addr3.signMessage(ethers.utils.arrayify(content));

      let signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature3.slice(0, 66),
          s: "0x" + signature3.slice(66, 130),
          v: parseInt(signature3.slice(130, 132), 16),
        },
      ];

      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));
      await aiWorkload
        .connect(addr1)
        .reportWorkload(
          addr3.address,
          addr3.address,
          workload,
          1,
          1,
          epochId,
          signatures
        );

      workload = 200;
      epochId = 2;
      content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr3.address, addr3.address, workload, 1, 1, epochId]
      );
      signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
      signature2 = await addr2.signMessage(ethers.utils.arrayify(content));
      signature3 = await addr3.signMessage(ethers.utils.arrayify(content));

      signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature3.slice(0, 66),
          s: "0x" + signature3.slice(66, 130),
          v: parseInt(signature3.slice(130, 132), 16),
        },
      ];

      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));
      await expect(
        aiWorkload
          .connect(addr1)
          .reportWorkload(
            addr3.address,
            addr3.address,
            workload,
            1,
            1,
            epochId,
            signatures
          )
      ).to.be.revertedWith("Epoch out of order");
    });

    it("Should revert if agreement count does not exceed half", async function () {
      await nodesRegistry.registerProxyNode(addr1.address);
      const workload = 200;
      const content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [owner.address, addr3.address, workload, 1, 1, 1]
      );

      const signature1 = await reporter1.signMessage(
        ethers.utils.arrayify(content)
      );
      const signature2 = await reporter2.signMessage(
        ethers.utils.arrayify(content)
      );
      const signature3 = await owner.signMessage(
        ethers.utils.arrayify(content)
      );

      const signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature3.slice(0, 66),
          s: "0x" + signature3.slice(66, 130),
          v: parseInt(signature3.slice(130, 132), 16),
        },
      ];

      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));

      await expect(
        aiWorkload
          .connect(reporter1)
          .reportWorkload(
            owner.address,
            addr3.address,
            workload,
            1,
            1,
            1,
            signatures
          )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should revert duplicate signer", async function () {
      await nodesRegistry.registerProxyNode(addr1.address);
      await nodesRegistry.registerProxyNode(addr2.address);
      const workload = 200;
      let content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr3.address, addr3.address, workload, 1, 1, 1]
      );

      let signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
      let signature2 = await addr2.signMessage(ethers.utils.arrayify(content));

      let signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
      ];

      await expect(
        aiWorkload
          .connect(addr1)
          .reportWorkload(
            addr3.address,
            addr3.address,
            workload,
            1,
            1,
            1,
            signatures
          )
      ).to.be.revertedWith("Invalid signature");

      content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr1.address, addr3.address, workload, 1, 1, 1]
      );

      signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
      signature2 = await addr2.signMessage(ethers.utils.arrayify(content));

      signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
      ];

      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));

      await expect(
        aiWorkload
          .connect(reporter1)
          .reportWorkload(
            addr1.address,
            addr3.address,
            workload,
            1,
            1,
            1,
            signatures
          )
      ).to.be.revertedWith("Invalid signature");

      await aiWorkload
        .connect(addr2)
        .reportWorkload(
          addr1.address,
          addr3.address,
          workload,
          1,
          1,
          1,
          signatures
        );
    });
  });

  describe("getRecentWorkload", function () {
    it("Should calculate recent workload correctly", async function () {
      await nodesRegistry.registerProxyNode(addr1.address);
      let content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr3.address, addr3.address, 100, 1, 1, 1]
      );

      let signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
      let signature2 = await addr2.signMessage(ethers.utils.arrayify(content));
      let signature3 = await addr3.signMessage(ethers.utils.arrayify(content));

      let signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature3.slice(0, 66),
          s: "0x" + signature3.slice(66, 130),
          v: parseInt(signature3.slice(130, 132), 16),
        },
      ];

      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));
      await aiWorkload
        .connect(addr1)
        .reportWorkload(addr3.address, addr3.address, 100, 1, 1, 1, signatures);

      await ethers.provider.send("evm_increaseTime", [60 * 60 * 24]); // Advance 1 day
      await ethers.provider.send("evm_mine");

      // const timestamp2 = (await ethers.provider.getBlock("latest")).timestamp;
      content = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256", "uint256", "uint256"],
        [addr3.address, addr3.address, 200, 1, 1, 2]
      );

      signature1 = await addr1.signMessage(ethers.utils.arrayify(content));
      signature2 = await addr2.signMessage(ethers.utils.arrayify(content));
      signature3 = await addr3.signMessage(ethers.utils.arrayify(content));

      signatures = [
        {
          r: signature1.slice(0, 66),
          s: "0x" + signature1.slice(66, 130),
          v: parseInt(signature1.slice(130, 132), 16),
        },
        {
          r: signature2.slice(0, 66),
          s: "0x" + signature2.slice(66, 130),
          v: parseInt(signature2.slice(130, 132), 16),
        },
        {
          r: signature3.slice(0, 66),
          s: "0x" + signature3.slice(66, 130),
          v: parseInt(signature3.slice(130, 132), 16),
        },
      ];

      await usdtToken.connect(addr3).approve(DepositCon.address, toWei("200"));
      await DepositCon.connect(addr3).deposit(toWei("200"));
      await aiWorkload
        .connect(addr1)
        .reportWorkload(addr3.address, addr3.address, 200, 1, 1, 2, signatures);

      const recentWorkload = await aiWorkload.getTotalWorkerWorkload(
        addr3.address
      );
      expect(recentWorkload.totalWorkload).to.equal(300);
    });
  });
});
