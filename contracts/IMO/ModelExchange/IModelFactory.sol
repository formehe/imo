// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IModelFactory {
    function withdraw(uint256 id) external;

    function initFromBondingCurve(
        string memory name,
        string memory symbol,
        uint256 applicationThreshold_,
        address creator
    ) external returns (uint256);

    function executeBondingCurveApplication(
        uint256 id,
        uint256 totalSupply,
        uint256 lpSupply,
        address vault,
        uint256 reserveSupply
    ) external returns (address);
}
