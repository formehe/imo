// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../IUniswap/IUniswapV2Router02.sol";
import "./IReward.sol";
import "./IModelToken.sol";

contract Reward is Initializable, Ownable, IReward, ReentrancyGuard {
    IERC20 public assetToken;
    IModelToken public modelToken;
    IUniswapV2Router02 internal uniswapRouter;
    uint256 private totalHistoricalRewards;
    
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _assetToken, address _owner, address _modelToken, address _router) external initializer {
        require(_owner != address(0), "Invalid owner address");
        require(_assetToken != address(0), "Invalid token address");
        require(_modelToken != address(0), "Invalid model token address");
        require(_router != address(0), "Invalid Uniswap router address");
        assetToken = IERC20(_assetToken);
        modelToken = IModelToken(_modelToken);
        uniswapRouter = IUniswapV2Router02(_router);
        _transferOwnership(_owner);
    }
    
    function getContractBalance() public view returns (uint256) {
        return assetToken.balanceOf(address(this));
    }
    
    function addToHistoricalRewards(uint256 amount) internal {
        totalHistoricalRewards += amount;
        emit RewardStatsUpdated(totalHistoricalRewards, getContractBalance());
    }
    
    function getHistoricalIncome() public view returns (uint256) {
        return getContractBalance() + totalHistoricalRewards;
    }
    
    function getTotalHistoricalRewards() public view returns (uint256) {
        return totalHistoricalRewards;
    }
    
    function distributeTaxTokens() public nonReentrant {
        modelToken.distributeTaxTokens();
        address[] memory path = new address[](2);
        path[0] = address(modelToken);
        path[1] = address(assetToken);
        uint256 swapBalance_ = modelToken.balanceOf(address(this));
        require(swapBalance_ > 0, "No tokens to swap");
        modelToken.approve(address(uniswapRouter), swapBalance_);
        uniswapRouter
                .swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    swapBalance_,
                    0,
                    path,
                    address(this),
                    block.timestamp + 600
                );
        emit TaxTokensSwapped(swapBalance_);
    }
    
    function distributeReward(address _to, uint256 _amount) external onlyOwner nonReentrant {
        require(_to != address(0), "Invalid recipient address");
        require(_amount > 0, "Amount must be greater than 0");
        require(
            getContractBalance() >= _amount,
            "Insufficient contract balance"
        );
        
        bool success = assetToken.transfer(_to, _amount);
        require(success, "Transfer failed");
        
        addToHistoricalRewards(_amount);
        emit RewardDistributed(_to, _amount);
    }
    
    function batchDistributeReward(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOwner nonReentrant {
        require(
            _recipients.length == _amounts.length,
            "Arrays length mismatch"
        );
        
        uint256 totalAmount = 0;
        for(uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        
        require(
            getContractBalance() >= totalAmount,
            "Insufficient contract balance"
        );
        
        for(uint256 i = 0; i < _recipients.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient address");
            require(_amounts[i] > 0, "Amount must be greater than 0");
            
            bool success = assetToken.transfer(_recipients[i], _amounts[i]);
            require(success, "Transfer failed");
            
            addToHistoricalRewards(_amounts[i]);
            emit RewardDistributed(_recipients[i], _amounts[i]);
        }
    }
}