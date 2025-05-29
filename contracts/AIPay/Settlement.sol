// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./Deposit.sol";
import "./Bank.sol";
import "../AI/AIModels.sol";

contract Settlement is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    Deposit public depositContract;
    Bank public bankContract;
    AIModels public aimodelContract;
    
    uint256 public inferenceTax;
    address public taxVault;

    // Events
    event DepositContractUpdated(address oldContract, address newContract);
    event InferenceTaxUpdated(uint256 oldInferenceTax, uint256 newInferenceTax);
    event TaxVaultUpdated(address oldTaxVault, address newTaxVault);

    constructor(address _depositContractAddress, address _bankContractAddress, address _aimodelAddress) {
        depositContract = Deposit(_depositContractAddress);
        bankContract = Bank(_bankContractAddress);
        aimodelContract = AIModels(_aimodelAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function updateInferenceTax(uint256 _inferenceTax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_inferenceTax < 100, "Invalid inference tax");
        emit InferenceTaxUpdated(inferenceTax, _inferenceTax);
        inferenceTax = _inferenceTax;
    }

    function updateTaxVault(address _taxVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(Address.isContract(_taxVault), "Invalid tax token");
        emit TaxVaultUpdated(taxVault, _taxVault);
        taxVault = _taxVault;
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
        uint256 epochId,
        uint256 inputWorkLoad
    ) external onlyRole(OPERATOR_ROLE) {
        uint256 needReserveU = _calculatePrice(workload, modelId, false);
        needReserveU = needReserveU + _calculatePrice(inputWorkLoad, modelId, true);
        require(needReserveU > 0, "Invalid reserve");

        // current user balance
        bool enough = true;
        (, uint256 previousBalance) = depositContract.getUserBalance(user);
        if (previousBalance < needReserveU) {
            needReserveU = previousBalance;
            enough = false;
        }

        // require(previousBalance >= needReserveU, "not enought for paying");

        // update the top
        (uint256 topR, uint256 usdtR) = bankContract.usdtToTopRate();
        uint256 topamount = needReserveU * topR / usdtR;

        require(topamount != 0, "topamount cannot be zero");
        if (inferenceTax > 0) {
            uint256 tax = topamount * inferenceTax / 100;
            topamount = topamount - tax;
            depositContract.updateWorkerBalance(taxVault, tax, true);
        }

        uint256 topamountperworker = topamount / worker.length;

        depositContract.updateUserBalance(user,previousBalance - needReserveU);
        emit WorkloadDeducted(workload, user, worker, modelId, sessionId, epochId, enough, inputWorkLoad);

        require(topamountperworker != 0, "topamountperworker cannot be zero");
        for (uint256 i = 0; i < worker.length; i++) {
            depositContract.updateWorkerBalance(worker[i], topamountperworker, true);
        }
    }

    event WorkloadDeducted(
        uint256 workload,
        address indexed user,
        address[] worker,
        uint256 modelId,
        uint256 sessionId,
        uint256 epochId,
        bool    enough,
        uint256 inputWorkload
    );

    function _calculatePrice(uint256 workload, uint256 modelId, bool isInputPrice) internal view returns (uint256) {
        (, , , address modelAddress, , , uint256 inTokenPrice, uint256 outTokenPrice ) = aimodelContract.uploadModels(modelId);
        require(modelAddress != address(0), "Model does not exist");
        if (isInputPrice) {
            return inTokenPrice * workload;
        } else {
            return outTokenPrice * workload;
        }
    }
}
