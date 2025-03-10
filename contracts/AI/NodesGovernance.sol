// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ShareDataType.sol";
import "./NodesRegistry.sol";

contract NodesGovernance is NodesRegistry{
    uint256 public detectDurationTime = 24 * 3 minutes;
    uint256 public roundDurationTime = 3 minutes;

    enum VoteType {None, Active, Against, For}

    struct CandidateVoted {
        address candidate;   // 被验证节点
        uint128 yesVotes;   // 通过投票次数
        uint128 noVotes;    // 不通过投票次数
        bool    completed;  // 验证是否完成
    }

    struct ValidatorVote {
        mapping(address => VoteType) validators;
    }

    struct RoundRange {
        uint256 startId;
        uint256 endId;
        uint256 startTime;
        uint256 endTime;
    }

    struct ValidationRound {
        address[]     candidateSets; // 验证集
        uint256       numOfNodes;
        uint256       expectedCompletionTime; // 验证期望完成时间
    }

    mapping(uint256 => mapping(address => ValidatorVote)) internal votesPerValidator; // 验证者投票信息
    mapping(uint256 => mapping(address => address[])) public validatorsPerCandidate; // 验证者集合
    mapping(uint256 => mapping(address => CandidateVoted)) public votedPerCandidate; // 存储轮次信息
    mapping(uint256 => ValidationRound) public candidatePerRound; // 存储轮次信息

    mapping(uint256 => RoundRange) public detectPeriods;
    mapping(uint256 => mapping(address => NodeState)) internal stateOfNodes;
    mapping(uint256 => address[]) internal nodesPerPeriod;
    mapping(uint256 => uint256) internal quotaPerPeriod;

    uint256 public currentDetectCircleId;
    uint256 public currentDetectCircleStartTime;
    uint256 public currentRoundId; 
    uint256 public currentRoundStartTime;
    uint256 public constant VALIDATOR_PER_CANDIDATE = 5; 
    uint256 public constant MIN_CANDIDATE = 5;

    event ValidationStarted(uint256 roundId, uint256 expectedCompletionTime, address candidate, address[] validators);
    event ValidationResult(uint256 roundId, address validator, bool result);
    event SettlementResult(NodeState[] states, uint256 totalQuota);

    function nodesGovernance_initialize(
        NodeInfo[] calldata _nodesInfos,
        address             _allocator,
        uint256             _roundDurationTime,
        address             _stakeToken
    ) external initializer {
        NodesRegistry._nodesRegistry_initialize(_nodesInfos, _allocator, _stakeToken);

        currentRoundStartTime = block.timestamp;
        detectDurationTime = 24 * _roundDurationTime;
        roundDurationTime =  _roundDurationTime;
    }

    function _pickValidators(
        address candidate,
        uint256 roundId,
        bytes memory random
    ) internal {
        uint256 numOfValidators = 0;
        
        candidatePerRound[roundId].candidateSets.push(candidate);
        votedPerCandidate[roundId][candidate] = CandidateVoted({
            candidate: candidate,
            yesVotes: 0,
            noVotes: 0,
            completed: false
        });

        for (uint256 i = 0; numOfValidators < VALIDATOR_PER_CANDIDATE && i < 2 * length() ; i++) {
            uint256 validatorIndex = uint256(keccak256(abi.encodePacked(random, i))) % length();
            Node memory validator = at(validatorIndex);
            if (!validator.active) {
                continue;
            }
            
            ValidatorVote storage validatorVote = votesPerValidator[roundId][candidate];

            if ((validator.identifier != candidate) && (validatorVote.validators[validator.identifier] == VoteType.None)) {
                validatorVote.validators[validator.identifier] = VoteType.Active;
                validatorsPerCandidate[roundId][candidate].push(validator.identifier);
                numOfValidators++;
            }
        }
    }

    function _pickCandidateValidators(
        uint256 detectId,
        uint256 roundId,
        uint256 expectFinishTime
    ) internal {
        uint256 numOfCandidate = 0;
        RoundRange storage range = detectPeriods[detectId];

        for (uint256 i = 0; numOfCandidate < MIN_CANDIDATE /* && i < 2 * length() */; i++) {
            bytes memory randomCandidate = abi.encodePacked(block.timestamp, blockhash(block.number - 1), i);
            uint256 candidateIndex = uint256(keccak256(randomCandidate)) % length();
            Node memory candidate = at(candidateIndex);
            if ((candidate.registrationTime > range.startTime) || !candidate.active) {
                continue;
            }

            if (validatorsPerCandidate[roundId][candidate.identifier].length != 0) {
                continue;
            }

            numOfCandidate++;
            _pickValidators(candidate.identifier, roundId, randomCandidate);
            emit ValidationStarted(roundId, expectFinishTime, candidate.identifier, validatorsPerCandidate[roundId][candidate.identifier]);
        }
    }

    function _lenOfAvailableNodes(
        uint256 detectId
    ) internal view returns(uint256 count) {
        RoundRange storage range = detectPeriods[detectId];
        for (uint256 i = 0; i < length(); i++) {
            if ((!at(i).active) || 
                (at(i).registrationTime > range.startTime)) {
                continue;
            }

            count++;
        }

        return count;
    }

    function _checkRegister(
        address candidate
    ) internal override {
        uint256 currentTime = block.timestamp;

        currentRoundId++;
        // currentRoundStartTime = currentTime;
        if ((currentTime - currentDetectCircleStartTime) > detectDurationTime) {
            currentDetectCircleId++;
            currentDetectCircleStartTime = currentTime;
            detectPeriods[currentDetectCircleId] = RoundRange(currentRoundId, currentRoundId, currentTime, currentTime);
        } else {
            detectPeriods[currentDetectCircleId].endId = currentRoundId;
            detectPeriods[currentDetectCircleId].endTime = currentTime;
        }

        candidatePerRound[currentRoundId].expectedCompletionTime = currentTime + roundDurationTime;
        candidatePerRound[currentRoundId].numOfNodes = _lenOfAvailableNodes(currentDetectCircleId);
        _pickValidators(candidate, currentRoundId, 
            abi.encodePacked(block.timestamp, blockhash(block.number - 1), uint256(1)));
        if (validatorsPerCandidate[currentRoundId][candidate].length == 0) {
            _active(candidate);
        } else {
            emit ValidationStarted(currentRoundId, currentTime + roundDurationTime, candidate, validatorsPerCandidate[currentRoundId][candidate]);
        }
    }

    // 开始新一轮验证
    function startNewValidationRound(
    ) external returns (uint256 detectId, uint256 roundId){
        uint256 currentTime = block.timestamp;
        require((currentTime - currentRoundStartTime) > roundDurationTime, "Previous round is not ending");

        currentRoundId++;
        currentRoundStartTime = currentTime;
        if ((currentTime - currentDetectCircleStartTime) > detectDurationTime) {
            currentDetectCircleId++;
            currentDetectCircleStartTime = currentTime;
            detectPeriods[currentDetectCircleId] = RoundRange(currentRoundId, currentRoundId, currentTime, currentTime);
        } else {
            detectPeriods[currentDetectCircleId].endId = currentRoundId;
            detectPeriods[currentDetectCircleId].endTime = currentTime;
        }

        candidatePerRound[currentRoundId].expectedCompletionTime = currentTime + roundDurationTime;
        candidatePerRound[currentRoundId].numOfNodes = _lenOfAvailableNodes(currentDetectCircleId);

        _pickCandidateValidators(currentDetectCircleId, currentRoundId, currentTime + roundDurationTime);
        return (currentDetectCircleId, currentRoundId);
    }

    // 验证节点投票
    function vote(
        uint256 roundId,
        address candidate,
        bool result
    ) external {
        ValidationRound storage round = candidatePerRound[roundId];
        require(round.expectedCompletionTime >= block.timestamp, "Validation time exceeded");
        ValidatorVote storage validatorVote = votesPerValidator[roundId][candidate];
        require(validatorVote.validators[msg.sender] == VoteType.Active, "Invalid validator");

        CandidateVoted storage voted = votedPerCandidate[roundId][candidate];
        require(!voted.completed, "Validation already completed");

        // 更新投票结果
        if (result) {
            voted.yesVotes++;
            validatorVote.validators[msg.sender] = VoteType.For;
        } else {
            voted.noVotes++;
            validatorVote.validators[msg.sender] = VoteType.Against;
        }

        uint256 len = validatorsPerCandidate[roundId][candidate].length;

        if (((voted.yesVotes + voted.noVotes) == len) 
            && (voted.yesVotes == voted.noVotes)) {
            voted.completed = true;
            emit ValidationResult(roundId, msg.sender, false);
            return;
        }

        if (voted.yesVotes > (len / 2)) {
            voted.completed = true;
            _active(candidate);
            emit ValidationResult(roundId, msg.sender, true);
        } else if (voted.noVotes > (len / 2)) {
            voted.completed = true;
            emit ValidationResult(roundId, msg.sender, false);
        }
    }

    function getRoundCandidates(
        uint256 roundId
    ) public view returns (address[] memory candidates) {
        return candidatePerRound[roundId].candidateSets;
    }

    function getValidatorsOfCandidate(
        uint256 roundId,
        address candidate
    ) public view returns (address[] memory validators) {
        return validatorsPerCandidate[roundId][candidate];
    }

    function settlementOnePeriod(
        uint256 detectPeriodId
    ) public returns (NodeState[] memory states, uint256 totalQuotas) {
        require(detectPeriodId < currentDetectCircleId, "Settlement for detected period");
        RoundRange storage range = detectPeriods[detectPeriodId];

        require(range.startId != 0, "Detect period id is not exist");
        address[] storage nodes = nodesPerPeriod[detectPeriodId];
        require(nodes.length == 0, "Period has been settled");
        uint256 roundsInPeriod = range.endId - range.startId + 1;
        
        for (uint256 i = 0; i < length(); i++){
            Node memory candidate = at(i);
            if ((!candidate.active) || (candidate.registrationTime > range.startTime)) {
                continue;
            }

            nodes.push(candidate.identifier);
            stateOfNodes[detectPeriodId][candidate.identifier] = NodeState(
                0, 0, uint128(roundsInPeriod), candidate.wallet, candidate.identifier);
        }

        for (uint256 i = range.startId; i <= range.endId; i++) {
            ValidationRound storage validationRound = candidatePerRound[i];
            totalQuotas = totalQuotas + validationRound.numOfNodes;
            for (uint256 j = 0; j < validationRound.candidateSets.length; j++) {
                address candidate = validationRound.candidateSets[j];
                CandidateVoted storage voted = votedPerCandidate[i][candidate];
                if (voted.candidate == address(0)) {
                    continue;
                }

                NodeState storage state = stateOfNodes[detectPeriodId][candidate];

                if (!voted.completed) {
                    state.failedCnt++;
                    continue;
                }

                if (voted.yesVotes <= voted.noVotes) {
                    state.failedCnt++;
                    continue;
                }

                state.successfulCnt++;
            }
        }

        quotaPerPeriod[detectPeriodId] = totalQuotas;
        states = new NodeState[](nodes.length);
        for (uint256 i = 0; i < nodes.length; i++){
            address identifier = nodes[i];
            NodeState storage state = stateOfNodes[detectPeriodId][identifier];
            if (state.identifier != address(0)) {
                states[i] = stateOfNodes[detectPeriodId][identifier];
            }
        }

        emit SettlementResult(states, totalQuotas);
        return (states, totalQuotas);
    }

    function getOnePeriodSettlement(
        uint256 detectPeriodId
    ) public view returns (NodeState[] memory states, uint256 totalQuotas) {
        address[] storage nodes = nodesPerPeriod[detectPeriodId];
        states = new NodeState[](nodes.length);
        for (uint256 i = 0; i < nodes.length; i++){
            address identifier = nodes[i];
            NodeState storage state = stateOfNodes[detectPeriodId][identifier];
            if (state.identifier != address(0)) {
                states[i] = stateOfNodes[detectPeriodId][identifier];
            }
        }

        return (states, quotaPerPeriod[detectPeriodId]);
    }
}