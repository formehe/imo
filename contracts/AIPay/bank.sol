// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

//import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Bank is AccessControl {
    // Exchange rate between USDT and TOP
    uint256 public usdtToTopRate = 1e18;

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
    function updateUsdtTopRate(uint256 _newRate) external onlyRole(IMO_ROLE) {

        uint8 usdtDecimals = usdtToken.decimals();
        uint8 topDecimals = topToken.decimals();
        // 根据ERC20接口返回的精度，可以在此处对_newRate进行必要的换算

        if (topDecimals > usdtDecimals) {
            _newRate = _newRate * (10 ** (topDecimals - usdtDecimals));
        } else if (topDecimals < usdtDecimals) {
            _newRate = _newRate / (10 ** (usdtDecimals - topDecimals));
        }

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

    // 设计一个函数，返回USDT和TOP的兑换比例
    // rate是输入的兑换率整数，isUsdtPerTop表示rate的含义
    // isUsdtPerTop为true时，rate表示多少USDT兑换1个TOP
    // isUsdtPerTop为false时，rate表示1个USDT兑换多少TOP
    function getExchangeRatio(uint256 rate, bool isUsdtPerTop) public view returns (uint256, uint256) {
        require(rate > 0, "Rate must be greater than 0");

        uint8 usdtDecimals = usdtToken.decimals();
        uint8 topDecimals = topToken.decimals();

        // 标准化为每单位代币的数量(考虑精度)
        uint256 usdtAmount;
        uint256 topAmount;

        if (isUsdtPerTop) {
            // 例如：rate = 2，表示2 USDT = 1 TOP
            usdtAmount = rate;
            topAmount = 1;
        } else {
            // 例如：rate = 2，表示1 USDT = 2 TOP
            usdtAmount = 1;
            topAmount = rate;
        }

        // 考虑代币精度差异
        if (topDecimals > usdtDecimals) {
            topAmount = topAmount * (10 ** (topDecimals - usdtDecimals));
        } else if (usdtDecimals > topDecimals) {
            usdtAmount = usdtAmount * (10 ** (usdtDecimals - topDecimals));
        }

        return (usdtAmount, topAmount);
    }

}
