// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../standard-pool/StandardPoolConverter.sol";

/**
 * @dev This contract is a specialized version of the converter, which implements
 * a constant conversion-rate (configurable by the owner of the converter).
 */
contract FixedRatePoolConverter is StandardPoolConverter {
    mapping(IERC20Token => uint256) private _rate;

    /**
     * @dev initializes a new FixedRatePoolConverter instance
     *
     * @param  _anchor             anchor governed by the converter
     * @param  _registry           address of a contract registry contract
     * @param  _maxConversionFee   maximum conversion fee, represented in ppm
     */
    constructor(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public StandardPoolConverter(_anchor, _registry, _maxConversionFee) {}

    /**
     * @dev returns the converter type
     *
     * @return see the converter types in the the main contract doc
     */
    function converterType() public pure override returns (uint16) {
        return 4;
    }

    /**
     * @dev defines a new reserve token for the converter
     * can only be called by the owner while the converter is inactive
     *
     * @param _token   address of the reserve token
     * @param _weight  reserve weight, represented in ppm, 1-1000000
     */
    function addReserve(IERC20Token _token, uint32 _weight) public override {
        super.addReserve(_token, _weight);
        _rate[_token] = 1;
    }

    /**
     * @dev returns the worth of the 1st reserve token in units of the 2nd reserve token
     *
     * @return the numerator of the rate between the 1st reserve token and the 2nd reserve token
     * @return the denominator of the rate between the 1st reserve token and the 2nd reserve token
     */
    function rate() public view returns (uint256, uint256) {
        return (_rate[__reserveTokens[0]], _rate[__reserveTokens[1]]);
    }

    /**
     * @dev sets the worth of the 1st reserve token in units of the 2nd reserve token
     * can be executed only by the owner of the converter
     *
     * @param rateN the numerator of the rate between the 1st reserve token and the 2nd reserve token
     * @param rateD the denominator of the rate between the 1st reserve token and the 2nd reserve token
     */
    function setRate(uint256 rateN, uint256 rateD) public ownerOnly {
        require(rateN > 0 && rateD > 0, "ERR_INVALID_RATE");
        _rate[__reserveTokens[0]] = rateN;
        _rate[__reserveTokens[1]] = rateD;
    }

    /**
     * @dev returns the expected amount and expected fee for converting one reserve to another
     *
     * @param _sourceToken address of the source reserve token contract
     * @param _targetToken address of the target reserve token contract
     * @param _amount      amount of source reserve tokens converted
     *
     * @return expected amount in units of the target reserve token
     * @return expected fee in units of the target reserve token
     */
    function targetAmountAndFee(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint256 _amount
    ) public view override active returns (uint256, uint256) {
        uint256 rateN = _rate[_sourceToken];
        uint256 rateD = _rate[_targetToken];
    
        uint256 amount = _amount.mul(rateN).div(rateD);

        uint256 fee = calculateFee(amount);

        return (amount - fee, fee);
    }

    /**
     * @dev returns the required amount and expected fee for converting one reserve to another
     *
     * @param _sourceToken address of the source reserve token contract
     * @param _targetToken address of the target reserve token contract
     * @param _amount      amount of target reserve tokens desired
     *
     * @return required amount in units of the source reserve token
     * @return expected fee in units of the target reserve token
     */
    function sourceAmountAndFee(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint256 _amount
    ) public view override active returns (uint256, uint256) {
        uint256 rateN = _rate[_sourceToken];
        uint256 rateD = _rate[_targetToken];
    
        uint256 fee = calculateFeeInv(_amount);

        uint256 amount = _amount.add(fee).mul(rateD).div(rateN);

        return (amount, fee);
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
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint256 _amount,
        address _trader,
        address payable _beneficiary
    ) internal override returns (uint256) {
        // update the recent average rate
        updateRecentAverageRate();

        uint256 sourceId = __reserveIds[_sourceToken];
        uint256 targetId = __reserveIds[_targetToken];

        (uint256 sourceBalance, uint256 targetBalance) = reserveBalances(sourceId, targetId);

        // get the target amount minus the conversion fee and the conversion fee
        (uint256 amount, uint256 fee) = targetAmountAndFee(_sourceToken, _targetToken, _amount);

        // ensure that the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        // ensure that the trade won't deplete the reserve balance
        assert(amount < targetBalance);

        // ensure that the input amount was already deposited
        uint256 actualSourceBalance;
        if (_sourceToken == ETH_RESERVE_ADDRESS) {
            actualSourceBalance = address(this).balance;
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        } else {
            actualSourceBalance = _sourceToken.balanceOf(address(this));
            require(msg.value == 0 && actualSourceBalance.sub(sourceBalance) >= _amount, "ERR_INVALID_AMOUNT");
        }

        // sync the reserve balances
        setReserveBalances(sourceId, targetId, actualSourceBalance, targetBalance - amount);

        // transfer funds to the beneficiary in the to reserve token
        if (_targetToken == ETH_RESERVE_ADDRESS) {
            _beneficiary.transfer(amount);
        } else {
            safeTransfer(_targetToken, _beneficiary, amount);
        }

        // dispatch the conversion event
        dispatchConversionEvent(_sourceToken, _targetToken, _trader, _amount, amount, fee);

        // dispatch rate updates
        dispatchTokenRateUpdateEvents(_sourceToken, _targetToken, actualSourceBalance, targetBalance - amount);

        return amount;
    }

    /**
     * @dev increases the pool's liquidity and mints new shares in the pool to the caller
     *
     * @param _reserveTokens   address of each reserve token
     * @param _reserveAmounts  amount of each reserve token
     * @param _minReturn       token minimum return-amount
     *
     * @return amount of pool tokens issued
     */
    function addLiquidity(
        IERC20Token[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _minReturn
    ) public payable override protected active returns (uint256) {
        // verify the user input
        verifyLiquidityInput(_reserveTokens, _reserveAmounts, _minReturn);

        // if one of the reserves is ETH, then verify that the input amount of ETH is equal to the input value of ETH
        for (uint256 i = 0; i < 2; i++) {
            if (_reserveTokens[i] == ETH_RESERVE_ADDRESS) {
                require(_reserveAmounts[i] == msg.value, "ERR_ETH_AMOUNT_MISMATCH");
            }
        }

        // if the input value of ETH is larger than zero, then verify that one of the reserves is ETH
        if (msg.value > 0) {
            require(__reserveIds[ETH_RESERVE_ADDRESS] != 0, "ERR_NO_ETH_RESERVE");
        }

        // save a local copy of the pool token
        IDSToken poolToken = IDSToken(address(anchor));

        // get the total supply
        uint256 totalSupply = poolToken.totalSupply();

        // sync the balances to ensure no mismatch
        syncReserveBalances(msg.value);

        uint256[2] memory oldReserveBalances;
        uint256[2] memory newReserveBalances;
        (oldReserveBalances[0], oldReserveBalances[1]) = reserveBalances();

        uint256 amount;
        uint256[] memory reserveAmounts = new uint256[](2);
        for (uint256 i = 0; i < 2; i++) {
            reserveAmounts[i] = _reserveAmounts[i];
        }

        // calculate the amount of pool tokens to mint
        if (totalSupply == 0) {
            amount = MathEx.geometricMean(reserveAmounts);
        } else {
            uint256 rateN = _rate[_reserveTokens[0]];
            uint256 rateD = _rate[_reserveTokens[1]];
            uint256 n = reserveAmounts[0].mul(rateN).add(reserveAmounts[1]).mul(rateD);
            uint256 d = oldReserveBalances[0].mul(rateN).add(oldReserveBalances[1]).mul(rateD);
            amount = totalSupply.mul(n).div(d);
        }

        uint256 newPoolTokenSupply = totalSupply.add(amount);
        for (uint256 i = 0; i < 2; i++) {
            IERC20Token reserveToken = _reserveTokens[i];
            uint256 reserveAmount = reserveAmounts[i];
            require(reserveAmount > 0, "ERR_ZERO_TARGET_AMOUNT");
            assert(reserveAmount <= _reserveAmounts[i]);

            // transfer each one of the reserve amounts from the user to the pool
            if (reserveToken != ETH_RESERVE_ADDRESS) {
                // ETH has already been transferred as part of the transaction
                safeTransferFrom(reserveToken, msg.sender, address(this), reserveAmount);
            } else if (_reserveAmounts[i] > reserveAmount) {
                // transfer the extra amount of ETH back to the user
                msg.sender.transfer(_reserveAmounts[i] - reserveAmount);
            }

            // save the new reserve balance
            newReserveBalances[i] = oldReserveBalances[i].add(reserveAmount);

            emit LiquidityAdded(msg.sender, reserveToken, reserveAmount, newReserveBalances[i], newPoolTokenSupply);

            // dispatch the `TokenRateUpdate` event for the pool token
            emit TokenRateUpdate(poolToken, reserveToken, newReserveBalances[i], newPoolTokenSupply);
        }

        // set the reserve balances
        setReserveBalances(1, 2, newReserveBalances[0], newReserveBalances[1]);

        // verify that the equivalent amount of tokens is equal to or larger than the user's expectation
        require(amount >= _minReturn, "ERR_RETURN_TOO_LOW");

        // issue the tokens to the user
        poolToken.issue(msg.sender, amount);

        // return the amount of pool tokens issued
        return amount;
    }

    /**
     * @dev verifies that a given array of tokens is identical to the converter's array of reserve tokens
     * we take this input in order to allow specifying the corresponding reserve amounts in any order
     * this function rearranges the input arrays according to the converter's array of reserve tokens
     *
     * @param _reserveTokens   array of reserve tokens
     * @param _reserveAmounts  array of reserve amounts
     * @param _amount          token amount
     *
     * @return true if the function has rearranged the input arrays; false otherwise
     */
    function verifyLiquidityInput(
        IERC20Token[] memory _reserveTokens,
        uint256[] memory _reserveAmounts,
        uint256 _amount
    ) internal view override returns (bool) {
        require(_amount > 0, "ERR_ZERO_AMOUNT");

        uint256 reserve0Id = __reserveIds[_reserveTokens[0]];
        uint256 reserve1Id = __reserveIds[_reserveTokens[1]];

        if (reserve0Id == 2 && reserve1Id == 1) {
            IERC20Token tempReserveToken = _reserveTokens[0];
            _reserveTokens[0] = _reserveTokens[1];
            _reserveTokens[1] = tempReserveToken;
            uint256 tempReserveAmount = _reserveAmounts[0];
            _reserveAmounts[0] = _reserveAmounts[1];
            _reserveAmounts[1] = tempReserveAmount;
            return true;
        }

        require(reserve0Id == 1 && reserve1Id == 2, "ERR_INVALID_RESERVE");
        return false;
    }
}
