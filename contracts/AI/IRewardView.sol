// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./ShareDataType.sol";

interface IRewardView {
    function getReward(
        uint256 fromTimestamp, 
        uint256 duration,
        Page memory page
    ) external view returns (RewardView[] memory rewardViews);
}