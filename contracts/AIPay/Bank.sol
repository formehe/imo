// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Bank is AccessControl, ReentrancyGuard {
    struct rateStruct {
        uint256 topRate;
        uint256 usdtRate;
    }

    rateStruct public usdtToTopRate;

    // Role identifier for IMO group
    bytes32 public constant IMO_ROLE = keccak256("IMO_ROLE");

    event RateUpdated(uint256 oldTOPRate, uint256 oldUSDTRate,uint256 newTOPRate, uint256 newUSDTRate);

    // USDT and TOP token contract addresses
    IERC20Metadata public usdtToken;
    IERC20Metadata public topToken;

    constructor(address _usdtAddress, address _topAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(IMO_ROLE, msg.sender);
        usdtToken = IERC20Metadata(_usdtAddress);
        topToken = IERC20Metadata(_topAddress);
    }

    // Update USDT to TOP exchange rate - IMO role only
    function updateUsdtTopRate(uint256 topRate, uint256 usdtRate) external onlyRole(IMO_ROLE) {
        uint8 usdtDecimals = usdtToken.decimals();
        uint8 topDecimals = topToken.decimals();
        // 根据ERC20接口返回的精度，可以在此处对_newRate进行必要的换算
        uint256 oldTopRate = usdtToTopRate.topRate;
        uint256 oldUsdtRate = usdtToTopRate.usdtRate;

        if (topDecimals >= usdtDecimals) {
            usdtToTopRate.topRate = topRate * (10 ** (topDecimals - usdtDecimals));
            usdtToTopRate.usdtRate = usdtRate;

        } else if (topDecimals < usdtDecimals) {
            usdtToTopRate.topRate = topRate;
            usdtToTopRate.usdtRate = usdtRate * (10 ** (usdtDecimals - topDecimals));
        }


        require(usdtToTopRate.topRate > 0 && usdtToTopRate.usdtRate > 0, "New rate must be greater than 0");
        emit RateUpdated(oldTopRate, oldUsdtRate, usdtToTopRate.topRate, usdtToTopRate.usdtRate);
    }

    // Withdraw USDT - IMO role only
    function withdrawUSDT(uint256 _amount) external nonReentrant onlyRole(IMO_ROLE) {

        require(usdtToken.balanceOf(address(this)) >= _amount, "Insufficient USDT balance");
        usdtToken.transfer(msg.sender, _amount);
        emit USDTWithdrawn(msg.sender, _amount);
    }

    event USDTWithdrawn(address indexed to, uint256 amount);
}
