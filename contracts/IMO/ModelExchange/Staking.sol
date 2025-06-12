// SPDX-License-Identifier: MIT
// Inspired by https://solidity-by-example.org/defi/staking-rewards/
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IReward.sol";
import "./IStaking.sol";

error TransferFailed();
error NeedsMoreThanZero();

contract Staking is Initializable, ReentrancyGuard, IStaking {
    IReward public rewardsToken;
    IERC20  public assetToken;

    uint256 public lastHistoricalBalance;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public lastRewardTotalPaid;
    mapping(address => uint256) public rewards;

    uint256 private totalSupply;
    mapping(address => uint256) public balances;

    address public stakeProvider;
    address public stakeManager;
    uint256 public constant stakeProviderPercentage = 30; // 30% of rewards go to the stake provider
    uint256 public constant stakeManagerPercentage = 20; // 20% of rewards go to the stake manager


    constructor() {
        _disableInitializers();
    }

    function initialize(
        address assetToken_,
        address rewardsToken_,
        address stakeProvider_,
        address stakeManager_
    ) external initializer {
        require(assetToken_ != address(0), "Invalid staking token address");
        require(rewardsToken_ != address(0), "Invalid rewards token address");
        require(stakeProvider_ != address(0), "Invalid stake provider address");
        require(stakeManager_ != address(0), "Invalid stake manager address");
        
        stakeProvider = stakeProvider_;
        stakeManager = stakeManager_;
        assetToken = IERC20(assetToken_);
        rewardsToken = IReward(rewardsToken_);
    }

    /**
     * @notice How much reward a token gets based on how long it's been in and during which "snapshots"
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        uint256 currentHistoricalBalance = rewardsToken.getHistoricalIncome();
        uint256 reward = (currentHistoricalBalance - lastHistoricalBalance) * (100 - stakeProviderPercentage - stakeManagerPercentage) * 1e18 / 100;
        return rewardPerTokenStored + reward / totalSupply;
    }

    /**
     * @notice How much reward a user has earned
     */
    function earned(address account) public view returns (uint256) {
        uint256 reward = calculateStakeProviderAndManagerReward(account);

        return
            ((balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) /
                1e18) + rewards[account] + reward;
    }

    /**
     * @notice Deposit tokens into this contract
     * @param amount | How much to stake
     */
    function stake(uint256 amount)
        external
        updateReward(msg.sender)
        nonReentrant
        moreThanZero(amount)
    {
        totalSupply += amount;
        balances[msg.sender] += amount;
        emit Staked(msg.sender, amount);
        bool success = assetToken.transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * @notice Withdraw tokens from this contract
     * @param amount | How much to withdraw
     */
    function withdraw(uint256 amount) external updateReward(msg.sender) nonReentrant {
        totalSupply -= amount;
        balances[msg.sender] -= amount;
        emit WithdrewStake(msg.sender, amount);
        bool success = assetToken.transfer(msg.sender, amount);
        if (!success) {
            revert TransferFailed();
        }
    }

    /**
     * @notice User claims their tokens
     */
    function claimReward() external updateReward(msg.sender) nonReentrant {
        uint256 reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        emit RewardsClaimed(msg.sender, reward);
        rewardsToken.distributeReward(msg.sender, reward);
    }

    /********************/
    /* Modifiers Functions */
    /********************/
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        uint256 currentHistoricalBalance = rewardsToken.getHistoricalIncome();
        lastHistoricalBalance = currentHistoricalBalance;
        rewards[account] = earned(account);
        updateLastTotalPaid(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    modifier moreThanZero(uint256 amount) {
        if (amount == 0) {
            revert NeedsMoreThanZero();
        }
        _;
    }

    function updateLastTotalPaid(address account) internal {
        if (account == stakeProvider || account == stakeManager) {
            lastRewardTotalPaid[account] = rewardsToken.getHistoricalIncome();
        }
    }

    function calculateStakeProviderAndManagerReward(address account) internal view returns (uint256) {
        uint256 reward = rewardsToken.getHistoricalIncome();
        uint256 paidReward;

        reward -= lastRewardTotalPaid[account];
        if (account == stakeProvider) {
            paidReward += (reward * stakeProviderPercentage) / 100;
        } 
        
        if (account == stakeManager) {
            reward -= lastRewardTotalPaid[account];
            paidReward += (reward * stakeManagerPercentage) / 100;
        }

        return paidReward;
    }


    /********************/
    /* Getter Functions */
    /********************/
    // Ideally, we'd have getter functions for all our s_ variables we want exposed, and set them all to private.
    // But, for the purpose of this demo, we've left them public for simplicity.

    function getStaked(address account) public view returns (uint256) {
        return balances[account];
    }
}