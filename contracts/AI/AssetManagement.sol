// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IStake.sol";

contract AssetManagement is Initializable, IStake {
    struct Stake {
        uint256 amount;
        uint256 unlockTime;
    }

    IERC20 public token;

    mapping(address => bool) public whiteContracts;
    mapping(address => mapping(address => Stake)) internal stakes;

    event Staked(address indexed user, address indexed contractAddress, uint256 amount, uint256 unlockTime);
    event Unstaked(address indexed user, address indexed contractAddress, uint256 amount);

    function AssetManagement_initialize(
        address _topWallet,
        address[] calldata _whiteContracts
    ) external initializer{
        require(_topWallet != address(0), "Invalid top token address");
        for (uint256 i = 0; i < _whiteContracts.length; i++) {
            require(_whiteContracts[i] != address(0), "Invalid white contract address");
            whiteContracts[_whiteContracts[i]] = true;
        }
    }

    function stake(
        address contractAddress,
        uint256 amount,
        uint256 lockPeriod
    ) external override {
        require(whiteContracts[contractAddress], "Contract not whitelisted");
        if (amount > 0 ) {
            require(amount > 0, "Amount must be greater than 0");
            require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        }

        // check

        uint256 unlockTime = block.timestamp + lockPeriod;
        stakes[contractAddress][msg.sender].amount += amount;
        stakes[contractAddress][msg.sender].unlockTime = unlockTime;

        emit Staked(msg.sender, contractAddress, amount, unlockTime);
    }

    /**
     * @notice Unstake tokens after the lock period.
     * @param contractAddress The address of the contract associated with the stake.
     */
    function unstake(
        address contractAddress
    ) external override{
        require(whiteContracts[contractAddress], "Contract not whitelisted");
        Stake storage userStake = stakes[msg.sender][contractAddress];
        require(userStake.amount > 0, "No staked amount");
        require(block.timestamp >= userStake.unlockTime, "Stake is still locked");

        uint256 amount = userStake.amount;

        // Reset stake information
        userStake.amount = 0;
        userStake.unlockTime = 0;

        // Transfer tokens back to the user
        require(token.transfer(msg.sender, amount), "Token transfer failed");

        emit Unstaked(msg.sender, contractAddress, amount);
    }

    function getStake(
        address contractAddress, 
        address user
    ) external view override returns (uint256 amount, uint256 unlockTime) {
        Stake memory userStake = stakes[contractAddress][user];
        return (userStake.amount, userStake.unlockTime);
    }
}