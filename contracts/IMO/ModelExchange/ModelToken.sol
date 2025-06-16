// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../IUniswap/IUniswapV2Router02.sol";
import "../IUniswap/IUniswapV2Factory.sol";
import "./IModelToken.sol";
import "./IModelFactory.sol";

contract ModelToken is
    ContextUpgradeable,
    IModelToken,
    Ownable2StepUpgradeable
{
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using SafeERC20 for IERC20;

    uint256 internal constant BP_DENOM = 10_000;
    uint256 internal constant MAX_SWAP_THRESHOLD_MULTIPLE = 20;

    address public uniswapV2Pair;
    uint256 public botProtectionDurationInSeconds;
    bool internal _tokenHasTax;
    IUniswapV2Router02 internal _uniswapRouter;

    uint32 public fundedDate;
    uint16 public projectBuyTaxBasisPoints;
    uint16 public projectSellTaxBasisPoints;
    uint16 public swapThresholdBasisPoints;
    address public pairToken; // The token used to trade for this token

    bool private _autoSwapInProgress;

    address public projectTaxRecipient;
    uint128 public projectTaxPendingSwap;
    address public vault; // Project supply vault

    string private _name;
    string private _symbol;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;

    mapping(address => mapping(address => uint256)) private _allowances;

    EnumerableSet.Bytes32Set private _validCallerCodeHashes;

    EnumerableSet.AddressSet private _liquidityPools;

    IModelFactory private _factory; // Single source of truth

    modifier onlyOwnerOrFactory() {
        if (owner() != _msgSender() && address(_factory) != _msgSender()) {
            revert CallerIsNotAdminNorFactory();
        }
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address[3] memory integrationAddresses_,
        bytes memory baseParams_,
        bytes memory supplyParams_,
        bytes memory taxParams_,
        address airdropToken_
    ) external override initializer {
        _decodeBaseParams(integrationAddresses_[0], baseParams_);
        _uniswapRouter = IUniswapV2Router02(integrationAddresses_[1]);
        pairToken = integrationAddresses_[2];

        ERC20SupplyParameters memory supplyParams = abi.decode(
            supplyParams_,
            (ERC20SupplyParameters)
        );

        ERC20TaxParameters memory taxParams = abi.decode(
            taxParams_,
            (ERC20TaxParameters)
        );

        _processSupplyParams(supplyParams);

        uint256 lpSupply = supplyParams.lpSupply * (10 ** decimals());
        uint256 vaultSupply = supplyParams.vaultSupply * (10 ** decimals());
        uint256 reserveSupply = supplyParams.reserveSupply * (10 ** decimals());

        botProtectionDurationInSeconds = supplyParams
            .botProtectionDurationInSeconds;

        _tokenHasTax = _processTaxParams(taxParams);
        swapThresholdBasisPoints = uint16(
            taxParams.taxSwapThresholdBasisPoints
        );
        projectTaxRecipient = taxParams.projectTaxRecipient;

        _mintBalances(lpSupply, vaultSupply, reserveSupply, airdropToken_);

        uniswapV2Pair = _createPair();

        _factory = IModelFactory(_msgSender());
        _autoSwapInProgress = true; // We don't want to tax initial liquidity
    }

    function _decodeBaseParams(
        address projectOwner_,
        bytes memory encodedBaseParams_
    ) internal {
        _transferOwnership(projectOwner_);

        (_name, _symbol) = abi.decode(encodedBaseParams_, (string, string));
    }

    function _processSupplyParams(
        ERC20SupplyParameters memory erc20SupplyParameters_
    ) internal {
        if (
            erc20SupplyParameters_.maxSupply !=
            (erc20SupplyParameters_.vaultSupply +
                erc20SupplyParameters_.lpSupply + 
                erc20SupplyParameters_.reserveSupply)
        ) {
            revert SupplyTotalMismatch();
        }

        if (erc20SupplyParameters_.maxSupply > type(uint128).max) {
            revert MaxSupplyTooHigh();
        }

        vault = erc20SupplyParameters_.vault;
    }

    function _processTaxParams(
        ERC20TaxParameters memory erc20TaxParameters_
    ) internal returns (bool tokenHasTax_) {
        if (
            erc20TaxParameters_.projectBuyTaxBasisPoints == 0 &&
            erc20TaxParameters_.projectSellTaxBasisPoints == 0
        ) {
            return false;
        } else {
            projectBuyTaxBasisPoints = uint16(
                erc20TaxParameters_.projectBuyTaxBasisPoints
            );
            projectSellTaxBasisPoints = uint16(
                erc20TaxParameters_.projectSellTaxBasisPoints
            );
            return true;
        }
    }

    function _mintBalances(uint256 lpMint_, uint256 vaultMint_, uint256 reserveSupply_, address airdropToken) internal {
        if (lpMint_ > 0) {
            _mint(address(this), lpMint_);
        }

        if (vaultMint_ > 0) {
            _mint(vault, vaultMint_);
        }

        if (reserveSupply_ > 0) {
            _mint(airdropToken, reserveSupply_);
        }
    }

    function _createPair() internal returns (address uniswapV2Pair_) {
        uniswapV2Pair_ = IUniswapV2Factory(_uniswapRouter.factory()).getPair(
            address(this),
            pairToken
        );

        if (uniswapV2Pair_ == address(0)) {
            uniswapV2Pair_ = IUniswapV2Factory(_uniswapRouter.factory())
                .createPair(address(this), pairToken);

            emit LiquidityPoolCreated(uniswapV2Pair_);
        }

        _liquidityPools.add(uniswapV2Pair_);

        return (uniswapV2Pair_);
    }

    function addInitialLiquidity(address lpOwner) external override onlyOwnerOrFactory {
        _addInitialLiquidity(lpOwner);
    }

    function _addInitialLiquidity(address lpOwner) internal {
        if (fundedDate != 0) {
            revert InitialLiquidityAlreadyAdded();
        }

        fundedDate = uint32(block.timestamp);

        if (balanceOf(address(this)) == 0) {
            revert NoTokenForLiquidityPair();
        }

        _approve(address(this), address(_uniswapRouter), type(uint256).max);
        IERC20(pairToken).approve(address(_uniswapRouter), type(uint256).max);

        (uint256 amountA, uint256 amountB, uint256 lpTokens) = _uniswapRouter
            .addLiquidity(
                address(this),
                pairToken,
                balanceOf(address(this)),
                IERC20(pairToken).balanceOf(address(this)),
                0,
                0,
                lpOwner,
                block.timestamp
            );

        emit InitialLiquidityAdded(amountA, amountB, lpTokens);

        // We now set this to false so that future transactions can be eligibile for autoswaps
        _autoSwapInProgress = false;
    }

    function isLiquidityPool(address queryAddress_) public view override returns (bool) {
        /** @dev We check the uniswapV2Pair address first as this is an immutable variable and therefore does not need
         * to be fetched from storage, saving gas if this address IS the uniswapV2Pool. We also add this address
         * to the enumerated set for ease of reference (for example it is returned in the getter), and it does
         * not add gas to any other calls, that still complete in 0(1) time.
         */
        return (queryAddress_ == uniswapV2Pair ||
            _liquidityPools.contains(queryAddress_));
    }

    function liquidityPools()
        external
        view
        override
        returns (address[] memory liquidityPools_)
    {
        return (_liquidityPools.values());
    }

    function addLiquidityPool(
        address newLiquidityPool_
    ) public override onlyOwnerOrFactory {
        // Don't allow calls that didn't pass an address:
        if (newLiquidityPool_ == address(0)) {
            revert LiquidityPoolCannotBeAddressZero();
        }
        // Only allow smart contract addresses to be added, as only these can be pools:
        if (newLiquidityPool_.code.length == 0) {
            revert LiquidityPoolMustBeAContractAddress();
        }
        // Add this to the enumerated list:
        _liquidityPools.add(newLiquidityPool_);
        emit LiquidityPoolAdded(newLiquidityPool_);
    }

    function removeLiquidityPool(
        address removedLiquidityPool_
    ) external override onlyOwnerOrFactory {
        // Remove this from the enumerated list:
        _liquidityPools.remove(removedLiquidityPool_);
        emit LiquidityPoolRemoved(removedLiquidityPool_);
    }

    function isValidCaller(bytes32 queryHash_) public view override returns (bool) {
        return (_validCallerCodeHashes.contains(queryHash_));
    }

    function validCallers()
        external
        view
        override
        returns (bytes32[] memory validCallerHashes_)
    {
        return (_validCallerCodeHashes.values());
    }

    function addValidCaller(
        bytes32 newValidCallerHash_
    ) external override onlyOwnerOrFactory {
        _validCallerCodeHashes.add(newValidCallerHash_);
        emit ValidCallerAdded(newValidCallerHash_);
    }

    function removeValidCaller(
        bytes32 removedValidCallerHash_
    ) external override onlyOwnerOrFactory {
        // Remove this from the enumerated list:
        _validCallerCodeHashes.remove(removedValidCallerHash_);
        emit ValidCallerRemoved(removedValidCallerHash_);
    }

    function setProjectTaxRecipient(
        address projectTaxRecipient_
    ) external override onlyOwnerOrFactory {
        projectTaxRecipient = projectTaxRecipient_;
        emit ProjectTaxRecipientUpdated(projectTaxRecipient_);
    }

    function setSwapThresholdBasisPoints(
        uint16 swapThresholdBasisPoints_
    ) external override onlyOwnerOrFactory {
        uint256 oldswapThresholdBasisPoints = swapThresholdBasisPoints;
        swapThresholdBasisPoints = swapThresholdBasisPoints_;
        emit AutoSwapThresholdUpdated(
            oldswapThresholdBasisPoints,
            swapThresholdBasisPoints_
        );
    }

    function setProjectTaxRates(
        uint16 newProjectBuyTaxBasisPoints_,
        uint16 newProjectSellTaxBasisPoints_
    ) external override onlyOwnerOrFactory {
        uint16 oldBuyTaxBasisPoints = projectBuyTaxBasisPoints;
        uint16 oldSellTaxBasisPoints = projectSellTaxBasisPoints;

        projectBuyTaxBasisPoints = newProjectBuyTaxBasisPoints_;
        projectSellTaxBasisPoints = newProjectSellTaxBasisPoints_;

        emit ProjectTaxBasisPointsChanged(
            oldBuyTaxBasisPoints,
            newProjectBuyTaxBasisPoints_,
            oldSellTaxBasisPoints,
            newProjectSellTaxBasisPoints_
        );
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function totalBuyTaxBasisPoints() public view override returns (uint256) {
        return projectBuyTaxBasisPoints;
    }

    function totalSellTaxBasisPoints() public view override returns (uint256) {
        return projectSellTaxBasisPoints;
    }

    function balanceOf(
        address account
    ) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override(IERC20) returns (bool) {
        address owner = _msgSender();
        _transfer(
            owner,
            to,
            amount,
            (isLiquidityPool(owner) || isLiquidityPool(to))
        );
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(
            from,
            to,
            amount,
            (isLiquidityPool(from) || isLiquidityPool(to))
        );
        return true;
    }

    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < subtractedValue) {
            revert AllowanceDecreasedBelowZero();
        }
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount,
        bool applyTax
    ) internal virtual {
        _beforeTokenTransfer(from, to, amount);

        // Perform pre-tax validation (e.g. amount doesn't exceed balance, max txn amount)
        uint256 fromBalance = _pretaxValidationAndLimits(from, to, amount);

        // Perform autoswap if eligible
        _autoSwap(from, to);

        // Process taxes
        uint256 amountMinusTax = _taxProcessing(applyTax, to, from, amount);

        _balances[from] = fromBalance - amount;
        _balances[to] += amountMinusTax;

        emit Transfer(from, to, amountMinusTax);

        _afterTokenTransfer(from, to, amount);
    }

    function _pretaxValidationAndLimits(
        address from_,
        address to_,
        uint256 amount_
    ) internal view returns (uint256 fromBalance_) {
        // This can't be a transfer to the liquidity pool before the funding date
        // UNLESS the from address is this contract. This ensures that the initial
        // LP funding transaction is from this contract using the supply of tokens
        // designated for the LP pool, and therefore the initial price in the pool
        // is being set as expected.
        //
        // This protects from, for example, tokens from a team minted supply being
        // paired with ETH and added to the pool, setting the initial price, BEFORE
        // the initial liquidity is added through this contract.
        if (to_ == uniswapV2Pair && from_ != address(this) && fundedDate == 0) {
            revert InitialLiquidityNotYetAdded();
        }

        if (from_ == address(0)) {
            revert TransferFromZeroAddress();
        }

        if (to_ == address(0)) {
            revert TransferToZeroAddress();
        }

        fromBalance_ = _balances[from_];

        if (fromBalance_ < amount_) {
            revert TransferAmountExceedsBalance();
        }

        return (fromBalance_);
    }

    function _taxProcessing(
        bool applyTax_,
        address to_,
        address from_,
        uint256 sentAmount_
    ) internal returns (uint256 amountLessTax_) {
        amountLessTax_ = sentAmount_;
        unchecked {
            if (_tokenHasTax && applyTax_ && !_autoSwapInProgress) {
                uint256 tax;

                // on sell
                if (isLiquidityPool(to_) && totalSellTaxBasisPoints() > 0) {
                    if (projectSellTaxBasisPoints > 0) {
                        uint256 projectTax = ((sentAmount_ *
                            projectSellTaxBasisPoints) / BP_DENOM);
                        projectTaxPendingSwap += uint128(projectTax);
                        tax += projectTax;
                    }
                }
                // on buy
                else if (
                    isLiquidityPool(from_) && totalBuyTaxBasisPoints() > 0
                ) {
                    if (projectBuyTaxBasisPoints > 0) {
                        uint256 projectTax = ((sentAmount_ *
                            projectBuyTaxBasisPoints) / BP_DENOM);
                        projectTaxPendingSwap += uint128(projectTax);
                        tax += projectTax;
                    }
                }

                if (tax > 0) {
                    _balances[address(this)] += tax;
                    emit Transfer(from_, address(this), tax);
                    amountLessTax_ -= tax;
                }
            }
        }
        return (amountLessTax_);
    }

    function _autoSwap(address from_, address to_) internal {
        if (_tokenHasTax) {
            uint256 contractBalance = balanceOf(address(this));
            uint256 swapBalance = contractBalance;

            uint256 swapThresholdInTokens = (_totalSupply *
                swapThresholdBasisPoints) / BP_DENOM;

            if (
                _eligibleForSwap(from_, to_, swapBalance, swapThresholdInTokens)
            ) {
                // Store that a swap back is in progress:
                _autoSwapInProgress = true;
                // Check if we need to reduce the amount of tokens for this swap:
                if (
                    swapBalance >
                    swapThresholdInTokens * MAX_SWAP_THRESHOLD_MULTIPLE
                ) {
                    swapBalance =
                        swapThresholdInTokens *
                        MAX_SWAP_THRESHOLD_MULTIPLE;
                }
                // Perform the auto swap to pair token
                _swapTax(swapBalance, contractBalance);
                // Flag that the autoswap is complete:
                _autoSwapInProgress = false;
            }
        }
    }

    function _eligibleForSwap(
        address from_,
        address to_,
        uint256 taxBalance_,
        uint256 swapThresholdInTokens_
    ) internal view returns (bool) {
        return (taxBalance_ >= swapThresholdInTokens_ &&
            !_autoSwapInProgress &&
            !isLiquidityPool(from_) &&
            from_ != address(_uniswapRouter) &&
            to_ != address(_uniswapRouter));
    }

    function _swapTax(uint256 swapBalance_, uint256 contractBalance_) internal {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = pairToken;

        // Wrap external calls in try / catch to handle errors
        try
            _uniswapRouter
                .swapExactTokensForTokensSupportingFeeOnTransferTokens(
                    swapBalance_,
                    0,
                    path,
                    projectTaxRecipient,
                    block.timestamp + 600
                )
        {
            // We will not have swapped all tax tokens IF the amount was greater than the max auto swap.
            // We therefore cannot just set the pending swap counters to 0. Instead, in this scenario,
            // we must reduce them in proportion to the swap amount vs the remaining balance + swap
            // amount.
            //
            // For example:
            //  * swap Balance is 250
            //  * contract balance is 385.
            //  * projectTaxPendingSwap is 300
            //
            // The new total for the projectTaxPendingSwap is:
            //   = 300 - ((300 * 250) / 385)
            //   = 300 - 194
            //   = 106

            if (swapBalance_ < contractBalance_) {
                projectTaxPendingSwap -= uint128(
                    (projectTaxPendingSwap * swapBalance_) / contractBalance_
                );
            } else {
                projectTaxPendingSwap = 0;
            }
        } catch {
            // Dont allow a failed external call (in this case to uniswap) to stop a transfer.
            // Emit that this has occured and continue.
            emit ExternalCallError(5);
        }
    }

    /**
     * @dev distributeTaxTokens
     *
     * Allows the distribution of tax tokens to the designated recipient(s)
     *
     * As part of standard processing the tax token balance being above the threshold
     * will trigger an autoswap to ETH and distribution of this ETH to the designated
     * recipients. This is automatic and there is no need for user involvement.
     *
     * As part of this swap there are a number of calculations performed, particularly
     * if the tax balance is above MAX_SWAP_THRESHOLD_MULTIPLE.
     *
     * Testing indicates that these calculations are safe. But given the data / code
     * interactions it remains possible that some edge case set of scenarios may cause
     * an issue with these calculations.
     *
     * This method is therefore provided as a 'fallback' option to safely distribute
     * accumulated taxes from the contract, with a direct transfer of the ERC20 tokens
     * themselves.
     */
    function distributeTaxTokens() external override {
        if (projectTaxPendingSwap > 0) {
            uint256 projectDistribution = projectTaxPendingSwap;
            projectTaxPendingSwap = 0;
            _transfer(
                address(this),
                projectTaxRecipient,
                projectDistribution,
                false
            );
        }
    }

    /**
     * @dev function {withdrawETH} onlyOwnerOrFactory
     *
     * A withdraw function to allow ETH to be withdrawn by the manager
     *
     * This contract should never hold ETH. The only envisaged scenario where
     * it might hold ETH is a failed autoswap where the uniswap swap has completed,
     * the recipient of ETH reverts, the contract then wraps to WETH and the
     * wrap to WETH fails.
     *
     * This feels unlikely. But, for safety, we include this method.
     *
     * @param amount_ The amount to withdraw
     */
    function withdrawETH(uint256 amount_) external override onlyOwnerOrFactory {
        (bool success, ) = _msgSender().call{value: amount_}("");
        if (!success) {
            revert TransferFailed();
        }
    }

    function withdrawERC20(
        address token_,
        uint256 amount_
    ) external override onlyOwnerOrFactory {
        if (token_ == address(this)) {
            revert CannotWithdrawThisToken();
        }
        IERC20(token_).safeTransfer(_msgSender(), amount_);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        if (account == address(0)) {
            revert MintToZeroAddress();
        }

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply += uint128(amount);
        unchecked {
            // Overflow not possible: balance + amount is at most totalSupply + amount, which is checked above.
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);

        _afterTokenTransfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        if (account == address(0)) {
            revert BurnFromTheZeroAddress();
        }

        _beforeTokenTransfer(account, address(0), amount);

        uint256 accountBalance = _balances[account];
        if (accountBalance < amount) {
            revert BurnExceedsBalance();
        }

        unchecked {
            _balances[account] = accountBalance - amount;
            // Overflow not possible: amount <= accountBalance <= totalSupply.
            _totalSupply -= uint128(amount);
        }

        emit Transfer(account, address(0), amount);

        _afterTokenTransfer(account, address(0), amount);
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        if (owner == address(0)) {
            revert ApproveFromTheZeroAddress();
        }

        if (spender == address(0)) {
            revert ApproveToTheZeroAddress();
        }

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) {
                revert InsufficientAllowance();
            }

            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }

    function burn(uint256 value) public override {
        _burn(_msgSender(), value);
    }

    function burnFrom(address account, uint256 value) public override {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    receive() external payable {}
}
