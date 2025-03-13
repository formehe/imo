// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./deposit.sol";

contract Settlement is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    Deposit public depositContract;

    // Mapping to store user balances
    mapping(address => uint256) public userBalances;

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
}
