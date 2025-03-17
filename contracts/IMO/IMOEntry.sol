// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./InternalExchange/InternalFactory.sol";
import "./InternalExchange/IInternalPair.sol";
import "./InternalExchange/InternalRouter.sol";
import "./InternalExchange/InternalToken.sol";
import "./ModelExchange/IModelFactory.sol";
import "../AI/AIModels.sol";

contract IMOEntry is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    using SafeERC20 for IERC20;

    address private _feeTo;

    InternalFactory public factory;
    InternalRouter public router;
    uint256 public initialSupply;
    uint256 public fee;
    uint256 public constant K = 3_000_000_000_000;
    uint256 public assetRate;
    uint256 public gradThreshold;
    uint256 public maxTx;
    address public modelFactory;
    address public uniswapRouter;
    AIModels public aiModels;
    struct Profile {
        address user;
        address[] tokens;
    }

    struct Token {
        address creator;
        address token;
        address pair;
        address modelToken;
        Data data;
        string description;
        bool trading;
        bool tradingOnUniswap;
        uint256 applicationId;
    }

    struct Data {
        address token;
        string name;
        string _modelName;
        string ticker;
        uint256 supply;
        uint256 price;
        uint256 marketCap;
        uint256 liquidity;
        uint256 volume;
        uint256 volume24H;
        uint256 prevPrice;
        uint256 lastUpdated;
    }

    mapping(address => Profile) public profile;
    address[] public profiles;

    mapping(address => Token) public tokenInfo;
    address[] public tokenInfos;

    mapping(string => address) public modelLaunched;

    event Launched(address indexed token, address indexed pair, uint tokenLenth);
    event Deployed(address indexed token, uint256 amount0, uint256 amount1);
    event Graduated(address indexed token, address modelToken);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address factory_,
        address router_,
        address feeTo_,
        uint256 fee_,
        uint256 initialSupply_,
        uint256 assetRate_,
        uint256 maxTx_,
        address modelFactory_,
        uint256 gradThreshold_,
        address uniswapRouter_,
        address aiModels_
    ) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        factory = InternalFactory(factory_);
        router = InternalRouter(router_);
        aiModels = AIModels(aiModels_);

        address assetToken = router.assetToken();

        _feeTo = feeTo_;
        fee = (fee_ * (10 ** IERC20Metadata(assetToken).decimals())) / 1000;

        initialSupply = initialSupply_;
        assetRate = assetRate_;
        maxTx = maxTx_;

        modelFactory = modelFactory_;
        gradThreshold = gradThreshold_;
        uniswapRouter = uniswapRouter_;
    }

    function _createUserProfile(address _user) internal returns (bool) {
        address[] memory _tokens;

        Profile memory _profile = Profile({user: _user, tokens: _tokens});

        profile[_user] = _profile;

        profiles.push(_user);

        return true;
    }

    function _checkIfProfileExists(address _user) internal view returns (bool) {
        return profile[_user].user == _user;
    }

    function _approval(
        address _spender,
        address _token,
        uint256 amount
    ) internal returns (bool) {
        IERC20(_token).approve(_spender, amount);

        return true;
    }

    function setInitialSupply(uint256 newSupply) public onlyOwner {
        initialSupply = newSupply;
    }

    function setGradThreshold(uint256 newThreshold) public onlyOwner {
        gradThreshold = newThreshold;
    }

    function setFee(uint256 newFee, address newFeeTo) public onlyOwner {
        fee = newFee;
        _feeTo = newFeeTo;
    }

    function setMaxTx(uint256 maxTx_) public onlyOwner {
        maxTx = maxTx_;
    }

    function setAssetRate(uint256 newRate) public onlyOwner {
        require(newRate > 0, "Rate err");

        assetRate = newRate;
    }

    function getUserTokens(
        address account
    ) public view returns (address[] memory) {
        require(_checkIfProfileExists(account), "User Profile dose not exist.");

        Profile memory _profile = profile[account];

        return _profile.tokens;
    }

    function launch(
        string calldata _modelName,
        string calldata _ticker,// token alias name
        string calldata desc,
        uint256 purchaseAmount
    ) public nonReentrant returns (address, address, uint) {
        require(
            purchaseAmount > fee,
            "Purchase amount must be greater than fee"
        );

        require(aiModels.modelOwns(_modelName) == msg.sender, "Model is not exist or model not your's");
        require(modelLaunched[_modelName] == address(0), "Model has been launched");
        
        address assetToken = router.assetToken();
        require(
            IERC20(assetToken).balanceOf(msg.sender) >= purchaseAmount,
            "Insufficient amount"
        );

        uint256 initialPurchase = (purchaseAmount - fee);
        IERC20(assetToken).safeTransferFrom(msg.sender, _feeTo, fee);
        IERC20(assetToken).safeTransferFrom(
            msg.sender,
            address(this),
            initialPurchase
        );

        string memory tokenName = string(abi.encodePacked("internal_",  _modelName));
        InternalToken token = new InternalToken(tokenName, _ticker, initialSupply, maxTx, uniswapRouter);
        uint256 supply = token.totalSupply();

        address _pair = factory.createPair(address(token), assetToken);

        bool approved = _approval(address(router), address(token), supply);
        require(approved, "Not approved");

        uint256 k = ((K * 10000) / assetRate);
        uint256 liquidity;
        
        if (IERC20Metadata(assetToken).decimals() >=12) {
            liquidity = (((k * (10000 * 10 ** IERC20Metadata(assetToken).decimals())) / supply) * 1 ether) / 10000;
        } else {
            liquidity = (((k * (10000 * 10 ** IERC20Metadata(assetToken).decimals())) * 1 ether / supply)) / 10000;
        }
        

        router.addInitialLiquidity(address(token), supply, liquidity);

        Data memory _data = Data({
            token: address(token),
            name: tokenName,
            _modelName: _modelName,
            ticker: _ticker,
            supply: supply,
            price: supply / liquidity,
            marketCap: liquidity,
            liquidity: liquidity * 2,
            volume: 0,
            volume24H: 0,
            prevPrice: supply / liquidity,
            lastUpdated: block.timestamp
        });
        Token memory tmpToken = Token({
            creator: msg.sender,
            token: address(token),
            modelToken: address(0),
            pair: _pair,
            data: _data,
            description: desc,
            trading: true, // Can only be traded once creator made initial purchase
            tradingOnUniswap: false,
            applicationId: 0
        });
        tokenInfo[address(token)] = tmpToken;
        tokenInfos.push(address(token));

        bool exists = _checkIfProfileExists(msg.sender);

        if (exists) {
            Profile storage _profile = profile[msg.sender];

            _profile.tokens.push(address(token));
        } else {
            bool created = _createUserProfile(msg.sender);

            if (created) {
                Profile storage _profile = profile[msg.sender];

                _profile.tokens.push(address(token));
            }
        }

        emit Launched(address(token), _pair, tokenInfos.length);
        modelLaunched[_modelName] = address(token);

        // Make initial purchase
        IERC20(assetToken).approve(address(router), initialPurchase);
        router.buy(initialPurchase, address(token), address(this));
        token.transfer(msg.sender, token.balanceOf(address(this)));
        return (address(token), _pair, tokenInfos.length);
    }

    function sell(
        uint256 amountIn,
        address tokenAddress
    ) public returns (bool) {
        Token storage specifiedToken = tokenInfo[tokenAddress];
        require(specifiedToken.trading, "Token not trading");

        address pairAddress = factory.getPair(
            tokenAddress,
            router.assetToken()
        );

        IInternalPair pair = IInternalPair(pairAddress);

        (uint256 reserveA, uint256 reserveB) = pair.getReserves();

        (uint256 amount0In, uint256 amount1Out) = router.sell(
            amountIn,
            tokenAddress,
            msg.sender
        );

        uint256 newReserveA = reserveA + amount0In;
        uint256 newReserveB = reserveB - amount1Out;
        uint256 duration = block.timestamp -
            specifiedToken.data.lastUpdated;

        uint256 liquidity = newReserveB * 2;
        uint256 mCap = (specifiedToken.data.supply * newReserveB) /
            newReserveA;
        uint256 price = newReserveA / newReserveB;
        uint256 volume = duration > 86400
            ? amount1Out
            : specifiedToken.data.volume24H + amount1Out;
        uint256 prevPrice = duration > 86400
            ? specifiedToken.data.price
            : specifiedToken.data.prevPrice;

        specifiedToken.data.price = price;
        specifiedToken.data.marketCap = mCap;
        specifiedToken.data.liquidity = liquidity;
        specifiedToken.data.volume =
            specifiedToken.data.volume +
            amount1Out;
        specifiedToken.data.volume24H = volume;
        specifiedToken.data.prevPrice = prevPrice;

        if (duration > 86400) {
            specifiedToken.data.lastUpdated = block.timestamp;
        }

        return true;
    }

    function buy(
        uint256 amountIn,
        address tokenAddress
    ) public payable returns (bool) {
        Token storage specifiedToken = tokenInfo[tokenAddress];
        require(specifiedToken.trading, "Token not trading");

        address pairAddress = factory.getPair(
            tokenAddress,
            router.assetToken()
        );

        IInternalPair pair = IInternalPair(pairAddress);

        (uint256 reserveA, uint256 reserveB) = pair.getReserves();

        (uint256 amount1In, uint256 amount0Out) = router.buy(
            amountIn,
            tokenAddress,
            msg.sender
        );

        uint256 newReserveA = reserveA - amount0Out;
        uint256 newReserveB = reserveB + amount1In;
        uint256 duration = block.timestamp -
            specifiedToken.data.lastUpdated;

        uint256 liquidity = newReserveB * 2;
        uint256 mCap = (specifiedToken.data.supply * newReserveB) /
            newReserveA;
        uint256 price = newReserveA / newReserveB;
        uint256 volume = duration > 86400
            ? amount1In
            : specifiedToken.data.volume24H + amount1In;
        uint256 _price = duration > 86400
            ? specifiedToken.data.price
            : specifiedToken.data.prevPrice;

        specifiedToken.data.price = price;
        specifiedToken.data.marketCap = mCap;
        specifiedToken.data.liquidity = liquidity;
        specifiedToken.data.volume =
            specifiedToken.data.volume +
            amount1In;
        specifiedToken.data.volume24H = volume;
        specifiedToken.data.prevPrice = _price;

        if (duration > 86400) {
            specifiedToken.data.lastUpdated = block.timestamp;
        }

        if (newReserveA <= gradThreshold && specifiedToken.trading) {
            _openTradingOnUniswap(tokenAddress);
        }

        return true;
    }

    function _openTradingOnUniswap(address tokenAddress) internal {
        InternalToken token_ = InternalToken(tokenAddress);

        Token storage _token = tokenInfo[tokenAddress];

        require(
            _token.trading && !_token.tradingOnUniswap,
            "trading is already open"
        );

        _token.trading = false;
        _token.tradingOnUniswap = true;

        // Transfer asset tokens to bonding contract
        address pairAddress = factory.getPair(
            tokenAddress,
            router.assetToken()
        );

        IInternalPair pair = IInternalPair(pairAddress);

        uint256 assetBalance = pair.assetBalance();
        uint256 tokenBalance = pair.balance();

        router.graduate(tokenAddress);

        IERC20(router.assetToken()).approve(modelFactory, assetBalance);
        uint256 id = IModelFactory(modelFactory).initFromBondingCurve(
            string(abi.encodePacked("models_", _token.data._modelName)),
            _token.data.ticker,
            assetBalance,
            _token.creator
        );

        _token.applicationId = id;

        address modelToken = IModelFactory(modelFactory)
            .executeBondingCurveApplication(
                id,
                _token.data.supply / (10 ** token_.decimals()),
                tokenBalance / (10 ** token_.decimals()),
                pairAddress
            );
        _token.modelToken = modelToken;

        router.approval(
            pairAddress,
            modelToken,
            address(this),
            IERC20(modelToken).balanceOf(pairAddress)
        );

        token_.burnFrom(pairAddress, tokenBalance);

        emit Graduated(tokenAddress, modelToken);
    }

    function unwrapToken(
        address srcTokenAddress,
        address[] memory accounts
    ) public {
        Token memory info = tokenInfo[srcTokenAddress];
        require(info.tradingOnUniswap, "Token is not graduated yet");

        InternalToken token = InternalToken(srcTokenAddress);
        IERC20 modelToken = IERC20(info.modelToken);
        address pairAddress = factory.getPair(
            srcTokenAddress,
            router.assetToken()
        );

        for (uint256 i = 0; i < accounts.length; i++) {
            address acc = accounts[i];
            uint256 balance = token.balanceOf(acc);
            if (balance > 0) {
                token.burnFrom(acc, balance);
                modelToken.transferFrom(pairAddress, acc, balance);
            }
        }
    }
}