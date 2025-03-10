// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./AIWorkload.sol";
import "./AIModels.sol";

contract RewardManagement is Initializable {
    uint256 public totalReward;
    uint256 public rewardPerPeriod;
    uint256 public periods = 12;
    uint256 public distributedPeriods;
    uint256 public startTime;
    uint256 public interval = 30 days;

    mapping(address => uint256) public rewards;
    IERC20 public topWallet;
    AIWorkload public modelsWorkload;
    NodesRegistry public nodeRegistry;
    AIModels public modelRegistry;
    uint256 internal WOKER_REWARD_PERCENT = 60;

    event RewardDistributed(address indexed user, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function RewardManagement_initialize(
        address _topWallet, 
        uint256 _totalReward, 
        address _modelsWorkload,
        address _nodeRegistry,
        address _modelRegistry
    ) external initializer{
        require(_topWallet != address(0), "Invalid top token address");
        require(_modelRegistry != address(0), "Invalid model registry address");
        require(_nodeRegistry != address(0), "Invalid node registry address");
        require(_modelsWorkload != address(0), "Invalid model workload address");

        topWallet = IERC20(_topWallet);
        require(topWallet.balanceOf(address(this)) >= _totalReward && _totalReward > 0, "Not enough token");

        modelsWorkload = AIWorkload(_modelsWorkload);
        nodeRegistry = NodesRegistry(_nodeRegistry);
        modelRegistry = AIModels(_modelRegistry);

        // owner = msg.sender;
        totalReward = _totalReward;

        rewardPerPeriod = totalReward / periods;
    }

    function startDistribution() external {
        require(startTime == 0, "Distribution already started");
        startTime = block.timestamp;
    }

    function distributeReward() external {
        require(distributedPeriods < periods, "All rewards have been distributed");
        require(block.timestamp >= startTime + distributedPeriods * interval, "Current period not reached yet");

        (NodeSettleWorkload[] memory settledWorkers, ModelSettleWorkload[] memory settledModels, /*NodeSettleWorkload[] memory settledReporters*/) 
            = modelsWorkload.settleRewards();
        
        uint256 totalWorkerWorkload = 0;
        for (uint256 i = 0; i < settledWorkers.length; i++) {
            NodeSettleWorkload memory settledWorker = settledWorkers[i];
            totalWorkerWorkload += settledWorker.workload;
        }

        for (uint256 i = 0; i < settledWorkers.length; i++) {
            NodeSettleWorkload memory settledWorker = settledWorkers[i];
            uint256 reward = (WOKER_REWARD_PERCENT * settledWorker.workload) / (100 * totalWorkerWorkload);
            _transfer(settledWorker.node, reward);
        }

        uint256 totalModelWorkload = 0;
        for (uint256 i = 0; i < settledModels.length; i++) {
            ModelSettleWorkload memory settledModel = settledModels[i];
            totalModelWorkload += settledModel.workload;
        }

        for (uint256 i = 0; i < settledModels.length; i++) {
            ModelSettleWorkload memory settledModel = settledModels[i];
            uint256 reward = ((100 - WOKER_REWARD_PERCENT) * settledModel.workload) / (100 * totalModelWorkload);

            ( , , ,address uploader, ,) = modelRegistry.uploadModels(settledModel.modelId);
            _transfer(uploader, reward);
        }

        // uint256 totalReporterWorkload = 0;
        // for (uint256 i = 0; i < settledReporters.length; i++) {
        //     NodeSettleWorkload memory settledReporter = settledReporters[i];
        //     totalReporterWorkload += settledReporter.workload;
        // }

        distributedPeriods++;
    }

    function distributeReward(address[] calldata recipients) external {
        require(distributedPeriods < periods, "All rewards have been distributed");
        require(block.timestamp >= startTime + distributedPeriods * interval, "Current period not reached yet");

        uint256 amountPerRecipient = rewardPerPeriod / recipients.length;
        require(amountPerRecipient > 0, "Insufficient reward to distribute");

        for (uint256 i = 0; i < recipients.length; i++) {
            rewards[recipients[i]] += amountPerRecipient;
            payable(recipients[i]).transfer(amountPerRecipient);
            emit RewardDistributed(recipients[i], amountPerRecipient);
        }

        distributedPeriods++;
    }

    // function withdrawRemaining() external {
    //     require(distributedPeriods == periods, "Cannot withdraw until all rewards are distributed");
    //     uint256 remainingBalance = address(this).balance;
    //     payable(owner).transfer(remainingBalance);
    // }

    // function transferOwnership(address newOwner) external {
    //     require(newOwner != address(0), "New owner cannot be the zero address");
    //     emit OwnershipTransferred(owner, newOwner);
    //     owner = newOwner;
    // }

    function _transfer(
        address recipient, 
        uint256 amount
    ) internal {
        require(amount > 0, "Amount must be greater than zero");
        require(topWallet.balanceOf(address(this)) >= amount, "Not enough token");
        topWallet.transfer(recipient, amount);
    }

    // Fallback function to prevent accidental ETH transfers
    receive() external payable {
        revert("Direct deposits not allowed");
    }
}