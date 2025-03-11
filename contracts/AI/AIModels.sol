// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NodesRegistry.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AIModels is AccessControl{
    struct ModelEvaluation {
        uint256 parameter;
    }

    NodesRegistry public registry;
    mapping(string => uint256) public modelIds;
    mapping(uint256 => UploadModel) public uploadModels;

    mapping(uint256 => ModelEvaluation) public modelEvaluations;
    uint256 public nextModelId = 1;

    IStake  public stakeToken;

    bytes32 public constant UPLOADER_ROLE = keccak256("UPLOADER_ROLE"); // Able to withdraw and execute applications

    mapping(uint256 => address[]) public modelDistribution;
    mapping(address => uint256[]) public nodeDeployment;

    event UploadModeled(uint256 indexed modelId, address indexed uploader, string modelName, string modelVersion, string modelInfo);
    event ModelDeployed(address indexed node, uint256 indexed modelId);
    event ModelRemoved(address indexed node, uint256 indexed modelId);

    constructor(address _registry, address _stakeToken) {
        require(_registry != address(0), "Invalid quantity of registry address");
        require(_stakeToken != address(0), "Invalid stake token");
        registry = NodesRegistry(_registry);
        stakeToken = IStake(_stakeToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function recordModelUpload(
        string calldata modelName,
        string calldata modelVersion,
        string calldata modelExtendInfo,
        address owner
    ) external onlyRole(UPLOADER_ROLE) returns(uint256 modelId) {
        string memory model = _modelId(modelName, modelVersion);
        require(modelIds[model] == 0, "Model exist");

        uploadModels[nextModelId] = UploadModel({
            modelId: nextModelId,
            modelName: modelName,
            modelVersion: modelVersion,
            uploader: owner,
            extendInfo: modelExtendInfo,
            timestamp : block.timestamp
        });

        modelIds[model] = nextModelId;

        emit UploadModeled(nextModelId, owner, modelName, modelVersion, modelExtendInfo);
        modelId = nextModelId;
        nextModelId++;
    }

    function reportDeployment(
        uint256 modelId
    ) external {
        require(registry.check(msg.sender), "Node is not active");
        UploadModel storage record = uploadModels[modelId];
        require(record.modelId != 0, "Model is not exist");
        
        _addFromModelDistribution(modelId, msg.sender);
        _addFromNodeDeployment(modelId, msg.sender);

        emit ModelDeployed(msg.sender, modelId);
    }

    function removeDeployment(
        uint256 modelId
    ) external {
        _removeFromModelDistribution(modelId, msg.sender);
        _removeFromNodeDeployment(modelId, msg.sender);

        emit ModelRemoved(msg.sender, modelId);
    }

    function getModelDistribution(
        uint256 modelId
    ) external view returns (address[] memory) {
        return modelDistribution[modelId];
    }

    function getNodeDeployment(
        address node
    ) external view returns (uint256[] memory) {
        return nodeDeployment[node];
    }

    function _addFromModelDistribution(
        uint256 modelId, 
        address node
    ) internal {
        address[] storage nodes = modelDistribution[modelId];
        for (uint256 i = 0; i < nodes.length; i++) {
            if (nodes[i] == node) {
                revert("Model distribution already exist");
            }
        }

        modelDistribution[modelId].push(msg.sender);
    }

    function _removeFromModelDistribution(
        uint256 modelId,
        address node
    ) internal {
        address[] storage nodes = modelDistribution[modelId];
        for (uint256 i = 0; i < nodes.length; i++) {
            if (nodes[i] == node) {
                nodes[i] = nodes[nodes.length - 1];
                nodes.pop();
                break;
            }
        }
    }

    function _addFromNodeDeployment(
        uint256 modelId,
        address node
    ) internal {
        uint256[] storage models = nodeDeployment[node];
        for (uint256 i = 0; i < models.length; i++) {
            if (models[i] == modelId) {
                revert("Node deployment already exist");
            }
        }

        nodeDeployment[msg.sender].push(modelId);
    }

    function _removeFromNodeDeployment(
        uint256 modelId,
        address node
    ) internal {
        uint256[] storage models = nodeDeployment[node];
        for (uint256 i = 0; i < models.length; i++) {
            if (models[i] == modelId) {
                models[i] = models[models.length - 1];
                models.pop();
                break;
            }
        }
    }

    function _modelId(
        string memory modelName, 
        string memory modelVersion
    ) internal pure returns(string memory) {
        return string(abi.encodePacked(modelName, "/", modelVersion));
    }

    function encodeModelInfo(
        string calldata modelName,
        string calldata modelVersion,
        string calldata modelExtendInfo
    ) public pure returns(bytes memory) {
        return abi.encode(modelName, modelVersion, modelExtendInfo);
    }

    function decodeModelInfo(bytes memory modelInfo) public pure returns(string memory modelName,
        string memory modelVersion, string memory modelExtendInfo) {
            (modelName, modelVersion, modelExtendInfo) = abi.decode(modelInfo, (string, string, string));
    }

    function renounceRole(bytes32 /*role*/, address /*account*/) public pure override {
        require(false, "not support");
    }
}