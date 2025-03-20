// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Bank is AccessControl {
    // Exchange rate between USDT and TOP
    uint256 public usdtToTopRate;

    // Role identifier for IMO group
    bytes32 public constant IMO_ROLE = keccak256("IMO_ROLE");

    event RateUpdated(uint256 oldRate, uint256 newRate);

    // USDT and TOP token contract addresses
    IERC20 public usdtToken;
    IERC20 public topToken;

    constructor(address _usdtAddress, address _topAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(IMO_ROLE, msg.sender);
        usdtToken = IERC20(_usdtAddress);
        topToken = IERC20(_topAddress);
    }

    // Update USDT to TOP exchange rate - IMO role only
    function updateUsdtTopRate(uint256 _newRate) external onlyRole(IMO_ROLE) {
        usdtToTopRate = _newRate;
    }

    // Withdraw USDT - IMO role only
    function withdrawUSDT(uint256 _amount) external onlyRole(IMO_ROLE) {
        require(usdtToken.balanceOf(address(this)) >= _amount, "Insufficient USDT balance");
        usdtToken.transfer(msg.sender, _amount);
        emit USDTWithdrawn(msg.sender, _amount);
    }

    event USDTWithdrawn(address indexed to, uint256 amount);

    // Withdraw TOP - IMO role only
    function withdrawTOP(uint256 _amount) external onlyRole(IMO_ROLE) {
        require(topToken.balanceOf(address(this)) >= _amount, "Insufficient TOP balance");
        topToken.transfer(msg.sender, _amount);
        emit TOPWithdrawn(msg.sender, _amount);
    }

    event TOPWithdrawn(address indexed to, uint256 amount);

    // Update USDT to TOP conversion rate
    function updateRate(uint256 _newRate) external onlyRole(IMO_ROLE) {
        require(_newRate > 0, "Rate must be greater than 0");
        uint256 oldRate = usdtToTopRate;
        usdtToTopRate = _newRate;
        emit RateUpdated(oldRate, _newRate);
    }

}
