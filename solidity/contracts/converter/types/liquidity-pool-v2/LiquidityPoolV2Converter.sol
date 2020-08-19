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
    uint32 internal constant HIGH_FEE_UPPER_BOUND = 997500; // high fee upper bound in PPM units
    uint256 internal constant MAX_RATE_FACTOR_LOWER_BOUND = 1e30;

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

    uint256 public externalRatePropagationTime = 1 hours;  // the time it takes for the external rate to fully take effect
    uint256 public prevConversionTime;  // previous conversion time in seconds

    // factors used in fee calculations
    uint32 public lowFeeFactor = 200000;
    uint32 public highFeeFactor = 800000;

    // used by the temp liquidity limit mechanism during the beta
    mapping (address => uint256) public maxStakedBalances;
    bool public maxStakedBalanceEnabled = true;

     /**
      * @dev triggered when the external rate propagation time is updated
      *
      * @param  _prevPropagationTime    previous external rate propagation time, in seconds
      * @param  _newPropagationTime     new external rate propagation time, in seconds
    */
    event ExternalRatePropagationTimeUpdate(uint256 _prevPropagationTime, uint256 _newPropagationTime);

    /**
      * @dev triggered when the fee factors are updated
      *
      * @param  _prevLowFactor    previous low factor percentage, represented in ppm
      * @param  _newLowFactor     new low factor percentage, represented in ppm
      * @param  _prevHighFactor    previous high factor percentage, represented in ppm
      * @param  _newHighFactor     new high factor percentage, represented in ppm
    */
    event FeeFactorsUpdate(uint256 _prevLowFactor, uint256 _newLowFactor, uint256 _prevHighFactor, uint256 _newHighFactor);

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
      *
      * @return true if the converter is active, false otherwise
    */
    function isActive() public view returns (bool) {
        return super.isActive() && priceOracle != address(0);
    }

    /**
      * @dev returns the liquidity amplification factor in the pool
      *
      * @return liquidity amplification factor
    */
    function amplificationFactor() public pure returns (uint8) {
        return AMPLIFICATION_FACTOR;
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
    function activate(
        IERC20Token _primaryReserveToken,
        IChainlinkPriceOracle _primaryReserveOracle,
        IChainlinkPriceOracle _secondaryReserveOracle)
        public
        inactive
        ownerOnly
        validReserve(_primaryReserveToken)
        notThis(_primaryReserveOracle)
        notThis(_secondaryReserveOracle)
        validAddress(_primaryReserveOracle)
        validAddress(_secondaryReserveOracle)
    {
        // validate anchor ownership
        require(anchor.owner() == address(this), "ERR_ANCHOR_NOT_OWNED");

        // validate oracles
        IWhitelist oracleWhitelist = IWhitelist(addressOf(CHAINLINK_ORACLE_WHITELIST));
        require(oracleWhitelist.isWhitelisted(_primaryReserveOracle) &&
                oracleWhitelist.isWhitelisted(_secondaryReserveOracle), "ERR_INVALID_ORACLE");

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
        priceOracle = customFactory.createPriceOracle(
            _primaryReserveToken,
            secondaryReserveToken,
            _primaryReserveOracle,
            _secondaryReserveOracle);

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

        emit Activation(converterType(), anchor, true);
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
        return amplifiedBalance(_reserveToken);
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
      * available as a temporary mechanism during the beta
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
      * available as a temporary mechanism during the beta
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
        Fraction memory rate = rateFromPrimaryWeight(effectivePrimaryWeight());
        return (rate.n, rate.d);
    }

    /**
      * @dev returns the effective reserve tokens weights
      *
      * @return reserve1 weight
      * @return reserve2 weight
    */
    function effectiveReserveWeights() public view returns (uint256, uint256) {
        uint32 primaryReserveWeight = effectivePrimaryWeight();
        if (primaryReserveToken == reserveTokens[0]) {
            return (primaryReserveWeight, inverseWeight(primaryReserveWeight));
        }

        return (inverseWeight(primaryReserveWeight), primaryReserveWeight);
    }

    /**
      * @dev updates the external rate propagation time
      * can only be called by the contract owner
      *
      * @param _propagationTime rate propagation time, in seconds
    */
    function setExternalRatePropagationTime(uint256 _propagationTime) public ownerOnly {
        emit ExternalRatePropagationTimeUpdate(externalRatePropagationTime, _propagationTime);
        externalRatePropagationTime = _propagationTime;
    }

    /**
      * @dev updates the fee factors
      * can only be called by the contract owner
      *
      * @param _lowFactor   new low fee factor, represented in ppm
      * @param _highFactor  new high fee factor, represented in ppm
    */
    function setFeeFactors(uint32 _lowFactor, uint32 _highFactor) public ownerOnly {
        require(_lowFactor <= PPM_RESOLUTION, "ERR_INVALID_FEE_FACTOR");
        require(_highFactor <= PPM_RESOLUTION, "ERR_INVALID_FEE_FACTOR");

        emit FeeFactorsUpdate(lowFeeFactor, _lowFactor, highFeeFactor, _highFactor);

        lowFeeFactor = _lowFactor;
        highFeeFactor = _highFactor;
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
        validReserve(_sourceToken)
        validReserve(_targetToken)
        returns (uint256, uint256)
    {
        // validate input
        require(_sourceToken != _targetToken, "ERR_SAME_SOURCE_TARGET");

        // get the external rate between the reserves along with its update time
        Fraction memory externalRate;
        uint256 externalRateUpdateTime;
        (externalRate.n, externalRate.d, externalRateUpdateTime) =
            priceOracle.latestRateAndUpdateTime(primaryReserveToken, secondaryReserveToken);

        // get the source token effective / external weights
        (uint32 sourceTokenWeight, uint32 externalSourceTokenWeight) = effectiveAndExternalPrimaryWeight(externalRate, externalRateUpdateTime);
        if (_targetToken == primaryReserveToken) {
            sourceTokenWeight = inverseWeight(sourceTokenWeight);
            externalSourceTokenWeight = inverseWeight(externalSourceTokenWeight);
        }

        // return the target amount and the fee using the updated reserve weights
        return targetAmountAndFee(
            _sourceToken, _targetToken,
            sourceTokenWeight, inverseWeight(sourceTokenWeight),
            externalRate, inverseWeight(externalSourceTokenWeight),
            _amount);
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
        // convert and get the target amount and fee
        (uint256 amount, uint256 fee) = doConvert(_sourceToken, _targetToken, _amount);

        // update the previous conversion time
        prevConversionTime = time();

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
      * @return amount of target tokens received
      * @return fee amount
    */
    function doConvert(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount) private returns (uint256, uint256) {
        // get the external rate between the reserves along with its update time
        Fraction memory externalRate;
        uint256 externalRateUpdateTime;
        (externalRate.n, externalRate.d, externalRateUpdateTime) = priceOracle.latestRateAndUpdateTime(primaryReserveToken, secondaryReserveToken);

        // pre-conversion preparation - update the weights if needed and get the target amount and feee
        (uint256 targetAmount, uint256 fee) = prepareConversion(_sourceToken, _targetToken, _amount, externalRate, externalRateUpdateTime);

        // ensure that the trade gives something in return
        require(targetAmount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the trade won't deplete the reserve balance
        uint256 targetReserveBalance = reserves[_targetToken].balance;
        require(targetAmount < targetReserveBalance, "ERR_TARGET_AMOUNT_TOO_HIGH");

        // ensure that the input amount was already deposited
        if (_sourceToken == ETH_RESERVE_ADDRESS)
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        else
            require(msg.value == 0 && _sourceToken.balanceOf(this).sub(reserves[_sourceToken].balance) >= _amount, "ERR_INVALID_AMOUNT");

        // sync the reserve balances
        syncReserveBalance(_sourceToken);
        reserves[_targetToken].balance = targetReserveBalance.sub(targetAmount);

        // if the pool is in deficit, add half the fee to the target staked balance, otherwise add all
        stakedBalances[_targetToken] = stakedBalances[_targetToken].add(calculateDeficit(externalRate) == 0 ? fee : fee / 2);

        // return a tuple of [target amount (excluding fee), fee]
        return (targetAmount, fee);
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

        // during the beta, ensure that the new staked balance isn't greater than the max limit
        if (maxStakedBalanceEnabled) {
            require(maxStakedBalances[_reserveToken] == 0 || initialStakedBalance.add(_amount) <= maxStakedBalances[_reserveToken], "ERR_MAX_STAKED_BALANCE_REACHED");
        }

        // get the pool token associated with the reserve and its supply
        ISmartToken reservePoolToken = reservesToPoolTokens[_reserveToken];
        uint256 poolTokenSupply = reservePoolToken.totalSupply();

        // for non ETH reserve, transfer the funds from the user to the pool
        if (_reserveToken != ETH_RESERVE_ADDRESS)
            safeTransferFrom(_reserveToken, msg.sender, this, _amount);

        // get the rate before updating the staked balance
        Fraction memory rate = rebalanceRate();

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
        rebalance(rate);

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
        (uint256 reserveAmount, ) = removeLiquidityReturnAndFee(_poolToken, _amount);
        require(reserveAmount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // get the reserve token associated with the pool token
        IERC20Token reserveToken = poolTokensToReserves[_poolToken];

        // burn the caller's pool tokens
        IPoolTokensContainer(anchor).burn(_poolToken, msg.sender, _amount);

        // get the rate before updating the staked balance
        Fraction memory rate = rebalanceRate();

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
        rebalance(rate);

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
      * note that a fee is applied according to the equilibrium level of the primary reserve token
      *
      * @param _poolToken   address of the pool token
      * @param _amount      amount of pool tokens
      *
      * @return amount after fee and fee, in reserve token units
    */
    function removeLiquidityReturnAndFee(ISmartToken _poolToken, uint256 _amount) public view returns (uint256, uint256) {
        uint256 totalSupply = _poolToken.totalSupply();
        uint256 stakedBalance = stakedBalances[poolTokensToReserves[_poolToken]];

        if (_amount < totalSupply) {
            (uint256 min, uint256 max) = tokensRateAccuracy();
            uint256 amountBeforeFee = _amount.mul(stakedBalance).div(totalSupply);
            uint256 amountAfterFee = amountBeforeFee.mul(min).div(max);
            return (amountAfterFee, amountBeforeFee - amountAfterFee);
        }
        return (stakedBalance, 0);
    }

    /**
      * @dev calculates the tokens-rate accuracy
      *
      * @return the tokens-rate accuracy as a tuple of numerator and denominator
    */
    function tokensRateAccuracy() internal view returns (uint256, uint256) {
        uint32 weight = reserves[primaryReserveToken].weight;
        Fraction memory poolRate = tokensRate(primaryReserveToken, secondaryReserveToken, weight, inverseWeight(weight));
        (uint256 n, uint256 d) = effectiveTokensRate();
        (uint256 x, uint256 y) = reducedRatio(poolRate.n.mul(d), poolRate.d.mul(n), MAX_RATE_FACTOR_LOWER_BOUND);
        return x < y ? (x, y) : (y, x);
    }

    /**
      * @dev returns the expected target amount of converting one reserve to another along with the fee
      * this version of the function expects the reserve weights as an input (gas optimization)
      *
      * @param _sourceToken             contract address of the source reserve token
      * @param _targetToken             contract address of the target reserve token
      * @param _sourceWeight            source reserve token weight
      * @param _targetWeight            target reserve token weight
      * @param _externalRate            external rate of 1 primary token in secondary tokens
      * @param _targetExternalWeight    target reserve token weight based on external rate
      * @param _amount                  amount of tokens received from the user
      *
      * @return expected target amount
      * @return expected fee
    */
    function targetAmountAndFee(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint32 _sourceWeight,
        uint32 _targetWeight,
        Fraction memory _externalRate,
        uint32 _targetExternalWeight,
        uint256 _amount)
        private
        view
        returns (uint256, uint256)
    {
        // get the tokens amplified balances
        uint256 sourceBalance = amplifiedBalance(_sourceToken);
        uint256 targetBalance = amplifiedBalance(_targetToken);

        // get the target amount
        uint256 targetAmount = IBancorFormula(addressOf(BANCOR_FORMULA)).crossReserveTargetAmount(
            sourceBalance,
            _sourceWeight,
            targetBalance,
            _targetWeight,
            _amount
        );

        // if the target amount is larger than the target reserve balance, return 0
        // this can happen due to the amplification
        require(targetAmount <= reserves[_targetToken].balance, "ERR_TARGET_AMOUNT_TOO_HIGH");

        // return a tuple of [target amount (excluding fee), fee]
        uint256 fee = calculateFee(_sourceToken, _targetToken, _sourceWeight, _targetWeight, _externalRate, _targetExternalWeight, targetAmount);
        return (targetAmount - fee, fee);
    }

    /**
      * @dev returns the fee amount for a given target amount
      *
      * @param _sourceToken             contract address of the source reserve token
      * @param _targetToken             contract address of the target reserve token
      * @param _sourceWeight            source reserve token weight
      * @param _targetWeight            target reserve token weight
      * @param _externalRate            external rate of 1 primary token in secondary tokens
      * @param _targetExternalWeight    target reserve token weight based on external rate
      * @param _targetAmount            target amount
      *
      * @return fee amount
    */
    function calculateFee(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint32 _sourceWeight,
        uint32 _targetWeight,
        Fraction memory _externalRate,
        uint32 _targetExternalWeight,
        uint256 _targetAmount)
        internal view returns (uint256)
    {
        // get the external rate of 1 source token in target tokens
        Fraction memory targetExternalRate;
        if (_targetToken == primaryReserveToken) {
            (targetExternalRate.n, targetExternalRate.d) = (_externalRate.n, _externalRate.d);
        }
        else {
            (targetExternalRate.n, targetExternalRate.d) = (_externalRate.d, _externalRate.n);
        }

        // get the token pool rate
        Fraction memory currentRate = tokensRate(_targetToken, _sourceToken, _targetWeight, _sourceWeight);
        if (compareRates(currentRate, targetExternalRate) < 0) {
            uint256 lo = currentRate.n.mul(targetExternalRate.d);
            uint256 hi = targetExternalRate.n.mul(currentRate.d);
            (lo, hi) = reducedRatio(hi - lo, hi, MAX_RATE_FACTOR_LOWER_BOUND);

            // apply the high fee only if the ratio between the effective weight and the external (target) weight is below the high fee upper bound
            uint32 feeFactor;
            if (uint256(_targetWeight).mul(PPM_RESOLUTION) < uint256(_targetExternalWeight).mul(HIGH_FEE_UPPER_BOUND)) {
                feeFactor = highFeeFactor;
            }
            else {
                feeFactor = lowFeeFactor;
            }

            return _targetAmount.mul(lo).mul(feeFactor).div(hi.mul(PPM_RESOLUTION));
        }

        return 0;
    }

    /**
      * @dev calculates the deficit in the pool (in secondary reserve token amount)
      *
      * @param _externalRate    external rate of 1 primary token in secondary tokens
      *
      * @return the deficit in the pool
    */
    function calculateDeficit(Fraction memory _externalRate) internal view returns (uint256) {
        IERC20Token primaryReserveTokenLocal = primaryReserveToken; // gas optimization
        IERC20Token secondaryReserveTokenLocal = secondaryReserveToken; // gas optimization

        // get the amount of primary balances in secondary tokens using the external rate
        uint256 primaryBalanceInSecondary = reserves[primaryReserveTokenLocal].balance.mul(_externalRate.n).div(_externalRate.d);
        uint256 primaryStakedInSecondary = stakedBalances[primaryReserveTokenLocal].mul(_externalRate.n).div(_externalRate.d);

        // if the total balance is lower than the total staked balance, return the delta
        uint256 totalBalance = primaryBalanceInSecondary.add(reserves[secondaryReserveTokenLocal].balance);
        uint256 totalStaked = primaryStakedInSecondary.add(stakedBalances[secondaryReserveTokenLocal]);
        if (totalBalance < totalStaked) {
            return totalStaked - totalBalance;
        }

        return 0;
    }

    /**
      * @dev updates the weights based on the effective weights calculation if needed
      * and returns the target amount and fee
      *
      * @param _sourceToken             source ERC20 token
      * @param _targetToken             target ERC20 token
      * @param _amount                  amount of tokens to convert (in units of the source token)
      * @param _externalRate            external rate of 1 primary token in secondary tokens
      * @param _externalRateUpdateTime  external rate update time
      *
      * @return expected target amount
      * @return expected fee
    */
    function prepareConversion(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint256 _amount,
        Fraction memory _externalRate,
        uint256 _externalRateUpdateTime)
        internal
        returns (uint256, uint256)
    {
        // get the source token effective / external weights
        (uint32 effectiveSourceReserveWeight, uint32 externalSourceReserveWeight) =
            effectiveAndExternalPrimaryWeight(_externalRate, _externalRateUpdateTime);
        if (_targetToken == primaryReserveToken) {
            effectiveSourceReserveWeight = inverseWeight(effectiveSourceReserveWeight);
            externalSourceReserveWeight = inverseWeight(externalSourceReserveWeight);
        }

        // check if the weights need to be updated
        if (reserves[_sourceToken].weight != effectiveSourceReserveWeight) {
            // update the weights
            reserves[_sourceToken].weight = effectiveSourceReserveWeight;
            reserves[_targetToken].weight = inverseWeight(effectiveSourceReserveWeight);
        }

        // get expected target amount and fee
        return targetAmountAndFee(
            _sourceToken, _targetToken,
            effectiveSourceReserveWeight, inverseWeight(effectiveSourceReserveWeight),
            _externalRate, inverseWeight(externalSourceReserveWeight),
            _amount);
    }

    /**
      * @dev creates the converter's pool tokens
      * note that technically pool tokens can be created on deployment but gas limit
      * might get too high for a block, so creating them on first activation
      *
    */
    function createPoolTokens() internal {
        IPoolTokensContainer container = IPoolTokensContainer(anchor);
        ISmartToken[] memory poolTokens = container.poolTokens();
        bool initialSetup = poolTokens.length == 0;

        uint256 reserveCount = reserveTokens.length;
        for (uint256 i = 0; i < reserveCount; i++) {
            ISmartToken reservePoolToken;
            if (initialSetup) {
                reservePoolToken = container.createToken();
            }
            else {
                reservePoolToken = poolTokens[i];
            }

            // cache the pool token address (gas optimization)
            reservesToPoolTokens[reserveTokens[i]] = reservePoolToken;
            poolTokensToReserves[reservePoolToken] = reserveTokens[i];
        }
    }

    /**
      * @dev returns the effective primary reserve token weight
      *
      * @return effective primary reserve weight
    */
    function effectivePrimaryWeight() internal view returns (uint32) {
        // get the external rate between the reserves along with its update time
        Fraction memory externalRate;
        uint256 externalRateUpdateTime;
        (externalRate.n, externalRate.d, externalRateUpdateTime) = priceOracle.latestRateAndUpdateTime(primaryReserveToken, secondaryReserveToken);
        (uint32 effectiveWeight,) = effectiveAndExternalPrimaryWeight(externalRate, externalRateUpdateTime);
        return effectiveWeight;
    }

    /**
      * @dev returns the effective and the external primary reserve token weights
      *
      * @param _externalRate            external rate of 1 primary token in secondary tokens
      * @param _externalRateUpdateTime  external rate update time
      *
      * @return effective primary reserve weight
      * @return external primary reserve weight
    */
    function effectiveAndExternalPrimaryWeight(Fraction memory _externalRate, uint256 _externalRateUpdateTime)
        internal
        view
        returns
        (uint32, uint32)
    {
        // get the external rate primary reserve weight
        uint32 externalPrimaryReserveWeight = primaryWeightFromRate(_externalRate);

        // get the primary reserve weight
        IERC20Token primaryReserveTokenLocal = primaryReserveToken; // gas optimization
        uint32 primaryReserveWeight = reserves[primaryReserveTokenLocal].weight;

        // if the weights are already at their target, return current weights
        if (primaryReserveWeight == externalPrimaryReserveWeight) {
            return (primaryReserveWeight, externalPrimaryReserveWeight);
        }

        // get the elapsed time since the last conversion time and the external rate update time
        uint256 referenceTime = prevConversionTime;
        if (referenceTime < _externalRateUpdateTime) {
            referenceTime = _externalRateUpdateTime;
        }

        // limit the reference time by current time
        uint256 currentTime = time();
        if (referenceTime > currentTime) {
            referenceTime = currentTime;
        }

        // if no time has passed since the reference time, return current weights (also ensures a single update per block)
        uint256 elapsedTime = currentTime - referenceTime;
        if (elapsedTime == 0) {
            return (primaryReserveWeight, externalPrimaryReserveWeight);
        }

        // find the token whose weight is lower than the target weight and get its pool rate - if it's
        // lower than external rate, update the weights
        Fraction memory poolRate = tokensRate(
            primaryReserveTokenLocal,
            secondaryReserveToken,
            primaryReserveWeight,
            inverseWeight(primaryReserveWeight));

        bool updateWeights = false;
        if (primaryReserveWeight < externalPrimaryReserveWeight) {
            updateWeights = compareRates(poolRate, _externalRate) < 0;
        }
        else {
            updateWeights = compareRates(poolRate, _externalRate) > 0;
        }

        if (!updateWeights) {
            return (primaryReserveWeight, externalPrimaryReserveWeight);
        }

        // if the elapsed time since the reference rate is equal or larger than the propagation time,
        // the external rate should take full effect
        if (elapsedTime >= externalRatePropagationTime) {
            return (externalPrimaryReserveWeight, externalPrimaryReserveWeight);
        }

        // move the weights towards their target by the same proportion of elapsed time out of the rate propagation time
        primaryReserveWeight = uint32(weightedAverageIntegers(
            primaryReserveWeight, externalPrimaryReserveWeight,
            elapsedTime, externalRatePropagationTime));
        return (primaryReserveWeight, externalPrimaryReserveWeight);
    }

    /**
      * @dev returns the current rate for add/remove liquidity rebalancing
      * only used to circumvent the `stack too deep` compiler error
      *
      * @return effective rate
    */
    function rebalanceRate() private view returns (Fraction memory) {
        // if one of the balances is 0, return the external rate
        if (reserves[primaryReserveToken].balance == 0 || reserves[secondaryReserveToken].balance == 0) {
            Fraction memory externalRate;
            (externalRate.n, externalRate.d) = priceOracle.latestRate(primaryReserveToken, secondaryReserveToken);
            return externalRate;
        }

        // return the rate based on the current rate
        return tokensRate(primaryReserveToken, secondaryReserveToken, 0, 0);
    }

    /**
      * @dev updates the reserve weights based on the external rate
    */
    function rebalance() private {
        // get the external rate
        Fraction memory externalRate;
        (externalRate.n, externalRate.d) = priceOracle.latestRate(primaryReserveToken, secondaryReserveToken);

        // rebalance the weights based on the external rate
        rebalance(externalRate);
    }

    /**
      * @dev updates the reserve weights based on the given rate
      *
      * @param _rate    rate of 1 primary token in secondary tokens
    */
    function rebalance(Fraction memory _rate) private {
        // get the new primary reserve weight
        uint256 a = amplifiedBalance(primaryReserveToken).mul(_rate.n);
        uint256 b = amplifiedBalance(secondaryReserveToken).mul(_rate.d);
        (uint256 x, uint256 y) = normalizedRatio(a, b, PPM_RESOLUTION);

        // update the reserve weights with the new values
        reserves[primaryReserveToken].weight = uint32(x);
        reserves[secondaryReserveToken].weight = uint32(y);
    }

    /**
      * @dev returns the amplified balance of a given reserve token
      * this version skips the input validation (gas optimization)
      *
      * @param _reserveToken   reserve token address
      *
      * @return amplified balance
    */
    function amplifiedBalance(IERC20Token _reserveToken) internal view returns (uint256) {
        return stakedBalances[_reserveToken].mul(AMPLIFICATION_FACTOR - 1).add(reserves[_reserveToken].balance);
    }

    /**
      * @dev returns the effective primary reserve weight based on the staked balance, current balance and given rate
      *
      * @param _rate    rate of 1 primary token in secondary tokens
      *
      * @return primary reserve weight
    */
    function primaryWeightFromRate(Fraction memory _rate) private view returns (uint32) {
        uint256 a = stakedBalances[primaryReserveToken].mul(_rate.n);
        uint256 b = stakedBalances[secondaryReserveToken].mul(_rate.d);
        (uint256 x,) = normalizedRatio(a, b, PPM_RESOLUTION);
        return uint32(x);
    }

    /**
      * @dev returns the effective rate based on the staked balance, current balance and given primary reserve weight
      *
      * @param _primaryReserveWeight    primary reserve weight
      *
      * @return effective rate of 1 primary token in secondary tokens
    */
    function rateFromPrimaryWeight(uint32 _primaryReserveWeight) private view returns (Fraction memory) {
        uint256 n = stakedBalances[secondaryReserveToken].mul(_primaryReserveWeight);
        uint256 d = stakedBalances[primaryReserveToken].mul(inverseWeight(_primaryReserveWeight));
        (n, d) = reducedRatio(n, d, MAX_RATE_FACTOR_LOWER_BOUND);
        return Fraction(n, d);
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
        if (_token1Weight == 0) {
            _token1Weight = reserves[_token1].weight;
        }

        if (_token2Weight == 0) {
            _token2Weight = inverseWeight(_token1Weight);
        }

        uint256 n = amplifiedBalance(_token2).mul(_token1Weight);
        uint256 d = amplifiedBalance(_token1).mul(_token2Weight);
        (n, d) = reducedRatio(n, d, MAX_RATE_FACTOR_LOWER_BOUND);
        return Fraction(n, d);
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

    // utilities

    /**
      * @dev returns the inverse weight for a given weight
      *
      * @param _weight  reserve token weight
      *
      * @return reserve weight
    */
    function inverseWeight(uint32 _weight) internal pure returns (uint32) {
        return PPM_RESOLUTION - _weight;
    }

    /**
      * @dev returns the current time
    */
    function time() internal view returns (uint256) {
        return now;
    }

    /**
      * @dev computes "scale * a / (a + b)" and "scale * b / (a + b)".
    */
    function normalizedRatio(uint256 _a, uint256 _b, uint256 _scale) internal pure returns (uint256, uint256) {
        if (_a == _b)
            return (_scale / 2, _scale / 2);
        if (_a < _b)
            return accurateRatio(_a, _b, _scale);
        (uint256 y, uint256 x) = accurateRatio(_b, _a, _scale);
        return (x, y);
    }

    /**
      * @dev computes "scale * a / (a + b)" and "scale * b / (a + b)", assuming that "a < b".
    */
    function accurateRatio(uint256 _a, uint256 _b, uint256 _scale) internal pure returns (uint256, uint256) {
        uint256 maxVal = uint256(-1) / _scale;
        if (_a > maxVal) {
            uint256 c = _a / (maxVal + 1) + 1;
            _a /= c;
            _b /= c;
        }
        uint256 x = roundDiv(_a * _scale, _a.add(_b));
        uint256 y = _scale - x;
        return (x, y);
    }

    /**
      * @dev computes a reduced-scalar ratio
      *
      * @param _n   ratio numerator
      * @param _d   ratio denominator
      * @param _max maximum desired scalar
      *
      * @return ratio's numerator and denominator
    */
    function reducedRatio(uint256 _n, uint256 _d, uint256 _max) internal pure returns (uint256, uint256) {
        if (_n > _max || _d > _max)
            return normalizedRatio(_n, _d, _max);
        return (_n, _d);
    }

    /**
      * @dev computes the nearest integer to a given quotient without overflowing or underflowing.
    */
    function roundDiv(uint256 _n, uint256 _d) internal pure returns (uint256) {
        return _n / _d + _n % _d / (_d - _d / 2);
    }

    /**
      * @dev calculates the weighted-average of two integers
      *
      * @param _x   first integer
      * @param _y   second integer
      * @param _n   factor numerator
      * @param _d   factor denominator
      *
      * @return the weighted-average of the given integers
    */
    function weightedAverageIntegers(uint256 _x, uint256 _y, uint256 _n, uint256 _d) internal pure returns (uint256) {
        return _x.mul(_d).add(_y.mul(_n)).sub(_x.mul(_n)).div(_d);
    }

    /**
      * @dev compares two rates
      *
      * @param _rate1   first rate to compare
      * @param _rate2   second rate to compare
      *
      * @return `-1` if `_rate1` is lower than `_rate2`, `1` if `_rate1` is higher than `_rate2`, 0 if the rates are identical
    */
    function compareRates(Fraction memory _rate1, Fraction memory _rate2) internal pure returns (int8) {
        uint256 x = _rate1.n.mul(_rate2.d);
        uint256 y = _rate2.n.mul(_rate1.d);

        if (x < y)
            return -1;

        if (x > y)
            return 1;

        return 0;
    }
}
