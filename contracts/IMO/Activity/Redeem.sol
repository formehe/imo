// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../IUniswap/IUniswapV2Router02.sol";
import "../ModelExchange/IModelToken.sol";

contract Redeem is ReentrancyGuard {
    address public immutable token;
    IUniswapV2Router02 public immutable uniswapRouter;

    event RedeemedAndBurned(
        address indexed user,
        address indexed token,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address _token,
        address _uniswapRouter
    ) {
        require(_token != address(0), "Invalid token");
        require(_uniswapRouter != address(0), "Invalid uniswap router");

        token = _token;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
    }

    function redeemAndBurn(
        address modelToken, 
        uint256 platformAmount, 
        uint256 minTargetOut
    ) nonReentrant external {
        require(modelToken != address(0), "Invalid model token");
        require(platformAmount > 0, "Invalid amount");

        // Step 1: Transfer platform token from user
        require(IERC20(token).transferFrom(msg.sender, address(this), platformAmount), "Transfer failed");

        // Step 2: Approve Uniswap
        IERC20(token).approve(address(uniswapRouter), platformAmount);

        // Step 3: Swap platform token for target token
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = modelToken;

        uint[] memory amounts = uniswapRouter.swapExactTokensForTokens(
            platformAmount,
            minTargetOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 receivedTargetAmount = amounts[1];

        // Step 4: Burn target tokens
        IModelToken(modelToken).burn(receivedTargetAmount);
        emit RedeemedAndBurned(msg.sender, modelToken, platformAmount, receivedTargetAmount);
    }
}