// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./ShareDataType.sol";
import "./NodesRegistry.sol";
import "./AIModels.sol";

contract AIWorkload {
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.UintSet;

    struct Workload {
        uint256 epochId;
        uint256 workload;
        uint256 timestamp;
        uint256 modelId;
        address reporter;
        address worker;
    }

    struct Session {
        uint256 lastEpochId;
        mapping(uint256 => Workload) workloads;
    }

    struct WorkLoad {
        uint256 totalWorkload;
        uint256 settledWorkload;
    }

    mapping(uint256 => Session)  public sessions;
    NodesRegistry public nodeRegistry;
    AIModels public modelRegistry;
    mapping(address => WorkLoad) internal totalWorkerWorkload;
    EnumerableSet.AddressSet private workers;
    mapping(uint256 => WorkLoad) internal totalModelWorkload;
    EnumerableSet.UintSet private models;
    mapping(address => WorkLoad) internal totalWorkReports;
    EnumerableSet.AddressSet private reporters;
    uint256 public settlementInterval = 1 hours;
    uint256 public lastSettlementTime;
    IStake  public stakeToken;

    event WorkloadReported(uint256 indexed sessionId, address indexed reporter, address worker, uint256 epochId, uint256 workload, uint256 modelId);

    constructor(address _nodeRegistry, address _modelRegistry, address _stakeToken) {
        require(_nodeRegistry != address(0), "Invalid node registry");
        require(_modelRegistry != address(0), "Invalid model registry");
        require(_stakeToken != address(0), "Invalid stake token");
        nodeRegistry = NodesRegistry(_nodeRegistry);
        modelRegistry = AIModels(_modelRegistry);
        lastSettlementTime = block.timestamp;
        stakeToken = IStake(_stakeToken);
    }

    function _isValidSignature(
        address worker,
        address reporter,
        bytes memory content,
        Signature[] calldata signatures
    ) internal view returns (bool){
        address[] memory signers = new address[](signatures.length);
        uint256 votes;
        bool containsReporter;
        bool containsWorker;

        for (uint256 i = 0; i < signatures.length; i++) {
            bool duplicate = false;
            bytes memory signatureBytes = abi.encodePacked(signatures[i].r, signatures[i].s, signatures[i].v);
            (address _address,) = ECDSA.tryRecover(ECDSA.toEthSignedMessageHash(content), signatureBytes);
            if (!nodeRegistry.get(_address).active) {
                continue;
            }

            for (uint256 j = 0; j < votes; j++) {
                if(signers[j] == _address) {
                    duplicate = true;
                    break;
                }
            }

            if (duplicate) {
                continue;
            }

            if (_address == worker) {
                containsWorker = true;
            }

            if (_address == reporter) {
                containsReporter = true;
            }

            signers[votes] = _address;
            votes += 1;
        }

        if (votes < ((signatures.length + 1) / 2)
            || !containsWorker || !containsReporter) {
            return false;
        }

        return true;
    }

    function reportWorkload(
        address worker,
        uint256 workload,
        uint256 modelId,
        uint256 sessionId,
        uint256 epochId,
        Signature[] calldata signatures
    ) external {
        require(worker != address(0), "Invalid owner address");
        require(workload > 0, "Workload must be greater than zero");
        require(signatures.length >= 3, "Length of signatures must more than 3");

        (uint256 tmpModelId, , , , ,) = modelRegistry.uploadModels(modelId);
        require(tmpModelId == modelId, "Model not exist");

        require(_isValidSignature(worker, msg.sender, abi.encode(worker, workload, modelId, sessionId, epochId), signatures), "Invalid signature");

        Session storage session = sessions[sessionId];

        require(epochId > session.lastEpochId, "Epoch out of order");
        session.workloads[epochId] = Workload({
            epochId: epochId,
            workload: workload,
            timestamp: block.timestamp,
            modelId: modelId,
            reporter: msg.sender,
            worker: worker
        });

        WorkLoad storage workerWorkLoad = totalWorkerWorkload[worker];
        workerWorkLoad.totalWorkload += workload;
        workers.add(worker);

        WorkLoad storage modelWorkLoad = totalModelWorkload[modelId];
        modelWorkLoad.totalWorkload += workload;
        models.add(modelId);

        WorkLoad storage reporterWorkLoad = totalWorkReports[msg.sender];
        reporterWorkLoad.totalWorkload += workload;
        reporters.add(msg.sender);

        session.lastEpochId = epochId;
        emit WorkloadReported(sessionId, msg.sender, worker, epochId, workload, modelId);
    }

    function getNodeWorkload(uint256 sessionId, uint256 epochId) external view returns (Workload memory) {
        return sessions[sessionId].workloads[epochId];
    }

    function getLastEpoch(uint256 sessionId) external view returns (uint256) {
        return sessions[sessionId].lastEpochId;
    }

    function getTotalWorkerWorkload(
        address node
    ) external view returns (WorkLoad memory) {
        return totalWorkerWorkload[node];
    }

    function getTotalWorkReport(
        address reporter
    ) external view returns (WorkLoad memory) {
        return totalWorkReports[reporter];
    }

    function getTotalModelWorkload(
        uint256 modelId
    ) external view returns (WorkLoad memory) {
        return totalModelWorkload[modelId];
    }

    function settleRewards()
        external 
        returns (
            NodeSettleWorkload[] memory settledWorkers, 
            ModelSettleWorkload[] memory settledModels, 
            NodeSettleWorkload[] memory settledReporters
        ) 
    {
        require(
            block.timestamp >= lastSettlementTime + settlementInterval,
            "Settlement not due yet"
        );

        NodeSettleWorkload[] memory tmpSettledWorkers = new NodeSettleWorkload[](workers.length());
        uint256 count = 0;
        for (uint256 i = 0; i < workers.length(); i++) {
            WorkLoad storage workload = totalWorkerWorkload[workers.at(i)];
            if (workload.totalWorkload <= workload.settledWorkload) {
                continue;
            }

            tmpSettledWorkers[count].node = workers.at(i);
            tmpSettledWorkers[count].workload = workload.totalWorkload - workload.settledWorkload;

            count++;
        }

        settledWorkers = new NodeSettleWorkload[](count);
        for (uint256 i = 0; i < count; i++) {
            settledWorkers[i] = tmpSettledWorkers[i];
        }

        ModelSettleWorkload[] memory tmpSettledModels = new ModelSettleWorkload[](models.length());
        count = 0;
        for (uint256 i = 0; i < models.length(); i++) {
            WorkLoad storage workload = totalModelWorkload[models.at(i)];
            if (workload.totalWorkload <= workload.settledWorkload) {
                continue;
            }

            tmpSettledModels[count].modelId = models.at(i);
            tmpSettledModels[count].workload = workload.totalWorkload - workload.settledWorkload;
            count++;
        }

        settledModels = new ModelSettleWorkload[](count);
        for (uint256 i = 0; i < count; i++) {
            settledModels[i] = tmpSettledModels[i];
        }

        NodeSettleWorkload[] memory tmpSettledReporters = new NodeSettleWorkload[](reporters.length());
        count = 0;
        for (uint256 i = 0; i < reporters.length(); i++) {
            WorkLoad storage workload = totalWorkReports[reporters.at(i)];
            if (workload.totalWorkload <= workload.settledWorkload) {
                continue;
            }

            tmpSettledReporters[count].node = reporters.at(i);
            tmpSettledReporters[count].workload = workload.totalWorkload - workload.settledWorkload;
            count++;
        }

        settledReporters = new NodeSettleWorkload[](count);
        for (uint256 i = 0; i < count; i++) {
            settledReporters[i] = tmpSettledReporters[i];
        }

        lastSettlementTime = block.timestamp;
    }
}