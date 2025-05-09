// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @dev 区块链国库合约，支持延时转账和多种代币
 */
contract Treasury is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    // 资金控制者地址
    address public fundsController;

    // 资金转移上限
    uint256 public transferLimit;

    // 延时时长（秒）
    uint256 public delayDuration;

    // 代币地址到已预留金额的映射
    mapping(address => uint256) public reservedAmounts;

    // 交易结构
    struct Transaction {
        address token;        // 代币地址，address(0)表示ETH
        address recipient;    // 接收者
        uint256 amount;       // 金额
        uint256 executeTime;  // 执行时间
        bool executed;        // 是否已执行
        bool cancelled;       // 是否已取消
    }

    // 交易ID到交易详情的映射
    mapping(uint256 => Transaction) public transactions;

    // 交易计数器
    uint256 public transactionCount;

    // 事件
    event TransactionSubmitted(uint256 indexed txId, address token, address recipient, uint256 amount, uint256 executeTime);
    event TransactionExecuted(uint256 indexed txId);
    event TransactionCancelled(uint256 indexed txId);
    event FundsControllerChanged(address indexed oldController, address indexed newController);
    event TransferLimitChanged(uint256 oldLimit, uint256 newLimit);
    event DelayDurationChanged(uint256 oldDuration, uint256 newDuration);

    /**
     * @dev 构造函数
     * @param _fundsController 初始资金控制者
     * @param _transferLimit 初始转移上限
     * @param _delayDuration 初始延时时长（秒）
     */
    constructor(
        address _fundsController,
        uint256 _transferLimit,
        uint256 _delayDuration
    ) {
        require(_fundsController != address(0), "Invalid funds controller");
        fundsController = _fundsController;
        transferLimit = _transferLimit;
        delayDuration = _delayDuration;
    }

    /**
     * @dev 修饰符：仅资金控制者可调用
     */
    modifier onlyFundsController() {
        require(msg.sender == fundsController, "Caller is not the funds controller");
        _;
    }

    /**
     * @dev 设置资金控制者
     * @param _newController 新的资金控制者
     */
    function setFundsController(address _newController) external onlyOwner {
        require(_newController != address(0), "Invalid funds controller");
        address oldController = fundsController;
        fundsController = _newController;
        emit FundsControllerChanged(oldController, _newController);
    }

    /**
     * @dev 设置资金转移上限
     * @param _newLimit 新的转移上限
     */
    function setTransferLimit(uint256 _newLimit) external onlyOwner {
        uint256 oldLimit = transferLimit;
        transferLimit = _newLimit;
        emit TransferLimitChanged(oldLimit, _newLimit);
    }

    /**
     * @dev 设置延时时长
     * @param _newDuration 新的延时时长（秒）
     */
    function setDelayDuration(uint256 _newDuration) external onlyOwner {
        uint256 oldDuration = delayDuration;
        delayDuration = _newDuration;
        emit DelayDurationChanged(oldDuration, _newDuration);
    }

    /**
     * @dev 提交ETH转账交易
     * @param _recipient 接收者地址
     * @param _amount 转账金额
     * @return 交易ID
     */
    function submitETHTransaction(address _recipient, uint256 _amount)
        external
        onlyFundsController
        whenNotPaused
        returns (uint256)
    {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= transferLimit, "Amount exceeds transfer limit");

        // 检查可用余额（总余额减去已预留金额）是否足够
        uint256 reservedETH = reservedAmounts[address(0)];
        require(address(this).balance >= reservedETH + _amount, "Insufficient available ETH balance");

        // 更新预留金额
        reservedAmounts[address(0)] += _amount;

        uint256 txId = transactionCount;
        transactions[txId] = Transaction({
            token: address(0),
            recipient: _recipient,
            amount: _amount,
            executeTime: block.timestamp + delayDuration,
            executed: false,
            cancelled: false
        });

        transactionCount++;

        emit TransactionSubmitted(txId, address(0), _recipient, _amount, block.timestamp + delayDuration);

        return txId;
    }

    /**
     * @dev 提交ERC20代币转账交易
     * @param _token 代币地址
     * @param _recipient 接收者地址
     * @param _amount 转账金额
     * @return 交易ID
     */
    function submitTokenTransaction(address _token, address _recipient, uint256 _amount)
        external
        onlyFundsController
        whenNotPaused
        returns (uint256)
    {
        require(_token != address(0), "Invalid token address");
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= transferLimit, "Amount exceeds transfer limit");

        // 检查可用余额（总余额减去已预留金额）是否足够
        uint256 currentBalance = IERC20(_token).balanceOf(address(this));
        uint256 reservedAmount = reservedAmounts[_token];
        require(currentBalance >= reservedAmount + _amount, "Insufficient available token balance");

        // 更新预留金额
        reservedAmounts[_token] += _amount;

        uint256 txId = transactionCount;
        transactions[txId] = Transaction({
            token: _token,
            recipient: _recipient,
            amount: _amount,
            executeTime: block.timestamp + delayDuration,
            executed: false,
            cancelled: false
        });

        transactionCount++;

        emit TransactionSubmitted(txId, _token, _recipient, _amount, block.timestamp + delayDuration);

        return txId;
    }

    /**
     * @dev 执行交易
     * @param _txId 交易ID
     */
    function executeTransaction(uint256 _txId)
        external
        nonReentrant
        whenNotPaused
    {
        require(_txId < transactionCount, "Transaction does not exist");

        Transaction storage transaction = transactions[_txId];

        require(!transaction.executed, "Transaction already executed");
        require(!transaction.cancelled, "Transaction was cancelled");
        require(block.timestamp >= transaction.executeTime, "Transaction is not ready for execution");

        transaction.executed = true;

        // 释放预留的资金
        address token = transaction.token;
        uint256 amount = transaction.amount;
        reservedAmounts[token] -= amount;

        if (token == address(0)) {
            // ETH转账
            (bool success, ) = transaction.recipient.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20代币转账
            // 先检查余额是否足够
            uint256 balance = IERC20(token).balanceOf(address(this));
            require(balance >= amount, "Insufficient token balance for execution");

            // 使用safeTransfer更安全
            IERC20(token).safeTransfer(transaction.recipient, amount);
        }

        emit TransactionExecuted(_txId);
    }

    /**
     * @dev 取消交易
     * @param _txId 交易ID
     */
    function cancelTransaction(uint256 _txId)
        external
        onlyFundsController
        whenNotPaused
    {
        require(_txId < transactionCount, "Transaction does not exist");

        Transaction storage transaction = transactions[_txId];

        require(!transaction.executed, "Transaction already executed");
        require(!transaction.cancelled, "Transaction already cancelled");
        require(block.timestamp < transaction.executeTime, "Transaction is already executable");

        transaction.cancelled = true;

        // 释放预留的资金
        address token = transaction.token;
        uint256 amount = transaction.amount;
        reservedAmounts[token] -= amount;

        emit TransactionCancelled(_txId);
    }

    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 接收ETH
     */
    receive() external payable {}
}
