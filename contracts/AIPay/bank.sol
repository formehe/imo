// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract Bank is AccessControl {
    // Exchange rate between USDT and TOP
    // uint256 public usdtToTopRate = 1e18;

    struct rateStruct {
        uint256 topRate;
        uint256 usdtRate;
    }

    rateStruct public usdtToTopRate;

    // Role identifier for IMO group
    bytes32 public constant IMO_ROLE = keccak256("IMO_ROLE");

    event RateUpdated(uint256 oldRate, uint256 newRate);

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
    function updateUsdtTopRate(uint256 _topRate, uint256 _usdtRate) external onlyRole(IMO_ROLE) {

        uint8 usdtDecimals = usdtToken.decimals();
        uint8 topDecimals = topToken.decimals();
        // 根据ERC20接口返回的精度，可以在此处对_newRate进行必要的换算

        console.log("sol usdtDecimals: ",usdtDecimals);
        console.log("sol topDecimals: ",topDecimals);

        if (topDecimals >= usdtDecimals) {
            usdtToTopRate.topRate = _topRate * (10 ** (topDecimals - usdtDecimals));
            usdtToTopRate.usdtRate = _usdtRate;

            console.log("sol 1 usdtToTopRate.topRate: ",usdtToTopRate.topRate);
            console.log("sol 1 usdtToTopRate.usdtRate: ",usdtToTopRate.usdtRate);

        } else if (topDecimals < usdtDecimals) {
            usdtToTopRate.topRate = _topRate;
            usdtToTopRate.usdtRate = _usdtRate * (10 ** (usdtDecimals - topDecimals));

            console.log("sol 2 usdtToTopRate.topRate: ",usdtToTopRate.topRate);
            console.log("sol 2 usdtToTopRate.usdtRate: ",usdtToTopRate.usdtRate);

        }


        require(usdtToTopRate.topRate > 0 && usdtToTopRate.usdtRate > 0, "New rate must be greater than 0");
    }

    // Withdraw USDT - IMO role only
    function withdrawUSDT(uint256 _amount) external onlyRole(IMO_ROLE) {

        require(usdtToken.balanceOf(address(this)) >= _amount, "Insufficient USDT balance");
        usdtToken.transfer(msg.sender, _amount);
        emit USDTWithdrawn(msg.sender, _amount);
    }

    event USDTWithdrawn(address indexed to, uint256 amount);

    //// Withdraw TOP - IMO role only
    //function withdrawTOP(uint256 _amount) external onlyRole(IMO_ROLE) {
    //    require(topToken.balanceOf(address(this)) >= _amount, "Insufficient TOP balance");
    //    topToken.transfer(msg.sender, _amount);
    //    emit TOPWithdrawn(msg.sender, _amount);
    //}
    //event TOPWithdrawn(address indexed to, uint256 amount);

    // Update USDT to TOP conversion rate
    //function updateRate(uint256 _newRate) external onlyRole(IMO_ROLE) {
    //    require(_newRate > 0, "Rate must be greater than 0");
    //    uint256 oldRate = usdtToTopRate;
    //    usdtToTopRate = _newRate;
    //    emit RateUpdated(oldRate, _newRate);
    //}

}
