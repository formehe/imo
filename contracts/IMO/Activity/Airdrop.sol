// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Airdrop is Initializable {
    address public modelPorivder;
    address public modelPlatform;
    address public modelToken;

    uint256 public min_required_signatures = 2;
    mapping(bytes32 => mapping(address => bool)) public isConfirmed;
    mapping(bytes32 => uint256) public confirmCount;
    mapping(bytes32 => bool) public isExecuted;

    event AirdropProposed(bytes32 indexed proposalId, address token, address[] recipients, uint256[] amounts);
    event AirdropConfirmed(bytes32 indexed proposalId, address signer);
    event AirdropExecuted(bytes32 indexed proposalId);
    event AirdropCancelled(bytes32 indexed proposalId, address canceller);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _modelProvider,
        address _modelPlatform,
        address _modelToken
    ) external initializer {
        require(_modelProvider != address(0), "Invalid model provider address");
        require(_modelPlatform != address(0), "Invalid model platform address");
        require(_modelToken != address(0), "Invalid model token address");

        modelPorivder = _modelProvider;
        modelPlatform = _modelPlatform;
        modelToken = _modelToken;

        if (_modelProvider == _modelPlatform) {
            min_required_signatures = 1; // If both are the same, only one confirmation is needed
        }
    }

    function proposeAirdrop(
        address[] calldata _recipients,
        uint256[] calldata _amounts,
        string calldata description
    ) external returns (bytes32) {
        require(msg.sender == modelPorivder || msg.sender == modelPlatform, "Not authorized");
        require(_recipients.length == _amounts.length, "Length mismatch");

        bytes32 proposalId = keccak256(abi.encodePacked(
            _recipients,
            _amounts,
            description
        ));

        require(!isExecuted[proposalId], "Already executed");

        isConfirmed[proposalId][msg.sender] = true;
        confirmCount[proposalId] = 1;

        emit AirdropProposed(proposalId, modelToken, _recipients, _amounts);
        return proposalId;
    }

    function confirmAirdrop(bytes32 _proposalId) external {
        require(msg.sender == modelPorivder || msg.sender == modelPlatform, "Not authorized");
        require(!isExecuted[_proposalId], "Already executed");
        require(!isConfirmed[_proposalId][msg.sender], "Already confirmed");

        isConfirmed[_proposalId][msg.sender] = true;
        confirmCount[_proposalId] += 1;

        emit AirdropConfirmed(_proposalId, msg.sender);
    }

    // 执行空投
    function executeAirdrop(
        address[] calldata _recipients,
        uint256[] calldata _amounts,
        string calldata description
    ) external {
        bytes32 proposalId = keccak256(abi.encodePacked(
            _recipients,
            _amounts,
            description
        ));

        require(!isExecuted[proposalId], "Already executed");
        require(confirmCount[proposalId] >= min_required_signatures, "Not enough confirmations");

        isExecuted[proposalId] = true;

        _airdrop(
            IERC20(modelToken),
            _recipients,
            _amounts
        );

        emit AirdropExecuted(proposalId);
    }

    function _airdrop(
        IERC20 _token,
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) internal {
        // bytes selector for transfer(address,uint256)
        bytes4 transfer = 0xa9059cbb;

        assembly {
            // store transfer selector
            let transferData := add(0x20, mload(0x40))
            mstore(transferData, transfer)

            // store length of _recipients
            let sz := _amounts.length

            // loop through _recipients
            for {
                let i := 0
            } lt(i, sz) {
                // increment i
                i := add(i, 1)
            } {
                // store offset for _amounts[i]
                let offset := mul(i, 0x20)
                // store _amounts[i]
                let amt := calldataload(add(_amounts.offset, offset))
                // store _recipients[i]
                let recp := calldataload(add(_recipients.offset, offset))
                // store _recipients[i] in transferData
                mstore(
                    add(transferData, 0x04),
                    recp
                )
                // store _amounts[i] in transferData
                mstore(
                    add(transferData, 0x24),
                    amt
                )
                // call transfer for _amounts[i] to _recipients[i]
                // Perform the transfer, reverting upon failure.
                if iszero(
                    and( // The arguments of `and` are evaluated from right to left.
                        or(eq(mload(0x00), 1), iszero(returndatasize())), // Returned 1 or nothing.
                        call(gas(), _token, 0, transferData, 0x44, 0x00, 0x20)
                    )
                ) {
                    revert(0, 0)
                }  
            }
        }
    }

    function cancelAirdrop(
        address[] calldata _recipients,
        uint256[] calldata _amounts,
        string calldata description
    ) external {
        bytes32 proposalId = keccak256(abi.encodePacked(
            _recipients,
            _amounts,
            description
        ));

        require(!isExecuted[proposalId], "Already executed");
        require(isConfirmed[proposalId][msg.sender], "Not the proposer");
        require(msg.sender == modelPorivder || msg.sender == modelPlatform, "Not authorized");

        delete confirmCount[proposalId];
        delete isConfirmed[proposalId][modelPorivder];
        delete isConfirmed[proposalId][modelPlatform];

        emit AirdropCancelled(proposalId, msg.sender);
    }
}