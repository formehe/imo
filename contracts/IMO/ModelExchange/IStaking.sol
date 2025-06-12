// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IReward.sol";

interface IStaking {
    /***********/
    /* Events */
    /***********/
    event Staked(address indexed user, uint256 indexed amount);
    event WithdrewStake(address indexed user, uint256 indexed amount);
    event RewardsClaimed(address indexed user, uint256 indexed amount);

    /*****************/
    /* Init Function */
    /*****************/
    function initialize(
        address assetToken_,
        address rewardsToken_,
        address stakeProvider_,
        address stakeManager_
    ) external;

    /*******************/
    /* Main Functions */
    /*******************/
    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function claimReward() external;

    /********************/
    /* View Functions */
    /********************/
    function rewardPerToken() external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function getStaked(address account) external view returns (uint256);
}