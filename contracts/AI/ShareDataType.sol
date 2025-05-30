// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

struct NodeState {
    uint64  failedCnt;
    uint64  successfulCnt;
    uint128 expectCnt;
    address wallet;
    address identifier;
}

struct NodeComputeUsed {
    address identifier;
    string  gpuType;
    uint256 used;
}

struct Signature {
    bytes32 r;
    bytes32 s;
    uint8 v;
}

struct UploadModel {
    uint256 modelId;
    string  modelName;
    string  modelVersion;
    address uploader;
    string  extendInfo;
    uint256 timestamp;
    uint256 inTokenPrice;
    uint256 outTokenPrice;
}

struct ModelSettleWorkload{
    uint256 modelId;
    uint256 workload;
}

struct NodeSettleWorkload{
    address node;
    uint256 workload;
}

struct NodeInfo{
    address   identifier;
    string    aliasIdentifier;
    address   wallet;
    string[]  gpuTypes;
    uint256[] gpuNums;
}