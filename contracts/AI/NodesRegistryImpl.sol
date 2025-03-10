// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NodesRegistry.sol";

contract NodesRegistryImpl is NodesRegistry {
    function nodesRegistryImpl_initialize(
        NodeInfo[] calldata _nodesInfos,
        address _allocator,
        address _stakeToken
    ) external initializer {
        _nodesRegistry_initialize(_nodesInfos, _allocator, _stakeToken);
    }

    function _checkRegister(
        address candidate
    ) internal override {
        _active(candidate);
    }
}