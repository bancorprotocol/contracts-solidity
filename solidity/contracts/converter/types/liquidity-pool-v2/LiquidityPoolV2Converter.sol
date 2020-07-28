pragma solidity 0.4.26;
import "./PoolTokensContainer.sol";
import "./LiquidityPoolV2ConverterCustomFactory.sol";
import "../../LiquidityPoolConverter.sol";
import "../../interfaces/IConverterFactory.sol";
import "../../../utility/interfaces/IPriceOracle.sol";

/**
  * @dev Liquidity Pool v2 Converter
  *
  * The liquidity pool v2 converter is a specialized version of a converter that uses
  * price oracles to rebalance the reserve weights in such a way that the primary token
  * balance always strives to match the staked balance.
  *
  * This type of liquidity pool always has 2 reserves and the reserve weights are dynamic.
*/
contract LiquidityPoolV2Converter is LiquidityPoolConverter {
    uint8 internal constant AMPLIFICATION_FACTOR = 20;  // factor to use for conversion calculations (reduces slippage)

    struct Fraction {
        uint256 n;  // numerator
        uint256 d;  // denominator
    }

    IPriceOracle public priceOracle;                                // external price oracle
    IERC20Token public primaryReserveToken;                         // primary reserve in the pool
    IERC20Token public secondaryReserveToken;                       // secondary reserve in the pool (cache)
    mapping (address => uint256) private stakedBalances;            // tracks the staked liquidity in the pool plus the fees
    mapping (address => ISmartToken) private reservesToPoolTokens;  // maps each reserve to its pool token
    mapping (address => IERC20Token) private poolTokensToReserves;  // maps each pool token to its reserve

    // the period of time it takes to the last rate to fully take effect
    uint256 private constant RATE_PROPAGATION_PERIOD = 10 minutes;

    Fraction public referenceRate;              // reference rate from the previous block(s) of 1 primary token in secondary tokens
    uint256 public referenceRateUpdateTime;     // last time when the reference rate was updated (in seconds)

    Fraction public lastConversionRate;         // last conversion rate of 1 primary token in secondary tokens

    // used by the temp liquidity limit mechanism during the pilot
    mapping (address => uint256) public maxStakedBalances;
    bool public maxStakedBalanceEnabled = true;

    /**
      * @dev initializes a new LiquidityPoolV2Converter instance
      *
      * @param  _poolTokensContainer    pool tokens container governed by the converter
      * @param  _registry               address of a contract registry contract
      * @param  _maxConversionFee       maximum conversion fee, represented in ppm
    */
    constructor(IPoolTokensContainer _poolTokensContainer, IContractRegistry _registry, uint32 _maxConversionFee)
        public LiquidityPoolConverter(_poolTokensContainer, _registry, _maxConversionFee)
    {
    }

    // ensures the address is a pool token
    modifier validPoolToken(ISmartToken _address) {
        _validPoolToken(_address);
        _;
    }

    // error message binary size optimization
    function _validPoolToken(ISmartToken _address) internal view {
        require(poolTokensToReserves[_address] != address(0), "ERR_INVALID_POOL_TOKEN");
    }

    /**
      * @dev returns the converter type
      *
      * @return see the converter types in the the main contract doc
    */
    function converterType() public pure returns (uint16) {
        return 2;
    }

    /**
      * @dev returns true if the converter is active, false otherwise
    */
    function isActive() public view returns (bool) {
        return super.isActive() && priceOracle != address(0);
    }

    /**
      * @dev sets the pool's primary reserve token / price oracles and activates the pool
      * each oracle must be able to provide the rate for each reserve token
      * note that the oracle must be whitelisted prior to the call
      * can only be called by the owner while the pool is inactive
      *
      * @param _primaryReserveToken     address of the pool's primary reserve token
      * @param _primaryReserveOracle    address of a chainlink price oracle for the primary reserve token
      * @param _secondaryReserveOracle  address of a chainlink price oracle for the secondary reserve token
    */
    function activate(IERC20Token _primaryReserveToken, IChainlinkPriceOracle _primaryReserveOracle, IChainlinkPriceOracle _secondaryReserveOracle)
        public
        inactive
        ownerOnly
        validReserve(_primaryReserveToken)
        notThis(_primaryReserveOracle)
        notThis(_secondaryReserveOracle)
        validAddress(_primaryReserveOracle)
        validAddress(_secondaryReserveOracle)
    {
        // validate oracles
        IWhitelist oracleWhitelist = IWhitelist(addressOf(CHAINLINK_ORACLE_WHITELIST));
        require(oracleWhitelist.isWhitelisted(_primaryReserveOracle), "ERR_INVALID_ORACLE");
        require(oracleWhitelist.isWhitelisted(_secondaryReserveOracle), "ERR_INVALID_ORACLE");

        // create the converter's pool tokens if they don't already exist
        createPoolTokens();

        // sets the primary & secondary reserve tokens
        primaryReserveToken = _primaryReserveToken;
        if (_primaryReserveToken == reserveTokens[0])
            secondaryReserveToken = reserveTokens[1];
        else
            secondaryReserveToken = reserveTokens[0];

        // creates and initalizes the price oracle and sets initial rates
        LiquidityPoolV2ConverterCustomFactory customFactory =
            LiquidityPoolV2ConverterCustomFactory(IConverterFactory(addressOf(CONVERTER_FACTORY)).customFactories(converterType()));
        priceOracle = customFactory.createPriceOracle(_primaryReserveToken, secondaryReserveToken, _primaryReserveOracle, _secondaryReserveOracle);

        (referenceRate.n, referenceRate.d) = priceOracle.latestRate(primaryReserveToken, secondaryReserveToken);
        lastConversionRate = referenceRate;

        referenceRateUpdateTime = time();

        // if we are upgrading from an older converter, make sure that reserve balances are in-sync and rebalance
        uint256 primaryReserveStakedBalance = reserveStakedBalance(primaryReserveToken);
        uint256 primaryReserveBalance = reserveBalance(primaryReserveToken);
        uint256 secondaryReserveBalance = reserveBalance(secondaryReserveToken);

        if (primaryReserveStakedBalance == primaryReserveBalance) {
            if (primaryReserveStakedBalance > 0 || secondaryReserveBalance > 0) {
                rebalance();
            }
        }
        else if (primaryReserveStakedBalance > 0 && primaryReserveBalance > 0 && secondaryReserveBalance > 0) {
            rebalance();
        }

        emit Activation(anchor, true);
    }

    /**
      * @dev returns the staked balance of a given reserve token
      *
      * @param _reserveToken    reserve token address
      *
      * @return staked balance
    */
    function reserveStakedBalance(IERC20Token _reserveToken)
        public
        view
        validReserve(_reserveToken)
        returns (uint256)
    {
        return stakedBalances[_reserveToken];
    }

    /**
      * @dev returns the amplified balance of a given reserve token
      *
      * @param _reserveToken   reserve token address
      *
      * @return amplified balance
    */
    function reserveAmplifiedBalance(IERC20Token _reserveToken)
        public
        view
        validReserve(_reserveToken)
        returns (uint256)
    {
        return stakedBalances[_reserveToken].mul(AMPLIFICATION_FACTOR - 1).add(reserveBalance(_reserveToken));
    }

    /**
      * @dev sets the reserve's staked balance
      * can only be called by the upgrader contract while the upgrader is the owner
      *
      * @param _reserveToken    reserve token address
      * @param _balance         new reserve staked balance
    */
    function setReserveStakedBalance(IERC20Token _reserveToken, uint256 _balance)
        public
        ownerOnly
        only(CONVERTER_UPGRADER)
        validReserve(_reserveToken)
    {
        stakedBalances[_reserveToken] = _balance;
    }

    /**
      * @dev sets the max staked balance for both reserves
      * available as a temporary mechanism during the pilot
      * can only be called by the owner
      *
      * @param _reserve1MaxStakedBalance    max staked balance for reserve 1
      * @param _reserve2MaxStakedBalance    max staked balance for reserve 2
    */
    function setMaxStakedBalances(uint256 _reserve1MaxStakedBalance, uint256 _reserve2MaxStakedBalance) public ownerOnly {
        maxStakedBalances[reserveTokens[0]] = _reserve1MaxStakedBalance;
        maxStakedBalances[reserveTokens[1]] = _reserve2MaxStakedBalance;
    }

    /**
      * @dev disables the max staked balance mechanism
      * available as a temporary mechanism during the pilot
      * once disabled, it cannot be re-enabled
      * can only be called by the owner
    */
    function disableMaxStakedBalances() public ownerOnly {
        maxStakedBalanceEnabled = false;
    }

    /**
      * @dev returns the pool token address by the reserve token address
      *
      * @param _reserveToken    reserve token address
      *
      * @return pool token address
    */
    function poolToken(IERC20Token _reserveToken) public view returns (ISmartToken) {
        return reservesToPoolTokens[_reserveToken];
    }

    /**
      * @dev returns the maximum number of pool tokens that can currently be liquidated
      *
      * @param _poolToken   address of the pool token
      *
      * @return liquidation limit
    */
    function liquidationLimit(ISmartToken _poolToken) public view returns (uint256) {
        // get the pool token supply
        uint256 poolTokenSupply = _poolToken.totalSupply();

        // get the reserve token associated with the pool token and its balance / staked balance
        IERC20Token reserveToken = poolTokensToReserves[_poolToken];
        uint256 balance = reserveBalance(reserveToken);
        uint256 stakedBalance = stakedBalances[reserveToken];

        // calculate the amount that's available for liquidation
        return balance.mul(poolTokenSupply).div(stakedBalance);
    }

    /**
      * @dev defines a new reserve token for the converter
      * can only be called by the owner while the converter is inactive and
      * 2 reserves aren't defined yet
      *
      * @param _token   address of the reserve token
      * @param _weight  reserve weight, represented in ppm, 1-1000000
    */
    function addReserve(IERC20Token _token, uint32 _weight) public {
        // verify that the converter doesn't have 2 reserves yet
        require(reserveTokenCount() < 2, "ERR_INVALID_RESERVE_COUNT");
        super.addReserve(_token, _weight);
    }

    /**
      * @dev returns the effective rate of 1 primary token in secondary tokens
      *
      * @return rate of 1 primary token in secondary tokens (numerator)
      * @return rate of 1 primary token in secondary tokens (denominator)
    */
    function effectiveTokensRate() public view returns (uint256, uint256) {
        Fraction memory rate = _effectiveTokensRate();
        return (rate.n, rate.d);
    }

    /**
      * @dev returns the effective reserve tokens weights
      *
      * @return reserve1 weight
      * @return reserve2 weight
    */
    function effectiveReserveWeights() public view returns (uint256, uint256) {
        Fraction memory rate = _effectiveTokensRate();
        (uint32 primaryReserveWeight, uint32 secondaryReserveWeight) = effectiveReserveWeights(rate);

        if (primaryReserveToken == reserveTokens[0]) {
            return (primaryReserveWeight, secondaryReserveWeight);
        }

        return (secondaryReserveWeight, primaryReserveWeight);
    }

    /**
      * @dev returns the expected target amount of converting one reserve to another along with the fee
      *
      * @param _sourceToken contract address of the source reserve token
      * @param _targetToken contract address of the target reserve token
      * @param _amount      amount of tokens received from the user
      *
      * @return expected target amount
      * @return expected fee
    */
    function targetAmountAndFee(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount)
        public
        view
        active
        returns (uint256, uint256)
    {
        // validate input
        // not using the `validReserve` modifier to circumvent `stack too deep` compiler error
        _validReserve(_sourceToken);
        _validReserve(_targetToken);
        require(_sourceToken != _targetToken, "ERR_SAME_SOURCE_TARGET");

        // check if rebalance is required (some of this code is duplicated for gas optimization)
        uint32 sourceTokenWeight;
        uint32 targetTokenWeight;

        // if the rate was already checked in this block, use the current weights.
        // otherwise, get the new weights
        Fraction memory rate;
        if (referenceRateUpdateTime == time()) {
            rate = referenceRate;
            sourceTokenWeight = reserves[_sourceToken].weight;
            targetTokenWeight = reserves[_targetToken].weight;
        }
        else {
            // get the new rate / reserve weights
            rate = _effectiveTokensRate();
            (uint32 primaryReserveWeight, uint32 secondaryReserveWeight) = effectiveReserveWeights(rate);

            if (_sourceToken == primaryReserveToken) {
                sourceTokenWeight = primaryReserveWeight;
                targetTokenWeight = secondaryReserveWeight;
            }
            else {
                sourceTokenWeight = secondaryReserveWeight;
                targetTokenWeight = primaryReserveWeight;
            }
        }

        // return the target amount and the adjusted fee using the updated reserve weights
        (uint256 targetAmount, , uint256 fee) = targetAmountAndFees(_sourceToken, _targetToken, sourceTokenWeight, targetTokenWeight, rate, _amount);
        return (targetAmount, fee);
    }

    /**
      * @dev converts a specific amount of source tokens to target tokens
      * can only be called by the bancor network contract
      *
      * @param _sourceToken source ERC20 token
      * @param _targetToken target ERC20 token
      * @param _amount      amount of tokens to convert (in units of the source token)
      * @param _trader      address of the caller who executed the conversion
      * @param _beneficiary wallet to receive the conversion result
      *
      * @return amount of tokens received (in units of the target token)
    */
    function doConvert(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount, address _trader, address _beneficiary)
        internal
        active
        validReserve(_sourceToken)
        validReserve(_targetToken)
        returns (uint256)
    {
        // convert the amount and return the resulted amount and fee
        (uint256 amount, uint256 fee) = doConvert(_sourceToken, _targetToken, _amount);

        // transfer funds to the beneficiary in the to reserve token
        if (_targetToken == ETH_RESERVE_ADDRESS) {
            _beneficiary.transfer(amount);
        }
        else {
            safeTransfer(_targetToken, _beneficiary, amount);
        }

        // dispatch the conversion event
        dispatchConversionEvent(_sourceToken, _targetToken, _trader, _amount, amount, fee);

        // dispatch rate updates for the pool / reserve tokens
        dispatchRateEvents(_sourceToken, _targetToken, reserves[_sourceToken].weight, reserves[_targetToken].weight);

        // return the conversion result amount
        return amount;
    }

    /**
      * @dev converts a specific amount of source tokens to target tokens
      * can only be called by the bancor network contract
      *
      * @param _sourceToken source ERC20 token
      * @param _targetToken target ERC20 token
      * @param _amount      amount of tokens to convert (in units of the source token)
      *
      * @return amount of tokens received (in units of the target token)
      * @return expected fee
    */
    function doConvert(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount) private returns (uint256, uint256) {
        // check if the rate has changed and rebalance the pool if needed (once in a block)
        (bool rateUpdated, Fraction memory rate) = handleRateChange();

        // get expected target amount and fees
        (uint256 amount, uint256 normalFee, uint256 adjustedFee) = targetAmountAndFees(_sourceToken, _targetToken, 0, 0, rate, _amount);

        // ensure that the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the trade won't deplete the reserve balance
        uint256 targetReserveBalance = reserveBalance(_targetToken);
        require(amount < targetReserveBalance, "ERR_TARGET_AMOUNT_TOO_HIGH");

        // ensure that the input amount was already deposited
        if (_sourceToken == ETH_RESERVE_ADDRESS)
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        else
            require(msg.value == 0 && _sourceToken.balanceOf(this).sub(reserveBalance(_sourceToken)) >= _amount, "ERR_INVALID_AMOUNT");

        // sync the reserve balances
        syncReserveBalance(_sourceToken);
        reserves[_targetToken].balance = targetReserveBalance.sub(amount);

        // update the target staked balance with the fee
        stakedBalances[_targetToken] = stakedBalances[_targetToken].add(normalFee);

        // update the last conversion rate
        if (rateUpdated) {
            lastConversionRate = tokensRate(primaryReserveToken, secondaryReserveToken, 0, 0);
        }

        return (amount, adjustedFee);
    }

    /**
      * @dev increases the pool's liquidity and mints new shares in the pool to the caller
      *
      * @param _reserveToken    address of the reserve token to add liquidity to
      * @param _amount          amount of liquidity to add
      * @param _minReturn       minimum return-amount of pool tokens
      *
      * @return amount of pool tokens minted
    */
    function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
        public
        payable
        protected
        active
        validReserve(_reserveToken)
        greaterThanZero(_amount)
        greaterThanZero(_minReturn)
        returns (uint256)
    {
        // verify that msg.value is identical to the provided amount for ETH reserve, or 0 otherwise
        require(_reserveToken == ETH_RESERVE_ADDRESS ? msg.value == _amount : msg.value == 0, "ERR_ETH_AMOUNT_MISMATCH");

        // sync the reserve balances just in case
        syncReserveBalances();

        // for ETH reserve, deduct the amount that was just synced (since it's already in the converter)
        if (_reserveToken == ETH_RESERVE_ADDRESS)
            reserves[ETH_RESERVE_ADDRESS].balance = reserves[ETH_RESERVE_ADDRESS].balance.sub(msg.value);

        // get the reserve staked balance before adding the liquidity to it
        uint256 initialStakedBalance = stakedBalances[_reserveToken];

        // during the pilot, ensure that the new staked balance isn't greater than the max limit
        if (maxStakedBalanceEnabled) {
            require(maxStakedBalances[_reserveToken] == 0 || initialStakedBalance.add(_amount) <= maxStakedBalances[_reserveToken], "ERR_MAX_STAKED_BALANCE_REACHED");
        }

        // get the pool token associated with the reserve and its supply
        ISmartToken reservePoolToken = reservesToPoolTokens[_reserveToken];
        uint256 poolTokenSupply = reservePoolToken.totalSupply();

        // for non ETH reserve, transfer the funds from the user to the pool
        if (_reserveToken != ETH_RESERVE_ADDRESS)
            safeTransferFrom(_reserveToken, msg.sender, this, _amount);

        // sync the reserve balance / staked balance
        reserves[_reserveToken].balance = reserves[_reserveToken].balance.add(_amount);
        stakedBalances[_reserveToken] = initialStakedBalance.add(_amount);

        // calculate how many pool tokens to mint
        // for an empty pool, the price is 1:1, otherwise the price is based on the ratio
        // between the pool token supply and the staked balance
        uint256 poolTokenAmount = 0;
        if (initialStakedBalance == 0 || poolTokenSupply == 0)
            poolTokenAmount = _amount;
        else
            poolTokenAmount = _amount.mul(poolTokenSupply).div(initialStakedBalance);
        require(poolTokenAmount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // mint new pool tokens to the caller
        IPoolTokensContainer(anchor).mint(reservePoolToken, msg.sender, poolTokenAmount);

        // rebalance the pool's reserve weights
        rebalance();

        // dispatch the LiquidityAdded event
        emit LiquidityAdded(msg.sender, _reserveToken, _amount, initialStakedBalance.add(_amount), poolTokenSupply.add(poolTokenAmount));

        // dispatch the `TokenRateUpdate` event for the pool token
        dispatchPoolTokenRateUpdateEvent(reservePoolToken, poolTokenSupply.add(poolTokenAmount), _reserveToken);

        // dispatch the `TokenRateUpdate` event for the reserve tokens
        dispatchTokenRateUpdateEvent(reserveTokens[0], reserveTokens[1], 0, 0);

        // return the amount of pool tokens minted
        return poolTokenAmount;
    }

    /**
      * @dev decreases the pool's liquidity and burns the caller's shares in the pool
      *
      * @param _poolToken   address of the pool token
      * @param _amount      amount of pool tokens to burn
      * @param _minReturn   minimum return-amount of reserve tokens
      *
      * @return amount of liquidity removed
    */
    function removeLiquidity(ISmartToken _poolToken, uint256 _amount, uint256 _minReturn)
        public
        protected
        active
        validPoolToken(_poolToken)
        greaterThanZero(_amount)
        greaterThanZero(_minReturn)
        returns (uint256)
    {
        // sync the reserve balances just in case
        syncReserveBalances();

        // get the pool token supply before burning the caller's shares
        uint256 initialPoolSupply = _poolToken.totalSupply();

        // get the reserve token return before burning the caller's shares
        uint256 reserveAmount = removeLiquidityReturn(_poolToken, _amount);
        require(reserveAmount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // get the reserve token associated with the pool token
        IERC20Token reserveToken = poolTokensToReserves[_poolToken];

        // burn the caller's pool tokens
        IPoolTokensContainer(anchor).burn(_poolToken, msg.sender, _amount);

        // sync the reserve balance / staked balance
        reserves[reserveToken].balance = reserves[reserveToken].balance.sub(reserveAmount);
        uint256 newStakedBalance = stakedBalances[reserveToken].sub(reserveAmount);
        stakedBalances[reserveToken] = newStakedBalance;

        // transfer the reserve amount to the caller
        if (reserveToken == ETH_RESERVE_ADDRESS)
            msg.sender.transfer(reserveAmount);
        else
            safeTransfer(reserveToken, msg.sender, reserveAmount);

        // rebalance the pool's reserve weights
        rebalance();

        uint256 newPoolTokenSupply = initialPoolSupply.sub(_amount);

        // dispatch the LiquidityRemoved event
        emit LiquidityRemoved(msg.sender, reserveToken, reserveAmount, newStakedBalance, newPoolTokenSupply);

        // dispatch the `TokenRateUpdate` event for the pool token
        dispatchPoolTokenRateUpdateEvent(_poolToken, newPoolTokenSupply, reserveToken);

        // dispatch the `TokenRateUpdate` event for the reserve tokens
        dispatchTokenRateUpdateEvent(reserveTokens[0], reserveTokens[1], 0, 0);

        // return the amount of liquidity removed
        return reserveAmount;
    }

    /**
      * @dev calculates the amount of reserve tokens entitled for a given amount of pool tokens
      *
      * @param _poolToken   address of the pool token
      * @param _amount      amount of pool tokens
      *
      * @return amount of reserve tokens
    */
    function removeLiquidityReturn(ISmartToken _poolToken, uint256 _amount)
        public
        view
        returns (uint256)
    {
        uint256 totalSupply = _poolToken.totalSupply();
        uint256 stakedBalance = stakedBalances[poolTokensToReserves[_poolToken]];

        if (_amount < totalSupply) {
            uint256 x = stakedBalances[primaryReserveToken].mul(AMPLIFICATION_FACTOR);
            uint256 y = reserveAmplifiedBalance(primaryReserveToken);
            (uint256 min, uint256 max) = x < y ? (x, y) : (y, x);
            return _amount.mul(stakedBalance).div(totalSupply).mul(min).div(max);
        }
        return stakedBalance;
    }

    /**
      * @dev returns the expected target amount of converting one reserve to another along with the fees
      * this version of the function expects the reserve weights as an input (gas optimization)
      *
      * @param _sourceToken     contract address of the source reserve token
      * @param _targetToken     contract address of the target reserve token
      * @param _sourceWeight    source reserve token weight or 0 to read it from storage
      * @param _targetWeight    target reserve token weight or 0 to read it from storage
      * @param _rate            rate between the reserve tokens
      * @param _amount          amount of tokens received from the user
      *
      * @return expected target amount
      * @return expected fee (normal)
      * @return expected fee (adjusted)
    */
    function targetAmountAndFees(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint32 _sourceWeight,
        uint32 _targetWeight,
        Fraction memory _rate,
        uint256 _amount)
        private
        view
        returns (uint256 targetAmount, uint256 normalFee, uint256 adjustedFee)
    {
        if (_sourceWeight == 0)
            _sourceWeight = reserves[_sourceToken].weight;
        if (_targetWeight == 0)
            _targetWeight = reserves[_targetToken].weight;

        // get the tokens amplified balances
        uint256 sourceBalance = reserveAmplifiedBalance(_sourceToken);
        uint256 targetBalance = reserveAmplifiedBalance(_targetToken);

        // get the target amount
        targetAmount = IBancorFormula(addressOf(BANCOR_FORMULA)).crossReserveTargetAmount(
            sourceBalance,
            _sourceWeight,
            targetBalance,
            _targetWeight,
            _amount
        );

        // return the target amount minus the conversion fee and the conversion fee
        normalFee = super.calculateFee(targetAmount);
        adjustedFee = calculateFee(_targetToken, _sourceWeight, _targetWeight, _rate, targetAmount);
        targetAmount -= adjustedFee;
    }

    /**
      * @dev returns the conversion fee for a given target amount
      *
      * @param _targetToken     contract address of the target reserve token
      * @param _sourceWeight    source reserve token weight
      * @param _targetWeight    target reserve token weight
      * @param _rate            rate of 1 primary token in secondary tokens
      * @param _targetAmount    target amount
      *
      * @return conversion fee
    */
    function calculateFee(
        IERC20Token _targetToken,
        uint32 _sourceWeight,
        uint32 _targetWeight,
        Fraction memory _rate,
        uint256 _targetAmount)
        internal view returns (uint256)
    {
        // conversions to the primary reserve apply normal fees
        if (_targetToken == primaryReserveToken) {
            return super.calculateFee(_targetAmount);
        }

        // get the adjusted fee
        uint256 fee = calculateAdjustedFee(
            stakedBalances[primaryReserveToken],
            stakedBalances[secondaryReserveToken],
            _sourceWeight,
            _targetWeight,
            _rate.n,
            _rate.d,
            conversionFee);

        // calculate the fee based on the adjusted value
        return _targetAmount.mul(fee).div(CONVERSION_FEE_RESOLUTION);
    }

    /**
      * @dev returns the fee required for mitigating the secondary reserve distance from equilibrium
      *
      * assumption: _conversionFee * 2 <= CONVERSION_FEE_RESOLUTION
      *
      * @param _primaryReserveStaked    primary reserve staked balance
      * @param _secondaryReserveStaked  secondary reserve staked balance
      * @param _primaryReserveWeight    primary reserve weight
      * @param _secondaryReserveWeight  secondary reserve weight
      * @param _primaryReserveRate      primary reserve rate
      * @param _secondaryReserveRate    secondary reserve rate
      * @param _conversionFee           conversion fee
      *
      * @return adjusted fee
    */
    function calculateAdjustedFee(
        uint256 _primaryReserveStaked,
        uint256 _secondaryReserveStaked,
        uint256 _primaryReserveWeight,
        uint256 _secondaryReserveWeight,
        uint256 _primaryReserveRate,
        uint256 _secondaryReserveRate,
        uint256 _conversionFee)
        internal
        pure
        returns (uint256)
    {
        uint256 x = _primaryReserveStaked.mul(_primaryReserveRate).mul(_secondaryReserveWeight);
        uint256 y = _secondaryReserveStaked.mul(_secondaryReserveRate).mul(_primaryReserveWeight);

        if (x.mul(AMPLIFICATION_FACTOR) >= y.mul(AMPLIFICATION_FACTOR + 1))
            return _conversionFee / 2;

        if (x.mul(AMPLIFICATION_FACTOR * 2) <= y.mul(AMPLIFICATION_FACTOR * 2 - 1))
            return _conversionFee * 2;

        return _conversionFee.mul(y).div(x.mul(AMPLIFICATION_FACTOR).sub(y.mul(AMPLIFICATION_FACTOR - 1)));
    }

    /**
      * @dev creates the converter's pool tokens
      * note that technically pool tokens can be created on deployment but gas limit
      * might get too high for a block, so creating them on first activation
      *
    */
    function createPoolTokens() internal {
        IPoolTokensContainer container = IPoolTokensContainer(anchor);
        if (container.poolTokens().length != 0) {
            return;
        }

        uint256 reserveCount = reserveTokens.length;
        for (uint256 i = 0; i < reserveCount; i++) {
            ISmartToken reservePoolToken = container.createToken();

            // cache the pool token address (gas optimization)
            reservesToPoolTokens[reserveTokens[i]] = reservePoolToken;
            poolTokensToReserves[reservePoolToken] = reserveTokens[i];
        }
    }

    /**
      * @dev returns the effective rate between the two reserve tokens
      *
      * @return rate
    */
    function _effectiveTokensRate() private view returns (Fraction memory) {
        // get the external rate between the reserves
        (uint256 externalRateN, uint256 externalRateD, uint256 updateTime) = priceOracle.latestRateAndUpdateTime(primaryReserveToken, secondaryReserveToken);

        // if the external rate was recently updated - prefer it over the internal rate
        if (updateTime >= referenceRateUpdateTime) {
            return Fraction({ n: externalRateN, d: externalRateD });
        }

        // get the elapsed time between the current and the last conversion
        uint256 timeElapsed = time() - referenceRateUpdateTime;

        // if both of the conversions are in the same block - use the reference rate
        if (timeElapsed == 0) {
            return referenceRate;
        }

        // given N as the sampling window, the new internal rate is calculated according to the following formula:
        //   newRate = referenceRate + timeElapsed * [lastConversionRate - referenceRate] / N

        // if a long period of time, since the last update, has passed - the last rate should fully take effect
        if (timeElapsed >= RATE_PROPAGATION_PERIOD) {
            return lastConversionRate;
        }

        // calculate the numerator and the denumerator of the new rate
        Fraction memory ref = referenceRate;
        Fraction memory last = lastConversionRate;

        uint256 x = ref.d.mul(last.n);
        uint256 y = ref.n.mul(last.d);

        // since we know that timeElapsed < RATE_PROPAGATION_PERIOD, we can avoid using SafeMath:
        uint256 newRateN = y.mul(RATE_PROPAGATION_PERIOD - timeElapsed).add(x.mul(timeElapsed));
        uint256 newRateD = ref.d.mul(last.d).mul(RATE_PROPAGATION_PERIOD);

        return reduceRate(newRateN, newRateD);
    }

    /**
      * @dev checks if the rate has changed and if so, rebalances the weights
      * note that rebalancing based on rate change only happens once per block
      *
      * @return whether the rate was updated
      * @return rate between the reserve tokens
    */
    function handleRateChange() private returns (bool, Fraction memory) {
        uint256 currentTime = time();

        // avoid updating the rate more than once per block
        if (referenceRateUpdateTime == currentTime) {
            return (false, referenceRate);
        }

        // get and store the effective rate between the reserves
        Fraction memory newRate = _effectiveTokensRate();

        // if the rate has changed, update it and rebalance the pool
        Fraction memory ref = referenceRate;
        if (newRate.n == ref.n && newRate.d == ref.d) {
            return (false, newRate);
        }

        referenceRate = newRate;
        referenceRateUpdateTime = currentTime;

        rebalance();

        return (true, newRate);
    }

    /**
      * @dev updates the pool's reserve weights with new values in order to push the current primary
      * reserve token balance to its staked balance
    */
    function rebalance() private {
        // get the new reserve weights
        (uint32 primaryReserveWeight, uint32 secondaryReserveWeight) = effectiveReserveWeights(referenceRate);

        // update the reserve weights with the new values
        reserves[primaryReserveToken].weight = primaryReserveWeight;
        reserves[secondaryReserveToken].weight = secondaryReserveWeight;
    }

    /**
      * @dev returns the effective reserve weights based on the staked balance, current balance and oracle price
      *
      * @param _rate    rate between the reserve tokens
      *
      * @return new primary reserve weight
      * @return new secondary reserve weight
    */
    function effectiveReserveWeights(Fraction memory _rate) private view returns (uint32, uint32) {
        // get the primary reserve staked balance
        uint256 primaryStakedBalance = stakedBalances[primaryReserveToken];

        // get the tokens amplified balances
        uint256 primaryBalance = reserveAmplifiedBalance(primaryReserveToken);
        uint256 secondaryBalance = reserveAmplifiedBalance(secondaryReserveToken);

        // get the new weights
        return IBancorFormula(addressOf(BANCOR_FORMULA)).balancedWeights(
            primaryStakedBalance.mul(AMPLIFICATION_FACTOR),
            primaryBalance,
            secondaryBalance,
            _rate.n,
            _rate.d);
    }

    /**
      * @dev calculates and returns the rate between two reserve tokens
      *
      * @param _token1          contract address of the token to calculate the rate of one unit of
      * @param _token2          contract address of the token to calculate the rate of one `_token1` unit in
      * @param _token1Weight    reserve weight of token1
      * @param _token2Weight    reserve weight of token2
      *
      * @return rate
    */
    function tokensRate(IERC20Token _token1, IERC20Token _token2, uint32 _token1Weight, uint32 _token2Weight) private view returns (Fraction memory) {
        // apply the amplification factor
        uint256 token1Balance = reserveAmplifiedBalance(_token1);
        uint256 token2Balance = reserveAmplifiedBalance(_token2);

        // get reserve weights
        if (_token1Weight == 0) {
            _token1Weight = reserves[_token1].weight;
        }

        if (_token2Weight == 0) {
            _token2Weight = reserves[_token2].weight;
        }

        return Fraction({ n: token2Balance.mul(_token1Weight), d: token1Balance.mul(_token2Weight) });
    }

    /**
      * @dev dispatches rate events for both reserve tokens and for the target pool token
      * only used to circumvent the `stack too deep` compiler error
      *
      * @param _sourceToken     contract address of the source reserve token
      * @param _targetToken     contract address of the target reserve token
      * @param _sourceWeight    source reserve token weight
      * @param _targetWeight    target reserve token weight
    */
    function dispatchRateEvents(IERC20Token _sourceToken, IERC20Token _targetToken, uint32 _sourceWeight, uint32 _targetWeight) private {
        dispatchTokenRateUpdateEvent(_sourceToken, _targetToken, _sourceWeight, _targetWeight);

        // dispatch the `TokenRateUpdate` event for the pool token
        // the target reserve pool token rate is the only one that's affected
        // by conversions since conversion fees are applied to the target reserve
        ISmartToken targetPoolToken = poolToken(_targetToken);
        uint256 targetPoolTokenSupply = targetPoolToken.totalSupply();
        dispatchPoolTokenRateUpdateEvent(targetPoolToken, targetPoolTokenSupply, _targetToken);
    }

    /**
      * @dev dispatches token rate update event
      * only used to circumvent the `stack too deep` compiler error
      *
      * @param _token1          contract address of the token to calculate the rate of one unit of
      * @param _token2          contract address of the token to calculate the rate of one `_token1` unit in
      * @param _token1Weight    reserve weight of token1
      * @param _token2Weight    reserve weight of token2
    */
    function dispatchTokenRateUpdateEvent(IERC20Token _token1, IERC20Token _token2, uint32 _token1Weight, uint32 _token2Weight) private {
        // dispatch token rate update event
        Fraction memory rate = tokensRate(_token1, _token2, _token1Weight, _token2Weight);

        emit TokenRateUpdate(_token1, _token2, rate.n, rate.d);
    }

    /**
      * @dev dispatches the `TokenRateUpdate` for the pool token
      * only used to circumvent the `stack too deep` compiler error
      *
      * @param _poolToken       address of the pool token
      * @param _poolTokenSupply total pool token supply
      * @param _reserveToken    address of the reserve token
    */
    function dispatchPoolTokenRateUpdateEvent(ISmartToken _poolToken, uint256 _poolTokenSupply, IERC20Token _reserveToken) private {
        emit TokenRateUpdate(_poolToken, _reserveToken, stakedBalances[_reserveToken], _poolTokenSupply);
    }

    /**
      * @dev returns the current time
    */
    function time() internal view returns (uint256) {
        return now;
    }

    uint256 private constant MAX_RATE_FACTOR_LOWER_BOUND = 1e30;
    uint256 private constant MAX_RATE_FACTOR_UPPER_BOUND = uint256(-1) / MAX_RATE_FACTOR_LOWER_BOUND;

    /**
      * @dev reduces the numerator and denominator while maintaining the ratio between them as accurately as possible
    */
    function reduceRate(uint256 _n, uint256 _d) internal pure returns (Fraction memory) {
        if (_n >= _d) {
            return reduceFactors(_n, _d);
        }

        Fraction memory rate = reduceFactors(_d, _n);
        return Fraction({ n: rate.d, d: rate.n });
    }

    /**
      * @dev reduces the factors while maintaining the ratio between them as accurately as possible
    */
    function reduceFactors(uint256 _max, uint256 _min) internal pure returns (Fraction memory) {
        if (_min > MAX_RATE_FACTOR_UPPER_BOUND) {
            return Fraction({
                n: MAX_RATE_FACTOR_LOWER_BOUND,
                d: _min / (_max / MAX_RATE_FACTOR_LOWER_BOUND)
            });
        }

        if (_max > MAX_RATE_FACTOR_LOWER_BOUND) {
            return Fraction({
                n: MAX_RATE_FACTOR_LOWER_BOUND,
                d: _min * MAX_RATE_FACTOR_LOWER_BOUND / _max
            });
        }

        return Fraction({ n: _max, d: _min });
    }
}
