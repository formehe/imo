// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface IReward {
    function distributeRewards(uint256 detectPeriodId, uint256 totalAsset) external;
}