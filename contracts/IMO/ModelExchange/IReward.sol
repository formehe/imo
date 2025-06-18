// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IReward {
    // 事件定义
    event RewardDistributed(address indexed to, uint256 amount);
    event RewardStatsUpdated(uint256 totalRewards, uint256 currentBalance);
    event TaxTokensSwapped(uint256 amountIn);
    
    function initialize(address _assetToken, address _owner, address _modelToken, address _router) external;

    // 查询合约当前余额
    function getContractBalance() external view returns (uint256);
    
    // 查询历史总收入(当前余额+已发放总额)
    function getHistoricalIncome() external view returns (uint256);
    
    // 查询历史发放总额
    function getTotalHistoricalRewards() external view returns (uint256);
    
    // 发放单个奖励
    function distributeReward(address _to, uint256 _amount) external;
    
    // 批量发放奖励
    function batchDistributeReward(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external;
}