// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IModelLockToken {
    function initialize(
        string memory _name,
        string memory _symbol,
        address _founder,
        address _assetToken,
        uint256 _matureAt,
        bool _canStake
    ) external;

    function stake(
        uint256 amount,
        address receiver
    ) external;

    function withdraw(uint256 amount) external;
    
    function getPastBalanceOf(
        address account,
        uint256 timepoint
    ) external view returns (uint256);
}