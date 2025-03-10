
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Address.sol";
import "./NodesGovernance.sol";
import "./ShareDataType.sol";
import "./IReward.sol";

contract NodesConstantReward is IReward {
    struct NodeSettlementPerPriod {
        uint256 penalty;
        uint256 reward;
        uint256 pendingReward;
        address wallet;
    }

    NodesGovernance public nodes;
    // uint256 totalTOP; //单位gwei
    mapping(address => NodeSettlementPerPriod) public settlements;
    uint256 public currentSettlementPeriodId;
    event RewardsDistributed(uint256 baseReward, uint256 elasticReward);
    // event PenaltyApplied(address indexed node, uint256 penaltyAmount);

    constructor(address _nodes) {
        require(Address.isContract(_nodes), "Invalid nodes address");
        nodes = NodesGovernance(_nodes);
    }

    function distributeRewards(uint256 detectPeriodId, uint256 totalAsset) external override{
        require(totalAsset > 0, "Invalid coins");
        require((detectPeriodId > currentSettlementPeriodId), "Reward has been settlemented");
        require((detectPeriodId - currentSettlementPeriodId) == 1, "Reward settlement not continuous");
        (NodeState[] memory states, uint256 totalQuotas) = nodes.settlementOnePeriod(detectPeriodId);
        currentSettlementPeriodId = detectPeriodId;
        uint256 unitPrice = totalAsset / totalQuotas;
        for (uint256 i = 0; i < states.length; i++) {
            NodeState memory  state = states[i];
            uint256 pendingReward;
            NodeSettlementPerPriod storage settlement = settlements[state.identifier];
            if (settlement.wallet != address(0)) {
                pendingReward = settlement.pendingReward;
            } else {
                settlements[state.identifier] = NodeSettlementPerPriod({
                    penalty: 0,
                    reward: 0,
                    pendingReward: 0,
                    wallet: state.wallet
                });

                settlement = settlements[state.identifier];
                pendingReward = 0;
            }
            
            uint256 reward = (state.expectCnt - state.failedCnt) * unitPrice;

            if ((state.failedCnt > state.successfulCnt) && (state.failedCnt > 3)) {
                // uint256 penalty = reward;
                // settlement.pendingReward += penalty;
            } else {
                if (pendingReward != 0) {
                    payable(state.wallet).transfer(pendingReward);
                }

                settlement.pendingReward = reward;
            }
        }
    }
}