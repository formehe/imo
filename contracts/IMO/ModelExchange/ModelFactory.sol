// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "./IModelFactory.sol";
import "./IModelToken.sol";
import "./IModelLockToken.sol";

contract ModelFactory is
    IModelFactory,
    Initializable,
    AccessControl,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    uint256 public nextId;
    address public tokenImplementation;
    address public lockTokenImplemention;

    address[] public allTokens;

    address public assetToken; // Base currency
    uint256 public maturityDuration; // Staking duration in seconds for initial LP. eg: 10years

    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE"); // Able to withdraw and execute applications

    event NewPersona(
        address token,
        address lp
    );
    event NewApplication(uint256 id);

    enum ApplicationStatus {
        Active,
        Executed,
        Withdrawn
    }

    struct Application {
        string name;
        string symbol;
        string tokenURI;
        ApplicationStatus status;
        uint256 withdrawableAmount;
        address proposer;
        uint256 proposalEndBlock;
        address token;
        address lp;
        address lockToken;
    }

    mapping(uint256 => Application) private _applications;

    event ImplContractsUpdated(address token, address dao);

    bool internal locked;

    modifier noReentrant() {
        require(!locked, "cannot reenter");
        locked = true;
        _;
        locked = false;
    }

    ///////////////////////////////////////////////////////////////
    // V2 Storage
    ///////////////////////////////////////////////////////////////
    address[] public allTradingTokens;
    address private _uniswapRouter;
    address private _minter; // Unused
    address private _tokenAdmin;

    // Default agent token params
    uint256 private _projectBuyTaxBasisPoints;
    uint256 private _projectSellTaxBasisPoints;
    uint256 private _taxSwapThresholdBasisPoints;

    bytes32 public constant BONDING_ROLE = keccak256("BONDING_ROLE");

    ///////////////////////////////////////////////////////////////

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address tokenImplementation_,
        address lockTokenImplemention_,
        address assetToken_,
        uint256 nextId_
    ) public initializer {
        __Pausable_init();

        tokenImplementation = tokenImplementation_;
        lockTokenImplemention = lockTokenImplemention_;
        assetToken = assetToken_;
        nextId = nextId_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function getApplication(
        uint256 proposalId
    ) public view returns (Application memory) {
        return _applications[proposalId];
    }

    function withdraw(uint256 id) public override noReentrant {
        Application storage application = _applications[id];

        require(
            msg.sender == application.proposer ||
                hasRole(WITHDRAW_ROLE, msg.sender),
            "Not proposer"
        );

        require(
            application.status == ApplicationStatus.Active,
            "Application is not active"
        );

        require(
            block.number > application.proposalEndBlock,
            "Application is not matured yet"
        );

        uint256 withdrawableAmount = application.withdrawableAmount;

        application.withdrawableAmount = 0;
        application.status = ApplicationStatus.Withdrawn;

        IERC20(assetToken).safeTransfer(
            application.proposer,
            withdrawableAmount
        );
    }

    function _executeApplication(
        uint256 id,
        bytes memory tokenSupplyParams_,
        bool canStake
    ) internal {
        require(
            _applications[id].status == ApplicationStatus.Active,
            "Application is not active"
        );

        require(_tokenAdmin != address(0), "Token admin not set");

        Application storage application = _applications[id];

        uint256 initialAmount = application.withdrawableAmount;
        application.withdrawableAmount = 0;
        application.status = ApplicationStatus.Executed;

        // step1
        bytes memory tokenTaxParams = abi.encode(
            _projectBuyTaxBasisPoints,
            _projectSellTaxBasisPoints,
            _taxSwapThresholdBasisPoints,
            application.proposer
        );

        address token = _createNewModelToken(
            application.name,
            application.symbol,
            tokenSupplyParams_,
            tokenTaxParams
        );

        // step2
        address lp = IModelToken(token).liquidityPools()[0];
        IERC20(assetToken).safeTransfer(token, initialAmount);
        IModelToken(token).addInitialLiquidity(address(this));

        // step3
        address lockToken = _createNewModelLockToken(
            string.concat("Staked ", application.name),
            string.concat("s", application.symbol),
            lp,
            application.proposer,
            canStake
        );

        // step4
        IERC20(lp).approve(lockToken, type(uint256).max);
        IModelLockToken(lockToken).stake(
            IERC20(lp).balanceOf(address(this)),
            application.proposer
        );

        // step5
        application.token = token;
        application.lockToken = lockToken;
        application.lp = lp;

        emit NewPersona(token, lp);
    }

    function _createNewModelToken(
        string memory name,
        string memory symbol,
        bytes memory tokenSupplyParams_,
        bytes memory tokenTaxParams_
    ) internal returns (address instance) {
        instance = Clones.clone(tokenImplementation);
        IModelToken(instance).initialize(
            [_tokenAdmin, _uniswapRouter, assetToken],
            abi.encode(name, symbol),
            tokenSupplyParams_,
            tokenTaxParams_
        );

        allTradingTokens.push(instance);
        return instance;
    }

    function _createNewModelLockToken(
        string memory name,
        string memory symbol,
        address stakingAsset,
        address founder,
        bool canStake
    ) internal returns (address instance) {
        instance = Clones.clone(lockTokenImplemention);
        IModelLockToken(instance).initialize(
            name,
            symbol,
            founder,
            stakingAsset,
            block.timestamp + maturityDuration,
            canStake
        );

        allTokens.push(instance);
        return instance;
    }

    function setImplementations(
        address token
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenImplementation = token;
    }

    function setMaturityDuration(
        uint256 newDuration
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        maturityDuration = newDuration;
    }

    function setUniswapRouter(
        address router
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _uniswapRouter = router;
    }

    function setTokenAdmin(
        address newTokenAdmin
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _tokenAdmin = newTokenAdmin;
    }

    function setTokenTaxParams(
        uint256 projectBuyTaxBasisPoints,
        uint256 projectSellTaxBasisPoints,
        uint256 taxSwapThresholdBasisPoints
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _projectBuyTaxBasisPoints = projectBuyTaxBasisPoints;
        _projectSellTaxBasisPoints = projectSellTaxBasisPoints;
        _taxSwapThresholdBasisPoints = taxSwapThresholdBasisPoints;
    }

    function setAssetToken(
        address newToken
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        assetToken = newToken;
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _msgSender()
        internal
        view
        override(Context, ContextUpgradeable)
        returns (address sender)
    {
        sender = ContextUpgradeable._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ContextUpgradeable)
        returns (bytes calldata)
    {
        return ContextUpgradeable._msgData();
    }

    function initFromBondingCurve(
        string memory name,
        string memory symbol,
        uint256 applicationThreshold_,
        address creator
    ) public override whenNotPaused onlyRole(BONDING_ROLE) returns (uint256) {
        address sender = _msgSender();
        require(
            IERC20(assetToken).balanceOf(sender) >= applicationThreshold_,
            "Insufficient asset token"
        );
        require(
            IERC20(assetToken).allowance(sender, address(this)) >=
                applicationThreshold_,
            "Insufficient asset token allowance"
        );

        IERC20(assetToken).safeTransferFrom(
            sender,
            address(this),
            applicationThreshold_
        );

        uint256 id = nextId++;
        uint256 proposalEndBlock = block.number; // No longer required in v2
        Application memory application;
        application.name = name;
        application.symbol = symbol;
        application.tokenURI = "";
        application.status = ApplicationStatus.Active;
        application.withdrawableAmount = applicationThreshold_;
        application.proposer = creator;
        application.proposalEndBlock = proposalEndBlock;
        
        _applications[id] = application;
        emit NewApplication(id);

        return id;
    }

    function executeBondingCurveApplication(
        uint256 id,
        uint256 totalSupply,
        uint256 lpSupply,
        address vault
    ) public override onlyRole(BONDING_ROLE) noReentrant returns (address) {
        bytes memory tokenSupplyParams = abi.encode(
            totalSupply,
            lpSupply,
            totalSupply - lpSupply,
            totalSupply,
            totalSupply,
            0,
            vault
        );

        _executeApplication(id, tokenSupplyParams, true);

        return _applications[id].token;
    }

    function renounceRole(bytes32 /*role*/, address /*account*/) public pure override {
        require(false, "not support");
    }
}