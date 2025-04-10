// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Bank.sol";

contract Deposit is AccessControl, ReentrancyGuard {
    bytes32 public constant IMO_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public usdt;
    address public bankAddress;
    IERC20 public toptoken;
    // uint256 public usdtToTopRate; // How many TOP tokens per 1 USDT

    // Events
    event DepositMade(address indexed user, uint256 usdtAmount, uint256 topRate, uint256 usdtRate, uint256 currentBalance);

    event BankAddressUpdated(address oldBank, address newBank);

    constructor(address _usdtAddress, address _bankAddress, address _toptoken) {
        usdt = IERC20(_usdtAddress);
        bankAddress = _bankAddress;
        toptoken = IERC20(_toptoken);
        //usdtToTopRate = 1; // 1:1 initial rate
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Deposit USDT to bank contract
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(bankAddress != address(0), "Bank address not set");

        // Transfer USDT from user to bank
        bool success = usdt.transferFrom(msg.sender, bankAddress, _amount);
        require(success, "USDT transfer failed");

        // Update the user's balance after deposit
        _updateUserBalanceOnDeposit(msg.sender, _amount);

        // Get usdtToTopRate from bank contract
        Bank bank = Bank(bankAddress);
        (uint256 topRate,uint256 usdtRate) = bank.usdtToTopRate();
        require(topRate > 0 && usdtRate > 0, "Invalid usdtToTopRate rate");
        emit DepositMade(msg.sender, _amount, topRate,usdtRate , userBalances[msg.sender].currentBalance);
    }

    // Update bank address
    function updateBankAddress(address _newBank) external onlyRole(IMO_ROLE) {
        require(_newBank != address(0), "Invalid bank address");
        address oldBank = bankAddress;
        bankAddress = _newBank;
        emit BankAddressUpdated(oldBank, _newBank);
    }

    // User balance tracking
    struct UserBalance {
        uint256 totalDeposited; // Total USDT amount ever deposited
        uint256 currentBalance; // Current remaining USDT balance
    }

    // Mapping to track user balances
    mapping(address => UserBalance) public userBalances;

    // Event for balance updates
    //event UserBalanceUpdated(address indexed user, uint256 newBalance);
    event UserBalanceUpdated(address indexed user, uint256 newBalance, bool directory, uint256 currentBalance);

    // Update user's current balance (only IMO role)
    function updateUserBalance(address _user, uint256 _newBalance) external onlyRole(IMO_ROLE) {
        require(_user != address(0), "Invalid user address");
        userBalances[_user].currentBalance = _newBalance;
        emit UserBalanceUpdated(_user, _newBalance,false,userBalances[_user].currentBalance );
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

        emit UserBalanceUpdated(_user, _amount,true, userBalances[_user].currentBalance);
    }

    // ============================ worker top amount update ============================
    struct WorkerTopBalance {
        uint256 totalBalance; // Total USDT amount ever deposited
        uint256 currentBalance; // Current remaining USDT balance
    }

    // Mapping to track user balances
    mapping(address => WorkerTopBalance) public workerBalances;

    event WorkerTopBalanceUpdated(address indexed user, uint256 newBalance,bool directory, uint256 currentBalance);

    // Update user's current balance (only IMO role)
    function updateWorkerBalance(address _user, uint256 _addTop, bool direct ) public onlyRole(IMO_ROLE) {
        _updateWorkerBalance(_user, _addTop, direct);
    }

    function _updateWorkerBalance(address _user, uint256 _addTop, bool direct ) internal{
        require(_user != address(0), "Invalid user address");
        require(_addTop > 0, "should positive");

        if (direct) {
            //workerBalances[_user].totalBalance += _addTop;
            workerBalances[_user].currentBalance += _addTop;
        } else {

            require(workerBalances[_user].currentBalance >= _addTop, "Insufficient worker current balance");
            workerBalances[_user].currentBalance -= _addTop;
        }

        emit WorkerTopBalanceUpdated(_user, _addTop,direct,workerBalances[_user].currentBalance );

    }

    // for worker withdrawing
    function withdrawTOPByWorker() external nonReentrant {
        uint256 balance = workerBalances[msg.sender].currentBalance;
        require(balance > 0, "Worker balance not found for sender");
        require(toptoken.balanceOf(address(this)) >= balance, "Insufficient TOP balance");
        toptoken.transfer(msg.sender, balance);

        _updateWorkerBalance(msg.sender, balance, false);

        emit WithdrawTOPByWorker(msg.sender, balance);
    }

    event WithdrawTOPByWorker(address indexed to, uint256 amount);
}
