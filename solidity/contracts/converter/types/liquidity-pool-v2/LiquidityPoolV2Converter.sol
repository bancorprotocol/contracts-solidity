// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./PoolTokensContainer.sol";
import "./LiquidityPoolV2ConverterCustomFactory.sol";
import "../../LiquidityPoolConverter.sol";
import "../../interfaces/IConverterFactory.sol";
import "../../../utility/interfaces/IPriceOracle.sol";
import "../../../utility/Types.sol";

/**
  * @dev This contract is a specialized version of a converter that uses
  * price oracles to rebalance the reserve weights in such a way that the primary token
  * balance always strives to match the staked balance.
  *
  * This type of liquidity pool always has 2 reserves and the reserve weights are dynamic.
*/
contract LiquidityPoolV2Converter is LiquidityPoolConverter {
    uint8 internal constant AMPLIFICATION_FACTOR = 20;  // factor to use for conversion calculations (reduces slippage)

    IPriceOracle public priceOracle;                                // external price oracle
    IERC20Token public primaryReserveToken;                         // primary reserve in the pool
    IERC20Token public secondaryReserveToken;                       // secondary reserve in the pool (cache)
    mapping (IERC20Token => uint256) private stakedBalances;        // tracks the staked liquidity in the pool plus the fees
    mapping (IERC20Token => IDSToken) private reservesToPoolTokens; // maps each reserve to its pool token
    mapping (IDSToken => IERC20Token) private poolTokensToReserves; // maps each pool token to its reserve

    Fraction public externalRate;           // external rate of 1 primary token in secondary tokens
    uint256 public externalRateUpdateTime;  // last time the external rate was updated (in seconds)

    // used by the temp liquidity limit mechanism during the beta
    mapping (IERC20Token => uint256) public maxStakedBalances;
    bool public maxStakedBalanceEnabled = true;

    uint32 public oracleDeviationFee = 10000; // oracle deviation fee, represented in ppm

    /**
      * @dev triggered when the oracle deviation fee is updated
      *
      * @param  _prevFee    previous fee percentage, represented in ppm
      * @param  _newFee     new fee percentage, represented in ppm
    */
    event OracleDeviationFeeUpdate(uint32 _prevFee, uint32 _newFee);

    /**
      * @dev initializes a new LiquidityPoolV2Converter instance
      *
      * @param  _poolTokensContainer    pool tokens container governed by the converter
      * @param  _registry               address of a contract registry contract
      * @param  _maxConversionFee       maximum conversion fee, represented in ppm
    */
    constructor(
        IPoolTokensContainer _poolTokensContainer,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        LiquidityPoolConverter(_poolTokensContainer, _registry, _maxConversionFee)
        public
    {
    }

    // ensures the address is a pool token
    modifier validPoolToken(IDSToken _address) {
        _validPoolToken(_address);
        _;
    }

    // error message binary size optimization
    function _validPoolToken(IDSToken _address) internal view {
        require(address(poolTokensToReserves[_address]) != address(0), "ERR_INVALID_POOL_TOKEN");
    }

    /**
      * @dev returns the converter type
      *
      * @return see the converter types in the the main contract doc
    */
    function converterType() public pure override returns (uint16) {
        return 2;
    }

    /**
      * @dev returns true if the converter is active, false otherwise
      *
      * @return true if the converter is active, false otherwise
    */
    function isActive() public view override returns (bool) {
        return super.isActive() && address(priceOracle) != address(0);
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
        notThis(address(_primaryReserveOracle))
        notThis(address(_secondaryReserveOracle))
        validAddress(address(_primaryReserveOracle))
        validAddress(address(_secondaryReserveOracle))
    {
        // validate anchor ownership
        require(anchor.owner() == address(this), "ERR_ANCHOR_NOT_OWNED");

        // validate oracles
        IWhitelist oracleWhitelist = IWhitelist(addressOf(CHAINLINK_ORACLE_WHITELIST));
        require(oracleWhitelist.isWhitelisted(address(_primaryReserveOracle)) &&
                oracleWhitelist.isWhitelisted(address(_secondaryReserveOracle)), "ERR_INVALID_ORACLE");

        // create the converter's pool tokens if they don't already exist
        createPoolTokens();

        // sets the primary & secondary reserve tokens
        primaryReserveToken = _primaryReserveToken;
        if (_primaryReserveToken == reserveTokens[0]) {
            secondaryReserveToken = reserveTokens[1];
        }
        else {
            secondaryReserveToken = reserveTokens[0];
        }

        // creates and initalizes the price oracle and sets initial rates
        LiquidityPoolV2ConverterCustomFactory customFactory =
            LiquidityPoolV2ConverterCustomFactory(address(IConverterFactory(addressOf(CONVERTER_FACTORY)).customFactories(converterType())));
        priceOracle = customFactory.createPriceOracle(
            _primaryReserveToken,
            secondaryReserveToken,
            _primaryReserveOracle,
            _secondaryReserveOracle);

        externalRate = _effectiveTokensRate();
        externalRateUpdateTime = time();

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
      * @dev updates the current oracle deviation fee
      * can only be called by the contract owner
      *
      * @param _oracleDeviationFee new oracle deviation fee, represented in ppm
    */
    function setOracleDeviationFee(uint32 _oracleDeviationFee) public ownerOnly {
        require(_oracleDeviationFee <= PPM_RESOLUTION, "ERR_INVALID_ORACLE_DEVIATION_FEE");
        emit OracleDeviationFeeUpdate(oracleDeviationFee, _oracleDeviationFee);
        oracleDeviationFee = _oracleDeviationFee;
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
    function poolToken(IERC20Token _reserveToken) public view returns (IDSToken) {
        return reservesToPoolTokens[_reserveToken];
    }

    /**
      * @dev returns the maximum number of pool tokens that can currently be liquidated
      *
      * @param _poolToken   address of the pool token
      *
      * @return liquidation limit
    */
    function liquidationLimit(IDSToken _poolToken) public view returns (uint256) {
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
    function addReserve(IERC20Token _token, uint32 _weight) public override ownerOnly {
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
        override
        active
        validReserve(_sourceToken)
        validReserve(_targetToken)
        returns (uint256, uint256)
    {
        // validate input
        require(_sourceToken != _targetToken, "ERR_SAME_SOURCE_TARGET");

        uint32 sourceTokenWeight;
        uint32 targetTokenWeight;

        // if the rate was already checked in this block, use the current weights; otherwise, get the new weights
        if (externalRateUpdateTime == time()) {
            sourceTokenWeight = reserves[_sourceToken].weight;
            targetTokenWeight = PPM_RESOLUTION - sourceTokenWeight;
        }
        else {
            Fraction memory rate = _effectiveTokensRate();
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

        // return the target amount and the conversion fee using the updated reserve weights
        (uint256 targetAmount, , uint256 fee) = targetAmountAndFees(_sourceToken, _targetToken, sourceTokenWeight, targetTokenWeight, _amount);
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
    function doConvert(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount, address _trader, address payable _beneficiary)
        internal
        override
        active
        validReserve(_sourceToken)
        validReserve(_targetToken)
        returns (uint256)
    {
        // avoid updating the rate more than once per block
        if (externalRateUpdateTime < time()) {
            externalRateUpdateTime = time();
            externalRate = _effectiveTokensRate();
            rebalance();
        }

        uint32 sourceTokenWeight = reserves[_sourceToken].weight;
        uint32 targetTokenWeight = PPM_RESOLUTION - sourceTokenWeight;

        // get expected target amount and fees
        (uint256 amount, uint256 standardFee, uint256 totalFee) = targetAmountAndFees(_sourceToken, _targetToken, sourceTokenWeight, targetTokenWeight, _amount);

        // ensure that the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the input amount was already deposited
        if (_sourceToken == ETH_RESERVE_ADDRESS) {
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        }
        else {
            require(msg.value == 0 && _sourceToken.balanceOf(address(this)).sub(reserveBalance(_sourceToken)) >= _amount, "ERR_INVALID_AMOUNT");
        }

        // sync the reserve balances
        syncReserveBalance(_sourceToken);
        reserves[_targetToken].balance = reserveBalance(_targetToken).sub(amount);

        // update the target staked balance with the fee
        stakedBalances[_targetToken] = stakedBalances[_targetToken].add(standardFee);

        // transfer funds to the beneficiary in the to reserve token
        if (_targetToken == ETH_RESERVE_ADDRESS) {
            _beneficiary.transfer(amount);
        }
        else {
            safeTransfer(_targetToken, _beneficiary, amount);
        }

        // dispatch the conversion event
        dispatchConversionEvent(_sourceToken, _targetToken, _trader, _amount, amount, totalFee);

        // dispatch the rate event for the reserve tokens
        dispatchTokenRateUpdateEvent(_sourceToken, _targetToken, sourceTokenWeight, targetTokenWeight);

        // dispatch the rate event for the target reserve pool token
        // the target reserve pool token rate is the only one that's affected
        // by conversions since conversion fees are applied to the target reserve
        IDSToken targetPoolToken = reservesToPoolTokens[_targetToken];
        dispatchPoolTokenRateUpdateEvent(targetPoolToken, targetPoolToken.totalSupply(), _targetToken);

        // return the conversion result amount
        return amount;
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
        if (_reserveToken == ETH_RESERVE_ADDRESS) {
            reserves[ETH_RESERVE_ADDRESS].balance = reserves[ETH_RESERVE_ADDRESS].balance.sub(msg.value);
        }

        // get the reserve staked balance before adding the liquidity to it
        uint256 initialStakedBalance = stakedBalances[_reserveToken];

        // during the beta, ensure that the new staked balance isn't greater than the max limit
        if (maxStakedBalanceEnabled) {
            require(maxStakedBalances[_reserveToken] == 0 || initialStakedBalance.add(_amount) <= maxStakedBalances[_reserveToken], "ERR_MAX_STAKED_BALANCE_REACHED");
        }

        // get the pool token associated with the reserve and its supply
        IDSToken reservePoolToken = reservesToPoolTokens[_reserveToken];
        uint256 poolTokenSupply = reservePoolToken.totalSupply();

        // for non ETH reserve, transfer the funds from the user to the pool
        if (_reserveToken != ETH_RESERVE_ADDRESS)
            safeTransferFrom(_reserveToken, msg.sender, address(this), _amount);

        // sync the reserve balance / staked balance
        reserves[_reserveToken].balance = reserves[_reserveToken].balance.add(_amount);
        stakedBalances[_reserveToken] = initialStakedBalance.add(_amount);

        // calculate how many pool tokens to mint
        // for an empty pool, the price is 1:1, otherwise the price is based on the ratio
        // between the pool token supply and the staked balance
        uint256 poolTokenAmount = 0;
        if (initialStakedBalance == 0 || poolTokenSupply == 0) {
            poolTokenAmount = _amount;
        }
        else {
            poolTokenAmount = _amount.mul(poolTokenSupply).div(initialStakedBalance);
        }
        require(poolTokenAmount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // mint new pool tokens to the caller
        IPoolTokensContainer(address(anchor)).mint(reservePoolToken, msg.sender, poolTokenAmount);

        // rebalance the pool's reserve weights
        rebalance();

        // dispatch the `LiquidityAdded` event
        emit LiquidityAdded(msg.sender, _reserveToken, _amount, initialStakedBalance.add(_amount), poolTokenSupply.add(poolTokenAmount));

        // dispatch the rate event for the relevant pool token
        dispatchPoolTokenRateUpdateEvent(reservePoolToken, poolTokenSupply.add(poolTokenAmount), _reserveToken);

        // dispatch the rate event for the reserve tokens
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
    function removeLiquidity(IDSToken _poolToken, uint256 _amount, uint256 _minReturn)
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
        IPoolTokensContainer(address(anchor)).burn(_poolToken, msg.sender, _amount);

        // sync the reserve balance / staked balance
        reserves[reserveToken].balance = reserves[reserveToken].balance.sub(reserveAmount);
        uint256 newStakedBalance = stakedBalances[reserveToken].sub(reserveAmount);
        stakedBalances[reserveToken] = newStakedBalance;

        // transfer the reserve amount to the caller
        if (reserveToken == ETH_RESERVE_ADDRESS) {
            msg.sender.transfer(reserveAmount);
        }
        else {
            safeTransfer(reserveToken, msg.sender, reserveAmount);
        }

        // rebalance the pool's reserve weights
        rebalance();

        uint256 newPoolTokenSupply = initialPoolSupply.sub(_amount);

        // dispatch the `LiquidityRemoved` event
        emit LiquidityRemoved(msg.sender, reserveToken, reserveAmount, newStakedBalance, newPoolTokenSupply);

        // dispatch the rate event for the relevant pool token
        dispatchPoolTokenRateUpdateEvent(_poolToken, newPoolTokenSupply, reserveToken);

        // dispatch the rate event for the reserve tokens
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
    function removeLiquidityReturnAndFee(IDSToken _poolToken, uint256 _amount) public view returns (uint256, uint256) {
        uint256 totalSupply = _poolToken.totalSupply();
        uint256 stakedBalance = stakedBalances[poolTokensToReserves[_poolToken]];

        if (_amount < totalSupply) {
            uint256 x = stakedBalances[primaryReserveToken].mul(AMPLIFICATION_FACTOR);
            uint256 y = amplifiedBalance(primaryReserveToken);
            (uint256 min, uint256 max) = x < y ? (x, y) : (y, x);
            uint256 amountBeforeFee = _amount.mul(stakedBalance).div(totalSupply);
            uint256 amountAfterFee = amountBeforeFee.mul(min).div(max);
            return (amountAfterFee, amountBeforeFee - amountAfterFee);
        }
        return (stakedBalance, 0);
    }

    /**
      * @dev returns the expected target amount of converting one reserve to another along with the fees
      * this version of the function expects the reserve weights as an input (gas optimization)
      *
      * @param _sourceToken     contract address of the source reserve token
      * @param _targetToken     contract address of the target reserve token
      * @param _sourceWeight    source reserve token weight
      * @param _targetWeight    target reserve token weight
      * @param _amount          amount of tokens received from the user
      *
      * @return expected target amount
      * @return expected standard conversion fee
      * @return expected total conversion fee
    */
    function targetAmountAndFees(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint32 _sourceWeight,
        uint32 _targetWeight,
        uint256 _amount)
        private
        view
        returns (uint256, uint256, uint256)
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

        uint256 standardFee = calculateFee(targetAmount);
        uint256 totalFee = targetAmount.mul(oracleDeviationFee).div(PPM_RESOLUTION).add(standardFee);

        // return a tuple of [target amount minus total conversion fee, standard conversion fee, total conversion fee]
        return (targetAmount.sub(totalFee), standardFee, totalFee);
    }

    /**
      * @dev creates the converter's pool tokens
      * note that technically pool tokens can be created on deployment but gas limit
      * might get too high for a block, so creating them on first activation
      *
    */
    function createPoolTokens() internal {
        IPoolTokensContainer container = IPoolTokensContainer(address(anchor));
        IDSToken[] memory poolTokens = container.poolTokens();
        bool initialSetup = poolTokens.length == 0;

        uint256 reserveCount = reserveTokens.length;
        for (uint256 i = 0; i < reserveCount; i++) {
            IDSToken reservePoolToken;
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
      * @dev returns the effective rate between the two reserve tokens
      *
      * @return rate
    */
    function _effectiveTokensRate() private view returns (Fraction memory) {
        (uint256 latestRateN, uint256 latestRateD) = priceOracle.latestRate(primaryReserveToken, secondaryReserveToken);
        return Fraction({ n: latestRateN, d: latestRateD });
    }

    /**
      * @dev updates the pool's reserve weights with new values in order to push the current primary
      * reserve token balance to its staked balance
    */
    function rebalance() private {
        (reserves[primaryReserveToken].weight, reserves[secondaryReserveToken].weight) = effectiveReserveWeights(externalRate);
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
        uint256 primaryBalance = amplifiedBalance(primaryReserveToken);
        uint256 secondaryBalance = amplifiedBalance(secondaryReserveToken);

        // get the new weights
        return IBancorFormula(addressOf(BANCOR_FORMULA)).balancedWeights(
            primaryStakedBalance.mul(AMPLIFICATION_FACTOR),
            primaryBalance,
            secondaryBalance,
            _rate.n,
            _rate.d);
    }

    /**
      * @dev dispatches token rate update event for the reserve tokens
      *
      * @param _token1          contract address of the token to calculate the rate of one unit of
      * @param _token2          contract address of the token to calculate the rate of one `_token1` unit in
      * @param _token1Weight    reserve weight of token1
      * @param _token2Weight    reserve weight of token2
    */
    function dispatchTokenRateUpdateEvent(IERC20Token _token1, IERC20Token _token2, uint32 _token1Weight, uint32 _token2Weight) private {
        // get the amplified balances
        uint256 token1Balance = amplifiedBalance(_token1);
        uint256 token2Balance = amplifiedBalance(_token2);

        // get the first token weight
        if (_token1Weight == 0) {
            _token1Weight = reserves[_token1].weight;
        }

        // get the second token weight
        if (_token2Weight == 0) {
            _token2Weight = PPM_RESOLUTION - _token1Weight;
        }

        emit TokenRateUpdate(_token1, _token2, token2Balance.mul(_token1Weight), token1Balance.mul(_token2Weight));
    }

    /**
      * @dev dispatches token rate update event for one of the pool tokens
      *
      * @param _poolToken       address of the pool token
      * @param _poolTokenSupply total pool token supply
      * @param _reserveToken    address of the reserve token
    */
    function dispatchPoolTokenRateUpdateEvent(IDSToken _poolToken, uint256 _poolTokenSupply, IERC20Token _reserveToken) private {
        emit TokenRateUpdate(_poolToken, _reserveToken, stakedBalances[_reserveToken], _poolTokenSupply);
    }

    /**
      * @dev returns the current time
    */
    function time() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
