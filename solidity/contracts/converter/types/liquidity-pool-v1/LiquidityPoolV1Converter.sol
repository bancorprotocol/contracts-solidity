// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../LiquidityPoolConverter.sol";
import "../../../token/interfaces/IDSToken.sol";
import "../../../utility/MathEx.sol";
import "../../../utility/Time.sol";
import "../../../utility/Types.sol";

/**
 * @dev This contract is a specialized version of a converter that manages
 * a classic bancor liquidity pool.
 *
 * Even though pools can have many reserves, the standard pool configuration
 * is 2 reserves with 50%/50% weights.
 */
contract LiquidityPoolV1Converter is LiquidityPoolConverter, Time {
    using SafeERC20 for IERC20;
    using MathEx for *;

    uint256 internal constant MAX_RATE_FACTOR_LOWER_BOUND = 1e30;

    // the period of time taken into account when calculating the recent average rate
    uint256 private constant AVERAGE_RATE_PERIOD = 10 minutes;

    // true if the pool is a 2 reserves / 50%/50% weights pool, false otherwise
    bool public isStandardPool = false;

    // only used in standard pools
    Fraction public prevAverageRate; // average rate after the previous conversion (1 reserve token 0 in reserve token 1 units)
    uint256 public prevAverageRateUpdateTime; // last time when the previous rate was updated (in seconds)

    /**
     * @dev initializes a new LiquidityPoolV1Converter instance
     *
     * @param  _token              pool token governed by the converter
     * @param  _registry           address of a contract registry contract
     * @param  _maxConversionFee   maximum conversion fee, represented in ppm
     */
    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public LiquidityPoolConverter(_token, _registry, _maxConversionFee) {}

    /**
     * @dev returns the converter type
     *
     * @return see the converter types in the the main contract doc
     */
    function converterType() public pure override returns (uint16) {
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
     * @dev defines a new reserve token for the converter
     * can only be called by the owner while the converter is inactive
     *
     * @param _token   address of the reserve token
     * @param _weight  reserve weight, represented in ppm, 1-1000000
     */
    function addReserve(IERC20 _token, uint32 _weight) public override ownerOnly {
        super.addReserve(_token, _weight);

        isStandardPool =
            reserveTokens.length == 2 &&
            reserves[reserveTokens[0]].weight == PPM_RESOLUTION / 2 &&
            reserves[reserveTokens[1]].weight == PPM_RESOLUTION / 2;
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
    function targetAmountAndFee(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256 _amount
    ) public view override active validReserve(_sourceToken) validReserve(_targetToken) returns (uint256, uint256) {
        // validate input
        require(_sourceToken != _targetToken, "ERR_SAME_SOURCE_TARGET");

        uint256 amount =
            IBancorFormula(addressOf(BANCOR_FORMULA)).crossReserveTargetAmount(
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
     *
     * @param _sourceToken source ERC20 token
     * @param _targetToken target ERC20 token
     * @param _amount      amount of tokens to convert (in units of the source token)
     * @param _trader      address of the caller who executed the conversion
     * @param _beneficiary wallet to receive the conversion result
     *
     * @return amount of tokens received (in units of the target token)
     */
    function doConvert(
        IERC20 _sourceToken,
        IERC20 _targetToken,
        uint256 _amount,
        address _trader,
        address payable _beneficiary
    ) internal override returns (uint256) {
        // update the recent average rate
        if (isStandardPool && prevAverageRateUpdateTime < time()) {
            prevAverageRate = recentAverageRate();
            prevAverageRateUpdateTime = time();
        }

        // get expected target amount and fee
        (uint256 amount, uint256 fee) = targetAmountAndFee(_sourceToken, _targetToken, _amount);

        // ensure that the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the trade won't deplete the reserve balance
        assert(amount < reserveBalance(_targetToken));

        // ensure that the input amount was already deposited
        if (_sourceToken == NATIVE_TOKEN_ADDRESS) {
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        } else {
            require(
                msg.value == 0 && _sourceToken.balanceOf(address(this)).sub(reserveBalance(_sourceToken)) >= _amount,
                "ERR_INVALID_AMOUNT"
            );
        }

        // sync the reserve balances
        syncReserveBalance(_sourceToken);
        reserves[_targetToken].balance = reserves[_targetToken].balance.sub(amount);

        // transfer funds to the beneficiary in the to reserve token
        if (_targetToken == NATIVE_TOKEN_ADDRESS) {
            _beneficiary.transfer(amount);
        } else {
            _targetToken.safeTransfer(_beneficiary, amount);
        }

        // dispatch the conversion event
        dispatchConversionEvent(_sourceToken, _targetToken, _trader, _amount, amount, fee);

        // dispatch rate updates
        dispatchTokenRateUpdateEvents(_sourceToken, _targetToken);

        return amount;
    }

    /**
     * @dev returns the recent average rate of 1 `_token` in the other reserve token units
     * note that the rate can only be queried for reserves in a standard pool
     *
     * @param _token   token to get the rate for
     * @return recent average rate between the reserves (numerator)
     * @return recent average rate between the reserves (denominator)
     */
    function recentAverageRate(IERC20 _token) external view validReserve(_token) returns (uint256, uint256) {
        // verify that the pool is standard
        require(isStandardPool, "ERR_NON_STANDARD_POOL");

        // get the recent average rate of reserve 0
        Fraction memory rate = recentAverageRate();
        if (_token == reserveTokens[0]) {
            return (rate.n, rate.d);
        }

        return (rate.d, rate.n);
    }

    /**
     * @dev returns the recent average rate of 1 reserve token 0 in reserve token 1 units
     *
     * @return recent average rate between the reserves
     */
    function recentAverageRate() internal view returns (Fraction memory) {
        // get the elapsed time since the previous average rate was calculated
        uint256 timeElapsed = time() - prevAverageRateUpdateTime;

        // if the previous average rate was calculated in the current block, return it
        if (timeElapsed == 0) {
            return prevAverageRate;
        }

        // get the current rate between the reserves
        uint256 currentRateN = reserves[reserveTokens[1]].balance;
        uint256 currentRateD = reserves[reserveTokens[0]].balance;

        // if the previous average rate was calculated a while ago, the average rate is equal to the current rate
        if (timeElapsed >= AVERAGE_RATE_PERIOD) {
            return Fraction({ n: currentRateN, d: currentRateD });
        }

        // given N as the sampling window, the new rate is calculated according to the following formula:
        // newRate = prevAverageRate + timeElapsed * [currentRate - prevAverageRate] / N

        // calculate the numerator and the denumerator of the new rate
        Fraction memory prevAverage = prevAverageRate;

        // if the previous average rate was never calculated, the average rate is equal to the current rate
        if (prevAverage.n == 0 && prevAverage.d == 0) {
            return Fraction({ n: currentRateN, d: currentRateD });
        }

        uint256 x = prevAverage.d.mul(currentRateN);
        uint256 y = prevAverage.n.mul(currentRateD);

        // since we know that timeElapsed < AVERAGE_RATE_PERIOD, we can avoid using SafeMath:
        uint256 newRateN = y.mul(AVERAGE_RATE_PERIOD - timeElapsed).add(x.mul(timeElapsed));
        uint256 newRateD = prevAverage.d.mul(currentRateD).mul(AVERAGE_RATE_PERIOD);

        (newRateN, newRateD) = MathEx.reducedRatio(newRateN, newRateD, MAX_RATE_FACTOR_LOWER_BOUND);
        return Fraction({ n: newRateN, d: newRateD });
    }

    /**
     * @dev increases the pool's liquidity and mints new shares in the pool to the caller
     * note that prior to version 28, you should use 'fund' instead
     *
     * @param _reserveTokens   address of each reserve token
     * @param _reserveAmounts  amount of each reserve token
     * @param _minReturn       token minimum return-amount
     *
     * @return amount of pool tokens issued
     */
    function addLiquidity(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _minReturn
    ) public payable protected active returns (uint256) {
        // verify the user input
        verifyLiquidityInput(_reserveTokens, _reserveAmounts, _minReturn);

        // if one of the reserves is ETH, then verify that the input amount of ETH is equal to the input value of ETH
        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            if (_reserveTokens[i] == NATIVE_TOKEN_ADDRESS) {
                require(_reserveAmounts[i] == msg.value, "ERR_ETH_AMOUNT_MISMATCH");
            }
        }

        // if the input value of ETH is larger than zero, then verify that one of the reserves is ETH
        if (msg.value > 0) {
            require(reserves[NATIVE_TOKEN_ADDRESS].isSet, "ERR_NO_ETH_RESERVE");
        }

        // get the total supply
        uint256 totalSupply = IDSToken(address(anchor)).totalSupply();

        // transfer from the user an equally-worth amount of each one of the reserve tokens
        uint256 amount = addLiquidityToPool(_reserveTokens, _reserveAmounts, totalSupply);

        // verify that the equivalent amount of tokens is equal to or larger than the user's expectation
        require(amount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // issue the tokens to the user
        IDSToken(address(anchor)).issue(msg.sender, amount);

        // return the amount of pool tokens issued
        return amount;
    }

    /**
     * @dev decreases the pool's liquidity and burns the caller's shares in the pool
     * note that prior to version 28, you should use 'liquidate' instead
     *
     * @param _amount                  token amount
     * @param _reserveTokens           address of each reserve token
     * @param _reserveMinReturnAmounts minimum return-amount of each reserve token
     *
     * @return the amount of each reserve token granted for the given amount of pool tokens
     */
    function removeLiquidity(
        uint256 _amount,
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveMinReturnAmounts
    ) public protected active returns (uint256[] memory) {
        // verify the user input
        verifyLiquidityInput(_reserveTokens, _reserveMinReturnAmounts, _amount);

        // get the total supply BEFORE destroying the user tokens
        uint256 totalSupply = IDSToken(address(anchor)).totalSupply();

        // destroy the user tokens
        IDSToken(address(anchor)).destroy(msg.sender, _amount);

        // transfer to the user an equivalent amount of each one of the reserve tokens
        return removeLiquidityFromPool(_reserveTokens, _reserveMinReturnAmounts, totalSupply, _amount);
    }

    /**
     * @dev increases the pool's liquidity and mints new shares in the pool to the caller
     * for example, if the caller increases the supply by 10%,
     * then it will cost an amount equal to 10% of each reserve token balance
     * note that starting from version 28, you should use 'addLiquidity' instead
     *
     * @param _amount  amount to increase the supply by (in the pool token)
     *
     * @return amount of pool tokens issued
     */
    function fund(uint256 _amount) public payable protected returns (uint256) {
        syncReserveBalances();
        reserves[NATIVE_TOKEN_ADDRESS].balance = reserves[NATIVE_TOKEN_ADDRESS].balance.sub(msg.value);

        uint256 supply = IDSToken(address(anchor)).totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));

        // iterate through the reserve tokens and transfer a percentage equal to the weight between
        // _amount and the total supply in each reserve from the caller to the converter
        uint256 reserveCount = reserveTokens.length;
        for (uint256 i = 0; i < reserveCount; i++) {
            IERC20 reserveToken = reserveTokens[i];
            uint256 rsvBalance = reserves[reserveToken].balance;
            uint256 reserveAmount = formula.fundCost(supply, rsvBalance, reserveRatio, _amount);

            // transfer funds from the caller in the reserve token
            if (reserveToken == NATIVE_TOKEN_ADDRESS) {
                if (msg.value > reserveAmount) {
                    msg.sender.transfer(msg.value - reserveAmount);
                } else {
                    require(msg.value == reserveAmount, "ERR_INVALID_ETH_VALUE");
                }
            } else {
                reserveToken.safeTransferFrom(msg.sender, address(this), reserveAmount);
            }

            // sync the reserve balance
            uint256 newReserveBalance = rsvBalance.add(reserveAmount);
            reserves[reserveToken].balance = newReserveBalance;

            uint256 newPoolTokenSupply = supply.add(_amount);

            // dispatch liquidity update for the pool token/reserve
            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, newReserveBalance, newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateUpdateEvent(
                newPoolTokenSupply,
                reserveToken,
                newReserveBalance,
                reserves[reserveToken].weight
            );
        }

        // issue new funds to the caller in the pool token
        IDSToken(address(anchor)).issue(msg.sender, _amount);

        // return the amount of pool tokens issued
        return _amount;
    }

    /**
     * @dev decreases the pool's liquidity and burns the caller's shares in the pool
     * for example, if the holder sells 10% of the supply,
     * then they will receive 10% of each reserve token balance in return
     * note that starting from version 28, you should use 'removeLiquidity' instead
     *
     * @param _amount  amount to liquidate (in the pool token)
     *
     * @return the amount of each reserve token granted for the given amount of pool tokens
     */
    function liquidate(uint256 _amount) public protected returns (uint256[] memory) {
        require(_amount > 0, "ERR_ZERO_AMOUNT");

        uint256 totalSupply = IDSToken(address(anchor)).totalSupply();
        IDSToken(address(anchor)).destroy(msg.sender, _amount);

        uint256[] memory reserveMinReturnAmounts = new uint256[](reserveTokens.length);
        for (uint256 i = 0; i < reserveMinReturnAmounts.length; i++) reserveMinReturnAmounts[i] = 1;

        return removeLiquidityFromPool(reserveTokens, reserveMinReturnAmounts, totalSupply, _amount);
    }

    /**
     * @dev given the amount of one of the reserve tokens to add liquidity of,
     * returns the required amount of each one of the other reserve tokens
     * since an empty pool can be funded with any list of non-zero input amounts,
     * this function assumes that the pool is not empty (has already been funded)
     *
     * @param _reserveTokens       address of each reserve token
     * @param _reserveTokenIndex   index of the relevant reserve token
     * @param _reserveAmount       amount of the relevant reserve token
     *
     * @return the required amount of each one of the reserve tokens
     */
    function addLiquidityCost(
        IERC20[] memory _reserveTokens,
        uint256 _reserveTokenIndex,
        uint256 _reserveAmount
    ) public view returns (uint256[] memory) {
        uint256[] memory reserveAmounts = new uint256[](_reserveTokens.length);

        uint256 totalSupply = IDSToken(address(anchor)).totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 amount =
            formula.fundSupplyAmount(
                totalSupply,
                reserves[_reserveTokens[_reserveTokenIndex]].balance,
                reserveRatio,
                _reserveAmount
            );

        for (uint256 i = 0; i < reserveAmounts.length; i++)
            reserveAmounts[i] = formula.fundCost(
                totalSupply,
                reserves[_reserveTokens[i]].balance,
                reserveRatio,
                amount
            );

        return reserveAmounts;
    }

    /**
     * @dev given the amount of one of the reserve tokens to add liquidity of,
     * returns the amount of pool tokens entitled for it
     * since an empty pool can be funded with any list of non-zero input amounts,
     * this function assumes that the pool is not empty (has already been funded)
     *
     * @param _reserveToken    address of the reserve token
     * @param _reserveAmount   amount of the reserve token
     *
     * @return the amount of pool tokens entitled
     */
    function addLiquidityReturn(IERC20 _reserveToken, uint256 _reserveAmount) public view returns (uint256) {
        uint256 totalSupply = IDSToken(address(anchor)).totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        return formula.fundSupplyAmount(totalSupply, reserves[_reserveToken].balance, reserveRatio, _reserveAmount);
    }

    /**
     * @dev returns the amount of each reserve token entitled for a given amount of pool tokens
     *
     * @param _amount          amount of pool tokens
     * @param _reserveTokens   address of each reserve token
     *
     * @return the amount of each reserve token entitled for the given amount of pool tokens
     */
    function removeLiquidityReturn(uint256 _amount, IERC20[] memory _reserveTokens)
        public
        view
        returns (uint256[] memory)
    {
        uint256 totalSupply = IDSToken(address(anchor)).totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        return removeLiquidityReserveAmounts(_amount, _reserveTokens, totalSupply, formula);
    }

    /**
     * @dev verifies that a given array of tokens is identical to the converter's array of reserve tokens
     * we take this input in order to allow specifying the corresponding reserve amounts in any order
     *
     * @param _reserveTokens   array of reserve tokens
     * @param _reserveAmounts  array of reserve amounts
     * @param _amount          token amount
     */
    function verifyLiquidityInput(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _amount
    ) private view {
        uint256 i;
        uint256 j;

        uint256 length = reserveTokens.length;
        require(length == _reserveTokens.length, "ERR_INVALID_RESERVES");
        require(length == _reserveAmounts.length, "ERR_INVALID_AMOUNTS");

        for (i = 0; i < length; i++) {
            // verify that every input reserve token is included in the reserve tokens
            require(reserves[_reserveTokens[i]].isSet, "ERR_INVALID_RESERVE");
            for (j = 0; j < length; j++) {
                if (reserveTokens[i] == _reserveTokens[j]) {
                    break;
                }
            }
            // verify that every reserve token is included in the input reserve tokens
            require(j < length, "ERR_INVALID_RESERVE");
            // verify that every input reserve token amount is larger than zero
            require(_reserveAmounts[i] > 0, "ERR_ZERO_AMOUNT");
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
     *
     * @return amount of pool tokens issued
     */
    function addLiquidityToPool(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _totalSupply
    ) private returns (uint256) {
        if (_totalSupply == 0) {
            return addLiquidityToEmptyPool(_reserveTokens, _reserveAmounts);
        }
        return addLiquidityToNonEmptyPool(_reserveTokens, _reserveAmounts, _totalSupply);
    }

    /**
     * @dev adds liquidity (reserve) to the pool when it's empty
     *
     * @param _reserveTokens   address of each reserve token
     * @param _reserveAmounts  amount of each reserve token
     *
     * @return amount of pool tokens issued
     */
    function addLiquidityToEmptyPool(IERC20[] memory _reserveTokens, uint256[] memory _reserveAmounts)
        private
        returns (uint256)
    {
        // calculate the geometric-mean of the reserve amounts approved by the user
        uint256 amount = MathEx.geometricMean(_reserveAmounts);

        // transfer each one of the reserve amounts from the user to the pool
        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            IERC20 reserveToken = _reserveTokens[i];
            uint256 reserveAmount = _reserveAmounts[i];

            if (reserveToken != NATIVE_TOKEN_ADDRESS) {
                // ETH has already been transferred as part of the transaction
                reserveToken.safeTransferFrom(msg.sender, address(this), reserveAmount);
            }

            reserves[reserveToken].balance = reserveAmount;

            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, reserveAmount, amount);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateUpdateEvent(amount, reserveToken, reserveAmount, reserves[reserveToken].weight);
        }

        // return the amount of pool tokens issued
        return amount;
    }

    /**
     * @dev adds liquidity (reserve) to the pool when it's not empty
     *
     * @param _reserveTokens   address of each reserve token
     * @param _reserveAmounts  amount of each reserve token
     * @param _totalSupply     token total supply
     *
     * @return amount of pool tokens issued
     */
    function addLiquidityToNonEmptyPool(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _totalSupply
    ) private returns (uint256) {
        syncReserveBalances();
        reserves[NATIVE_TOKEN_ADDRESS].balance = reserves[NATIVE_TOKEN_ADDRESS].balance.sub(msg.value);

        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 amount = getMinShare(formula, _totalSupply, _reserveTokens, _reserveAmounts);
        uint256 newPoolTokenSupply = _totalSupply.add(amount);

        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            IERC20 reserveToken = _reserveTokens[i];
            uint256 rsvBalance = reserves[reserveToken].balance;
            uint256 reserveAmount = formula.fundCost(_totalSupply, rsvBalance, reserveRatio, amount);
            require(reserveAmount > 0, "ERR_ZERO_TARGET_AMOUNT");
            assert(reserveAmount <= _reserveAmounts[i]);

            // transfer each one of the reserve amounts from the user to the pool
            if (reserveToken != NATIVE_TOKEN_ADDRESS) {
                // ETH has already been transferred as part of the transaction
                reserveToken.safeTransferFrom(msg.sender, address(this), reserveAmount);
            } else if (_reserveAmounts[i] > reserveAmount) {
                // transfer the extra amount of ETH back to the user
                msg.sender.transfer(_reserveAmounts[i] - reserveAmount);
            }

            uint256 newReserveBalance = rsvBalance.add(reserveAmount);
            reserves[reserveToken].balance = newReserveBalance;

            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, newReserveBalance, newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateUpdateEvent(
                newPoolTokenSupply,
                reserveToken,
                newReserveBalance,
                reserves[reserveToken].weight
            );
        }

        // return the amount of pool tokens issued
        return amount;
    }

    /**
     * @dev removes liquidity (reserve) from the pool
     *
     * @param _reserveTokens           address of each reserve token
     * @param _reserveMinReturnAmounts minimum return-amount of each reserve token
     * @param _totalSupply             token total supply
     * @param _amount                  token amount
     *
     * @return the amount of each reserve token granted for the given amount of pool tokens
     */
    function removeLiquidityFromPool(
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveMinReturnAmounts,
        uint256 _totalSupply,
        uint256 _amount
    ) private returns (uint256[] memory) {
        syncReserveBalances();

        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 newPoolTokenSupply = _totalSupply.sub(_amount);
        uint256[] memory reserveAmounts = removeLiquidityReserveAmounts(_amount, _reserveTokens, _totalSupply, formula);

        for (uint256 i = 0; i < _reserveTokens.length; i++) {
            IERC20 reserveToken = _reserveTokens[i];
            uint256 reserveAmount = reserveAmounts[i];
            require(reserveAmount >= _reserveMinReturnAmounts[i], "ERR_ZERO_TARGET_AMOUNT");

            uint256 newReserveBalance = reserves[reserveToken].balance.sub(reserveAmount);
            reserves[reserveToken].balance = newReserveBalance;

            // transfer each one of the reserve amounts from the pool to the user
            if (reserveToken == NATIVE_TOKEN_ADDRESS) {
                msg.sender.transfer(reserveAmount);
            } else {
                reserveToken.safeTransfer(msg.sender, reserveAmount);
            }

            emit LiquidityRemoved(msg.sender, reserveToken, reserveAmount, newReserveBalance, newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            dispatchPoolTokenRateUpdateEvent(
                newPoolTokenSupply,
                reserveToken,
                newReserveBalance,
                reserves[reserveToken].weight
            );
        }

        // return the amount of each reserve token granted for the given amount of pool tokens
        return reserveAmounts;
    }

    /**
     * @dev returns the amount of each reserve token entitled for a given amount of pool tokens
     *
     * @param _amount          amount of pool tokens
     * @param _reserveTokens   address of each reserve token
     * @param _totalSupply     token total supply
     * @param _formula         formula contract
     *
     * @return the amount of each reserve token entitled for the given amount of pool tokens
     */
    function removeLiquidityReserveAmounts(
        uint256 _amount,
        IERC20[] memory _reserveTokens,
        uint256 _totalSupply,
        IBancorFormula _formula
    ) private view returns (uint256[] memory) {
        uint256[] memory reserveAmounts = new uint256[](_reserveTokens.length);
        for (uint256 i = 0; i < reserveAmounts.length; i++)
            reserveAmounts[i] = _formula.liquidateReserveAmount(
                _totalSupply,
                reserves[_reserveTokens[i]].balance,
                reserveRatio,
                _amount
            );
        return reserveAmounts;
    }

    function getMinShare(
        IBancorFormula formula,
        uint256 _totalSupply,
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveAmounts
    ) private view returns (uint256) {
        uint256 minIndex = 0;
        uint256 minBalance = reserves[_reserveTokens[0]].balance;
        for (uint256 index = 1; index < _reserveTokens.length; index++) {
            uint256 balance = reserves[_reserveTokens[index]].balance;
            if (_reserveAmounts[index].mul(minBalance) < _reserveAmounts[minIndex].mul(balance)) {
                minIndex = index;
                minBalance = balance;
            }
        }
        return formula.fundSupplyAmount(_totalSupply, minBalance, reserveRatio, _reserveAmounts[minIndex]);
    }

    /**
     * @dev dispatches token rate update events for the reserve tokens and the pool token
     *
     * @param _sourceToken address of the source reserve token
     * @param _targetToken address of the target reserve token
     */
    function dispatchTokenRateUpdateEvents(IERC20 _sourceToken, IERC20 _targetToken) private {
        uint256 poolTokenSupply = IDSToken(address(anchor)).totalSupply();
        uint256 sourceReserveBalance = reserveBalance(_sourceToken);
        uint256 targetReserveBalance = reserveBalance(_targetToken);
        uint32 sourceReserveWeight = reserves[_sourceToken].weight;
        uint32 targetReserveWeight = reserves[_targetToken].weight;

        // dispatch token rate update event for the reserve tokens
        uint256 rateN = targetReserveBalance.mul(sourceReserveWeight);
        uint256 rateD = sourceReserveBalance.mul(targetReserveWeight);
        emit TokenRateUpdate(_sourceToken, _targetToken, rateN, rateD);

        // dispatch token rate update events for the pool token
        dispatchPoolTokenRateUpdateEvent(poolTokenSupply, _sourceToken, sourceReserveBalance, sourceReserveWeight);
        dispatchPoolTokenRateUpdateEvent(poolTokenSupply, _targetToken, targetReserveBalance, targetReserveWeight);
    }

    /**
     * @dev dispatches token rate update event for the pool token
     *
     * @param _poolTokenSupply total pool token supply
     * @param _reserveToken    address of the reserve token
     * @param _reserveBalance  reserve balance
     * @param _reserveWeight   reserve weight
     */
    function dispatchPoolTokenRateUpdateEvent(
        uint256 _poolTokenSupply,
        IERC20 _reserveToken,
        uint256 _reserveBalance,
        uint32 _reserveWeight
    ) private {
        emit TokenRateUpdate(
            IDSToken(address(anchor)),
            _reserveToken,
            _reserveBalance.mul(PPM_RESOLUTION),
            _poolTokenSupply.mul(_reserveWeight)
        );
    }
}
