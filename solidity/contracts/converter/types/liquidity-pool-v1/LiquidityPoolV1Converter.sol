// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../LiquidityPoolConverter.sol";
import "../../../token/interfaces/ISmartToken.sol";

/**
  * @dev Liquidity Pool v1 Converter
  *
  * The liquidity pool v1 converter is a specialized version of a converter that manages
  * a classic bancor liquidity pool.
  *
  * Even though classic pools can have many reserves, the most common configuration of
  * the pool has 2 reserves with 50%/50% weights.
*/
contract LiquidityPoolV1Converter is LiquidityPoolConverter {
    IEtherToken internal etherToken = IEtherToken(0xc0829421C1d260BD3cB3E0F06cfE2D52db2cE315);

    /**
      * @dev triggered after a conversion with new price data
      * deprecated, use `TokenRateUpdate` from version 28 and up
      *
      * @param  _connectorToken     reserve token
      * @param  _tokenSupply        smart token supply
      * @param  _connectorBalance   reserve balance
      * @param  _connectorWeight    reserve weight
    */
    event PriceDataUpdate(
        IERC20Token indexed _connectorToken,
        uint256 _tokenSupply,
        uint256 _connectorBalance,
        uint32 _connectorWeight
    );

    /**
      * @dev initializes a new LiquidityPoolV1Converter instance
      *
      * @param  _token              pool token governed by the converter
      * @param  _registry           address of a contract registry contract
      * @param  _maxConversionFee   maximum conversion fee, represented in ppm
    */
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        LiquidityPoolConverter(_token, _registry, _maxConversionFee)
        public
    {
    }

    /**
      * @dev returns the converter type
      *
      * @return see the converter types in the the main contract doc
    */
    function converterType() public override pure returns (uint16) {
        return 1;
    }

    /**
      * @dev accepts ownership of the anchor after an ownership transfer
      * also activates the converter
      * can only be called by the contract owner
      * note that prior to version 28, you should use 'acceptTokenOwnership' instead
    */
    function acceptAnchorOwnership() public override ownerOnly {
        super.acceptAnchorOwnership();

        emit Activation(converterType(), anchor, true);
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
        override
        view
        active
        validReserve(_sourceToken)
        validReserve(_targetToken)
        returns (uint256, uint256)
    {
        // validate input
        require(_sourceToken != _targetToken, "ERR_SAME_SOURCE_TARGET");

        uint256 amount = IBancorFormula(addressOf(BANCOR_FORMULA)).crossReserveTargetAmount(
            reserveBalance(_sourceToken),
            reserves[_sourceToken].weight,
            reserveBalance(_targetToken),
            reserves[_targetToken].weight,
            _amount
        );

        // return the amount minus the conversion fee and the conversion fee
        uint256 fee = calculateFee(amount);
        return (amount - fee, fee);
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
        returns (uint256)
    {
        // get expected target amount and fee
        (uint256 amount, uint256 fee) = targetAmountAndFee(_sourceToken, _targetToken, _amount);

        // ensure that the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the trade won't deplete the reserve balance
        assert(amount < reserveBalance(_targetToken));

        // ensure that the input amount was already deposited
        if (_sourceToken == ETH_RESERVE_ADDRESS)
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        else
            require(msg.value == 0 && _sourceToken.balanceOf(address(this)).sub(reserveBalance(_sourceToken)) >= _amount, "ERR_INVALID_AMOUNT");

        // sync the reserve balances
        syncReserveBalance(_sourceToken);
        reserves[_targetToken].balance = reserves[_targetToken].balance.sub(amount);

        // transfer funds to the beneficiary in the to reserve token
        if (_targetToken == ETH_RESERVE_ADDRESS)
            _beneficiary.transfer(amount);
        else
            safeTransfer(_targetToken, _beneficiary, amount);

        uint256 poolTokenSupply = ISmartToken(address(anchor)).totalSupply();
        uint256 sourceReserveBalance = reserveBalance(_sourceToken);
        uint256 targetReserveBalance = reserveBalance(_targetToken);
        uint32 sourceReserveWeight = reserves[_sourceToken].weight;
        uint32 targetReserveWeight = reserves[_targetToken].weight;

        // dispatch the conversion event
        dispatchConversionEvent(_sourceToken, _targetToken, _trader, _amount, amount, fee);

        // dispatch token rate update event
        uint256 rateN = targetReserveBalance.mul(sourceReserveWeight);
        uint256 rateD = sourceReserveBalance.mul(targetReserveWeight);
        emit TokenRateUpdate(_sourceToken, _targetToken, rateN, rateD);

        // dispatch the `TokenRateUpdate` event for the pool token
        dispatchPoolTokenRateEvent(_sourceToken, sourceReserveBalance, poolTokenSupply, sourceReserveWeight);
        dispatchPoolTokenRateEvent(_targetToken, targetReserveBalance, poolTokenSupply, targetReserveWeight);

        // dispatch price data update events (deprecated events)
        emit PriceDataUpdate(_sourceToken, poolTokenSupply, sourceReserveBalance, sourceReserveWeight);
        emit PriceDataUpdate(_targetToken, poolTokenSupply, targetReserveBalance, targetReserveWeight);

        return amount;
    }

    /**
      * @dev increases the pool's liquidity and mints new shares in the pool to the caller
      * note that prior to version 28, you should use 'fund' instead
      *
      * @param _reserveTokens   address of each reserve token
      * @param _reserveAmounts  amount of each reserve token
      * @param _minReturn       token minimum return-amount
    */
    function addLiquidity(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts, uint256 _minReturn)
        public
        payable
        protected
        active
    {
        // verify the user input
        verifyLiquidityInput(_reserveTokens, _reserveAmounts, _minReturn);

        // if one of the reserves is ETH, then verify that the input amount of ETH is equal to the input value of ETH
        for (uint256 i = 0; i < _reserveTokens.length; i++)
            if (_reserveTokens[i] == ETH_RESERVE_ADDRESS)
                require(_reserveAmounts[i] == msg.value, "ERR_ETH_AMOUNT_MISMATCH");

        // if the input value of ETH is larger than zero, then verify that one of the reserves is ETH
        if (msg.value > 0) {
            require(reserves[ETH_RESERVE_ADDRESS].isSet, "ERR_NO_ETH_RESERVE");
        }

        // get the total supply
        uint256 totalSupply = ISmartToken(address(anchor)).totalSupply();

        // transfer from the user an equally-worth amount of each one of the reserve tokens
        uint256 amount = addLiquidityToPool(_reserveTokens, _reserveAmounts, totalSupply);

        // verify that the equivalent amount of tokens is equal to or larger than the user's expectation
        require(amount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // issue the tokens to the user
        ISmartToken(address(anchor)).issue(msg.sender, amount);
    }

    /**
      * @dev decreases the pool's liquidity and burns the caller's shares in the pool
      * note that prior to version 28, you should use 'liquidate' instead
      *
      * @param _amount                  token amount
      * @param _reserveTokens           address of each reserve token
      * @param _reserveMinReturnAmounts minimum return-amount of each reserve token
    */
    function removeLiquidity(uint256 _amount, IERC20Token[] memory _reserveTokens, uint256[] memory _reserveMinReturnAmounts)
        public
        protected
        active
    {
        // verify the user input
        verifyLiquidityInput(_reserveTokens, _reserveMinReturnAmounts, _amount);

        // get the total supply BEFORE destroying the user tokens
        uint256 totalSupply = ISmartToken(address(anchor)).totalSupply();

        // destroy the user tokens
        ISmartToken(address(anchor)).destroy(msg.sender, _amount);

        // transfer to the user an equivalent amount of each one of the reserve tokens
        removeLiquidityFromPool(_reserveTokens, _reserveMinReturnAmounts, totalSupply, _amount);
    }

    /**
      * @dev increases the pool's liquidity and mints new shares in the pool to the caller
      * for example, if the caller increases the supply by 10%,
      * then it will cost an amount equal to 10% of each reserve token balance
      * note that starting from version 28, you should use 'addLiquidity' instead
      *
      * @param _amount  amount to increase the supply by (in the pool token)
    */
    function fund(uint256 _amount) public payable protected {
        syncReserveBalances();
        reserves[ETH_RESERVE_ADDRESS].balance = reserves[ETH_RESERVE_ADDRESS].balance.sub(msg.value);

        uint256 supply = ISmartToken(address(anchor)).totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));

        // iterate through the reserve tokens and transfer a percentage equal to the weight between
        // _amount and the total supply in each reserve from the caller to the converter
        uint256 reserveCount = reserveTokens.length;
        for (uint256 i = 0; i < reserveCount; i++) {
            IERC20Token reserveToken = reserveTokens[i];
            uint256 rsvBalance = reserves[reserveToken].balance;
            uint256 reserveAmount = formula.fundCost(supply, rsvBalance, reserveRatio, _amount);

            // transfer funds from the caller in the reserve token
            if (reserveToken == ETH_RESERVE_ADDRESS) {
                if (msg.value > reserveAmount) {
                    msg.sender.transfer(msg.value - reserveAmount);
                }
                else if (msg.value < reserveAmount) {
                    require(msg.value == 0, "ERR_INVALID_ETH_VALUE");
                    safeTransferFrom(etherToken, msg.sender, address(this), reserveAmount);
                    etherToken.withdraw(reserveAmount);
                }
            }
            else {
                safeTransferFrom(reserveToken, msg.sender, address(this), reserveAmount);
            }

            // sync the reserve balance
            uint256 newReserveBalance = rsvBalance.add(reserveAmount);
            reserves[reserveToken].balance = newReserveBalance;

            uint256 newPoolTokenSupply = supply.add(_amount);

            // dispatch liquidity update for the pool token/reserve
            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, newReserveBalance, newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateEvent(reserveToken, newReserveBalance, newPoolTokenSupply, reserves[reserveToken].weight);
        }

        // issue new funds to the caller in the pool token
        ISmartToken(address(anchor)).issue(msg.sender, _amount);
    }

    /**
      * @dev decreases the pool's liquidity and burns the caller's shares in the pool
      * for example, if the holder sells 10% of the supply,
      * then they will receive 10% of each reserve token balance in return
      * note that starting from version 28, you should use 'removeLiquidity' instead
      *
      * @param _amount  amount to liquidate (in the pool token)
    */
    function liquidate(uint256 _amount) public protected {
        require(_amount > 0, "ERR_ZERO_AMOUNT");

        uint256 totalSupply = ISmartToken(address(anchor)).totalSupply();
        ISmartToken(address(anchor)).destroy(msg.sender, _amount);

        uint256[] memory reserveMinReturnAmounts = new uint256[](reserveTokens.length);
        for (uint256 i = 0; i < reserveMinReturnAmounts.length; i++)
            reserveMinReturnAmounts[i] = 1;

        removeLiquidityFromPool(reserveTokens, reserveMinReturnAmounts, totalSupply, _amount);
    }

    /**
      * @dev verifies that a given array of tokens is identical to the converter's array of reserve tokens
      * we take this input in order to allow specifying the corresponding reserve amounts in any order
      *
      * @param _reserveTokens   array of reserve tokens
      * @param _reserveAmounts  array of reserve amounts
      * @param _amount          token amount
    */
    function verifyLiquidityInput(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts, uint256 _amount) private view {
        uint256 i;
        uint256 j;

        uint256 length = reserveTokens.length;
        require(length == _reserveTokens.length, "ERR_INVALID_RESERVE");
        require(length == _reserveAmounts.length, "ERR_INVALID_AMOUNT");

        for (i = 0; i < length; i++) {
            // verify that every input reserve token is included in the reserve tokens
            require(reserves[_reserveTokens[i]].isSet, "ERR_INVALID_RESERVE");
            for (j = 0; j < length; j++) {
                if (reserveTokens[i] == _reserveTokens[j])
                    break;
            }
            // verify that every reserve token is included in the input reserve tokens
            require(j < length, "ERR_INVALID_RESERVE");
            // verify that every input reserve token amount is larger than zero
            require(_reserveAmounts[i] > 0, "ERR_INVALID_AMOUNT");
        }

        // verify that the input token amount is larger than zero
        require(_amount > 0, "ERR_ZERO_AMOUNT");
    }

    /**
      * @dev adds liquidity (reserve) to the pool
      *
      * @param _reserveTokens   address of each reserve token
      * @param _reserveAmounts  amount of each reserve token
      * @param _totalSupply     token total supply
    */
    function addLiquidityToPool(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts, uint256 _totalSupply)
        private
        returns (uint256)
    {
        if (_totalSupply == 0)
            return addLiquidityToEmptyPool(_reserveTokens, _reserveAmounts);
        return addLiquidityToNonEmptyPool(_reserveTokens, _reserveAmounts, _totalSupply);
    }

    /**
      * @dev adds liquidity (reserve) to the pool when it's empty
      *
      * @param _reserveTokens   address of each reserve token
      * @param _reserveAmounts  amount of each reserve token
    */
    function addLiquidityToEmptyPool(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts)
        private
        returns (uint256)
    {
        // calculate the geometric-mean of the reserve amounts approved by the user
        uint256 amount = geometricMean(_reserveAmounts);

        // transfer each one of the reserve amounts from the user to the pool
        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            IERC20Token reserveToken = _reserveTokens[i];
            uint256 reserveAmount = _reserveAmounts[i];

            if (reserveToken != ETH_RESERVE_ADDRESS) // ETH has already been transferred as part of the transaction
                safeTransferFrom(reserveToken, msg.sender, address(this), reserveAmount);

            reserves[reserveToken].balance = reserveAmount;

            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, reserveAmount, amount);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateEvent(reserveToken, reserveAmount, amount, reserves[reserveToken].weight);
        }

        return amount;
    }

    /**
      * @dev adds liquidity (reserve) to the pool when it's not empty
      *
      * @param _reserveTokens   address of each reserve token
      * @param _reserveAmounts  amount of each reserve token
      * @param _totalSupply     token total supply
    */
    function addLiquidityToNonEmptyPool(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts, uint256 _totalSupply)
        private
        returns (uint256)
    {
        syncReserveBalances();
        reserves[ETH_RESERVE_ADDRESS].balance = reserves[ETH_RESERVE_ADDRESS].balance.sub(msg.value);

        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 amount = getMinShare(formula, _totalSupply, _reserveTokens, _reserveAmounts);
        uint256 newPoolTokenSupply = _totalSupply.add(amount);

        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            IERC20Token reserveToken = _reserveTokens[i];
            uint256 rsvBalance = reserves[reserveToken].balance;
            uint256 reserveAmount = formula.fundCost(_totalSupply, rsvBalance, reserveRatio, amount);
            require(reserveAmount > 0, "ERR_ZERO_TARGET_AMOUNT");
            assert(reserveAmount <= _reserveAmounts[i]);

            // transfer each one of the reserve amounts from the user to the pool
            if (reserveToken != ETH_RESERVE_ADDRESS) // ETH has already been transferred as part of the transaction
                safeTransferFrom(reserveToken, msg.sender, address(this), reserveAmount);
            else if (_reserveAmounts[i] > reserveAmount) // transfer the extra amount of ETH back to the user
                msg.sender.transfer(_reserveAmounts[i] - reserveAmount);

            uint256 newReserveBalance = rsvBalance.add(reserveAmount);
            reserves[reserveToken].balance = newReserveBalance;

            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, newReserveBalance, newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateEvent(reserveToken, newReserveBalance, newPoolTokenSupply, reserves[reserveToken].weight);
        }

        return amount;
    }

    /**
      * @dev removes liquidity (reserve) from the pool
      *
      * @param _reserveTokens           address of each reserve token
      * @param _reserveMinReturnAmounts minimum return-amount of each reserve token
      * @param _totalSupply             token total supply
      * @param _amount                  token amount
    */
    function removeLiquidityFromPool(IERC20Token[] memory _reserveTokens, uint256[] memory _reserveMinReturnAmounts, uint256 _totalSupply, uint256 _amount)
        private
    {
        syncReserveBalances();

        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 newPoolTokenSupply = _totalSupply.sub(_amount);

        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            IERC20Token reserveToken = _reserveTokens[i];
            uint256 rsvBalance = reserves[reserveToken].balance;
            uint256 reserveAmount = formula.liquidateReserveAmount(_totalSupply, rsvBalance, reserveRatio, _amount);
            require(reserveAmount >= _reserveMinReturnAmounts[i], "ERR_ZERO_TARGET_AMOUNT");

            uint256 newReserveBalance = rsvBalance.sub(reserveAmount);
            reserves[reserveToken].balance = newReserveBalance;

            // transfer each one of the reserve amounts from the pool to the user
            if (reserveToken == ETH_RESERVE_ADDRESS)
                msg.sender.transfer(reserveAmount);
            else
                safeTransfer(reserveToken, msg.sender, reserveAmount);

            emit LiquidityRemoved(msg.sender, reserveToken, reserveAmount, newReserveBalance, newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateEvent(reserveToken, newReserveBalance, newPoolTokenSupply, reserves[reserveToken].weight);
        }
    }

    function getMinShare(IBancorFormula formula, uint256 _totalSupply, IERC20Token[] memory _reserveTokens, uint256[] memory _reserveAmounts) private view returns (uint256) {
        uint256 minIndex = 0;
        for (uint256 i = 1; i < _reserveTokens.length; i++) {
            if (_reserveAmounts[i].mul(reserves[_reserveTokens[minIndex]].balance) < _reserveAmounts[minIndex].mul(reserves[_reserveTokens[i]].balance))
                minIndex = i;
        }
        return formula.fundSupplyAmount(_totalSupply, reserves[_reserveTokens[minIndex]].balance, reserveRatio, _reserveAmounts[minIndex]);
    }

    /**
      * @dev calculates the number of decimal digits in a given value
      *
      * @param _x   value (assumed positive)
      * @return the number of decimal digits in the given value
    */
    function decimalLength(uint256 _x) public pure returns (uint256) {
        uint256 y = 0;
        for (uint256 x = _x; x > 0; x /= 10)
            y++;
        return y;
    }

    /**
      * @dev calculates the nearest integer to a given quotient
      *
      * @param _n   quotient numerator
      * @param _d   quotient denominator
      * @return the nearest integer to the given quotient
    */
    function roundDiv(uint256 _n, uint256 _d) public pure returns (uint256) {
        return (_n + _d / 2) / _d;
    }

    /**
      * @dev calculates the average number of decimal digits in a given list of values
      *
      * @param _values  list of values (each of which assumed positive)
      * @return the average number of decimal digits in the given list of values
    */
    function geometricMean(uint256[] memory _values) public pure returns (uint256) {
        uint256 numOfDigits = 0;
        uint256 length = _values.length;
        for (uint256 i = 0; i < length; i++)
            numOfDigits += decimalLength(_values[i]);
        return uint256(10) ** (roundDiv(numOfDigits, length) - 1);
    }

    /**
      * @dev dispatches the `TokenRateUpdate` for the pool token
      *
      * @param _reserveToken    address of the reserve token
      * @param _reserveBalance  reserve balance
      * @param _poolTokenSupply total pool token supply
      * @param _reserveWeight   reserve weight
    */
    function dispatchPoolTokenRateEvent(IERC20Token _reserveToken, uint256 _reserveBalance, uint256 _poolTokenSupply, uint32 _reserveWeight) private {
        emit TokenRateUpdate(ISmartToken(address(anchor)), _reserveToken, _reserveBalance.mul(PPM_RESOLUTION), _poolTokenSupply.mul(_reserveWeight));
    }
}
