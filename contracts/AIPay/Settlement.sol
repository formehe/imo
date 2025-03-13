// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./deposit.sol";

contract Settlement is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    Deposit public depositContract;

    // Mapping to store user balances
    mapping(address => uint256) public userBalances;


    //========================= tmp setting =========================
    // xx u/token
    uint256 public UperTokens = 1e9;

    //========================= tmp setting =========================

    // Events
    event BalanceUpdated(address indexed user, uint256 previousBalance, uint256 newBalance);
    event DepositContractUpdated(address oldContract, address newContract);

    constructor(address _depositContractAddress) {
        depositContract = Deposit(_depositContractAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
    }


    /**
     * @dev Updates the deposit contract address
     * @param _newDepositContract The address of the new deposit contract
     */
    function updateDepositContract(address _newDepositContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newDepositContract != address(0), "Invalid contract address");
        address oldContract = address(depositContract);
        depositContract = Deposit(_newDepositContract);
        emit DepositContractUpdated(oldContract, _newDepositContract);
    }

    /**
     * @dev Gets a user's current balance
     * @param user The address of the user
     * @return The user's current balance
     */
    function getUserBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }

    /**
         * @dev Updates a user's balance in the Settlement contract by fetching the updated balance from the deposit contract
         * @param user The address of the user
        */
    function refreshUserBalance(address user, uint256 newBalance) external onlyRole(OPERATOR_ROLE) {
        (, uint256 previousBalance) = depositContract.getUserBalance(user);

        //todo need to add some check？
        depositContract.updateUserBalance(user,newBalance);
        emit BalanceUpdated(user, previousBalance, newBalance);
    }

    //todo user + miner 地址
    //
    /**
    * @dev Deducts workload from user's balance and emits an event
    * @param workload The amount of workload to deduct
    * @param user The address of the user performing inference
    * @param worker The array of worker node addresses for parameter inference
    * @param modelId The ID of the model being used
    * @param sessionId Part of the unique session identifier
    * @param epochId Another part of the unique session identifier
    */
    function deductWorkload(
        uint256 workload,
        address user,
        address[] memory worker,
        uint256 modelId,
        uint256 sessionId,
        uint256 epochId
    ) external onlyRole(OPERATOR_ROLE) {

        //换算关系

        uint256 needReserveU = UperTokens * workload ;
        // current user balance
        (, uint256 previousBalance) = depositContract.getUserBalance(user);

        require(previousBalance >= needReserveU, "not enought for paying");

        depositContract.updateUserBalance(user,previousBalance - needReserveU);

        emit BalanceUpdated(user, previousBalance, userBalances[user]);
        emit WorkloadDeducted(workload, user, worker, modelId, sessionId, epochId);
    }

    event WorkloadDeducted(
        uint256 workload,
        address indexed user,
        address[] worker,
        uint256 modelId,
        uint256 sessionId,
        uint256 epochId
    );
}
