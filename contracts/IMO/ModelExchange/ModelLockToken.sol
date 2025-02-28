// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/Checkpoints.sol";
import "./IModelLockToken.sol";
import "./IErrors.sol";

contract ModelLockToken is IModelLockToken, ERC20Upgradeable, IErrors{
    using SafeERC20 for IERC20;
    using Checkpoints for Checkpoints.History;

    address public founder;
    address public assetToken; // This is the token that is staked
    uint256 public matureAt; // The timestamp when the founder can withdraw the tokens
    bool public canStake; // To control private/public agent mode
    uint256 public initialLock; // Initial locked amount

    constructor() {
        _disableInitializers();
    }

    mapping(address => Checkpoints.History) private _balanceCheckpoints;

    bool internal locked;

    modifier noReentrant() {
        require(!locked, "cannot reenter");
        locked = true;
        _;
        locked = false;
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        address _founder,
        address _assetToken,
        uint256 _matureAt,
        bool _canStake
    ) external initializer {
        __ERC20_init(_name, _symbol);
        founder = _founder;
        matureAt = _matureAt;
        assetToken = _assetToken;
        canStake = _canStake;
    }

    // Stakers have to stake their tokens and delegate to a validator
    function stake(uint256 amount, address receiver) public {
        require(
            canStake || totalSupply() == 0,
            "Staking is disabled for private agent"
        ); // Either public or first staker

        address sender = _msgSender();
        require(amount > 0, "Cannot stake 0");
        require(
            IERC20(assetToken).balanceOf(sender) >= amount,
            "Insufficient asset token balance"
        );
        require(
            IERC20(assetToken).allowance(sender, address(this)) >= amount,
            "Insufficient asset token allowance"
        );

        if (totalSupply() == 0) {
            initialLock = amount;
        }

        IERC20(assetToken).safeTransferFrom(sender, address(this), amount);
        _mint(receiver, amount);
        _balanceCheckpoints[receiver].push(balanceOf(receiver));
    }

    function setCanStake(bool _canStake) public {
        require(_msgSender() == founder, "Not founder");
        canStake = _canStake;
    }

    function withdraw(uint256 amount) public noReentrant {
        address sender = _msgSender();
        require(balanceOf(sender) >= amount, "Insufficient balance");

        if (
            (sender == founder) && ((balanceOf(sender) - amount) < initialLock)
        ) {
            require(block.timestamp >= matureAt, "Not mature yet");
        }

        _burn(sender, amount);
        _balanceCheckpoints[sender].push(balanceOf(sender));

        IERC20(assetToken).safeTransfer(sender, amount);
    }

    function getPastBalanceOf(
        address account,
        uint256 timepoint
    ) public view returns (uint256) {
        uint256 currentTimepoint = block.number;
        if (timepoint >= currentTimepoint) {
            revert ERC5805FutureLookup(timepoint, currentTimepoint);
        }
        return
            _balanceCheckpoints[account].getAtBlock(timepoint);
    }

    // This is non-transferable token
    function transfer(
        address /*to*/,
        uint256 /*value*/
    ) public pure override returns (bool) {
        revert("Transfer not supported");
    }

    function transferFrom(
        address /*from*/,
        address /*to*/,
        uint256 /*value*/
    ) public pure override returns (bool) {
        revert("Transfer not supported");
    }

    function approve(
        address /*spender*/,
        uint256 /*value*/
    ) public pure override returns (bool) {
        revert("Approve not supported");
    }
}