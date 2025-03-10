// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IStake {
    function stake(
        address contractAddress,
        uint256 amount,
        uint256 lockPeriod
    ) external;

    function unstake(
        address contractAddress
    ) external;

    function getStake(
        address contractAddress, 
        address user
    ) external view returns (uint256 amount, uint256 unlockTime);
}