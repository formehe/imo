// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./bank.sol";

contract Deposit is AccessControl {
    bytes32 public constant IMO_ROLE = keccak256("IMO_ROLE");
    
    IERC20 public usdt;
    address public bankAddress;
    // uint256 public usdtToTopRate; // How many TOP tokens per 1 USDT

    // Events
    event DepositMade(address indexed user, uint256 usdtAmount, uint256 rate);

    event BankAddressUpdated(address oldBank, address newBank);

    constructor(address _usdtAddress, address _bankAddress) {
        usdt = IERC20(_usdtAddress);
        bankAddress = _bankAddress;
        //usdtToTopRate = 1; // 1:1 initial rate
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(IMO_ROLE, msg.sender);
    }

    // Deposit USDT to bank contract
    function deposit(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(bankAddress != address(0), "Bank address not set");
        
        // Transfer USDT from user to bank
        bool success = usdt.transferFrom(msg.sender, bankAddress, _amount);
        require(success, "USDT transfer failed");


        // Get usdtToTopRate from bank contract
        Bank bank = Bank(bankAddress);
        uint256 bankRate = bank.usdtToTopRate();
        require(bankRate > 0, "Invalid bank rate");
        emit DepositMade(msg.sender, _amount, bankRate);
    }


    // Update bank address
    function updateBankAddress(address _newBank) external onlyRole(IMO_ROLE) {
        require(_newBank != address(0), "Invalid bank address");
        address oldBank = bankAddress;
        bankAddress = _newBank;
        emit BankAddressUpdated(oldBank, _newBank);
    }

    // View function to get current TOP amount for USDT
    //function getTopAmount(uint256 _usdtAmount) external view returns (uint256) {
    //    return _usdtAmount * usdtToTopRate;
    //}

    // User balance tracking
    struct UserBalance {
        uint256 totalDeposited; // Total USDT amount ever deposited
        uint256 currentBalance; // Current remaining USDT balance
    }
    
    // Mapping to track user balances
    mapping(address => UserBalance) public userBalances;

    // Event for balance updates
    event UserBalanceUpdated(address indexed user, uint256 newBalance);

    // Update user's current balance (only IMO role)
    function updateUserBalance(address _user, uint256 _newBalance) external onlyRole(IMO_ROLE) {
        require(_user != address(0), "Invalid user address");
        userBalances[_user].currentBalance = _newBalance;
        emit UserBalanceUpdated(_user, _newBalance);
    }

    // Get user's balance info
    function getUserBalance(address _user) external view returns (uint256 total, uint256 current) {
        UserBalance memory balance = userBalances[_user];
        return (balance.totalDeposited, balance.currentBalance);
    }

    // Internal function to update user balance on deposit
    function _updateUserBalanceOnDeposit(address _user, uint256 _amount) internal {
        userBalances[_user].totalDeposited += _amount;
        userBalances[_user].currentBalance += _amount;
    }
}
