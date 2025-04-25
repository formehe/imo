// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./Deposit.sol";
import "../IMO/Activity/Redeem.sol";

contract TaxVault is Initializable, AccessControl, ReentrancyGuard{
    using SafeERC20 for IERC20;
    
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");
    address public deposit;
    address public assetToken;
    address public redeemer;

    constructor() {
        _disableInitializers();
    }

    function initialize(address _assetToken) external initializer {
        require(Address.isContract(_assetToken), "Invalid asset token");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        assetToken = _assetToken;
    }

    function setRedeem(address _redeem) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(Address.isContract(_redeem), "Invalid redeem");
        redeemer = _redeem;
    }

    function setDeposit(address _deposit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(Address.isContract(_deposit), "Invalid deposit");
        deposit = _deposit;
    }

    function renounceRole(bytes32 /*role*/, address /*account*/) public pure override {
        require(false, "not support");
    }

    function withdrawFromDeposit() external nonReentrant {
        Deposit(deposit).withdrawTOPByWorker();
    }

    function withdraw(
        uint256 amount,
        address user
    ) external onlyRole(WITHDRAW_ROLE) nonReentrant {
        uint256 balance = IERC20(assetToken).balanceOf(address(this));
        require(balance >= amount, "Insufficient asset token");
        IERC20(assetToken).safeTransfer(user, amount);
    }

    function redeem(
        address modelToken,
        uint256 platformAmount,
        uint256 minTargetOut
    ) external onlyRole(WITHDRAW_ROLE) nonReentrant {
        uint256 balance = IERC20(assetToken).balanceOf(address(this));
        require(balance >= platformAmount, "Insufficient asset token");
        IERC20(assetToken).approve(redeemer, platformAmount);
        Redeem(redeemer).redeemAndBurn(modelToken, platformAmount, minTargetOut);
    }
}