// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract TokenVault is Initializable, AccessControl, ReentrancyGuard{
    using SafeERC20 for IERC20;
    
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");
    address public assetToken;

    constructor() {
        _disableInitializers();
    }

    function initialize(address assetToken_) external initializer {
        require(Address.isContract(assetToken_), "Invalid token");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        assetToken = assetToken_;
    }

    function renounceRole(bytes32 /*role*/, address /*account*/) public pure override {
        require(false, "not support");
    }

    function withdraw(uint256 amount, address user) external onlyRole(WITHDRAW_ROLE) nonReentrant{
        uint256 balance = IERC20(assetToken).balanceOf(address(this));
        require(balance >= amount, "Insufficient asset token");
        IERC20(assetToken).safeTransfer(user, amount);
    }
}