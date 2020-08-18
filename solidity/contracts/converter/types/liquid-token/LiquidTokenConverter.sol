pragma solidity 0.4.26;
import "../../ConverterBase.sol";
import "../../../token/interfaces/ISmartToken.sol";

/**
  * @dev Liquid Token Converter
  *
  * The liquid token converter is a specialized version of a converter that manages a liquid token.
  *
  * The converters govern a token with a single reserve and allow converting between the two.
  * Liquid tokens usually have fractional reserve (reserve ratio smaller than 100%).
*/
contract LiquidTokenConverter is ConverterBase {
    /**
      * @dev initializes a new LiquidTokenConverter instance
      *
      * @param  _token              liquid token governed by the converter
      * @param  _registry           address of a contract registry contract
      * @param  _maxConversionFee   maximum conversion fee, represented in ppm
    */
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        ConverterBase(_token, _registry, _maxConversionFee)
        public
    {
    }

    /**
      * @dev returns the converter type
      *
      * @return see the converter types in the the main contract doc
    */
    function converterType() public pure returns (uint16) {
        return 0;
    }

    /**
      * @dev accepts ownership of the anchor after an ownership transfer
      * also activates the converter
      * can only be called by the contract owner
      * note that prior to version 28, you should use 'acceptTokenOwnership' instead
    */
    function acceptAnchorOwnership() public ownerOnly {
        super.acceptAnchorOwnership();

        emit Activation(converterType(), anchor, true);
    }

    /**
      * @dev defines the reserve token for the converter
      * can only be called by the owner while the converter is inactive and the
      * reserve wasn't defined yet
      *
      * @param _token   address of the reserve token
      * @param _weight  reserve weight, represented in ppm, 1-1000000
    */
    function addReserve(IERC20Token _token, uint32 _weight) public {
        // verify that the converter doesn't have a reserve yet
        require(reserveTokenCount() == 0, "ERR_INVALID_RESERVE_COUNT");
        super.addReserve(_token, _weight);
    }

    /**
      * @dev returns the expected target amount of converting the source token to the
      * target token along with the fee
      *
      * @param _sourceToken contract address of the source token
      * @param _targetToken contract address of the target token
      * @param _amount      amount of tokens received from the user
      *
      * @return expected target amount
      * @return expected fee
    */
    function targetAmountAndFee(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount) public view returns (uint256, uint256) {
        if (_targetToken == ISmartToken(anchor) && reserves[_sourceToken].isSet)
            return purchaseTargetAmount(_amount);
        if (_sourceToken == ISmartToken(anchor) && reserves[_targetToken].isSet)
            return saleTargetAmount(_amount);

        // invalid input
        revert("ERR_INVALID_TOKEN");
    }

    /**
      * @dev converts between the liquid token and its reserve
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
        returns (uint256)
    {
        uint256 targetAmount;
        IERC20Token reserveToken;

        if (_targetToken == ISmartToken(anchor) && reserves[_sourceToken].isSet) {
            reserveToken = _sourceToken;
            targetAmount = buy(_amount, _trader, _beneficiary);
        }
        else if (_sourceToken == ISmartToken(anchor) && reserves[_targetToken].isSet) {
            reserveToken = _targetToken;
            targetAmount = sell(_amount, _trader, _beneficiary);
        }
        else {
            // invalid input
            revert("ERR_INVALID_TOKEN");
        }

        // dispatch rate update for the liquid token
        uint256 totalSupply = ISmartToken(anchor).totalSupply();
        uint32 reserveWeight = reserves[reserveToken].weight;
        emit TokenRateUpdate(anchor, reserveToken, reserveBalance(reserveToken).mul(PPM_RESOLUTION), totalSupply.mul(reserveWeight));

        return targetAmount;
    }

    /**
      * @dev returns the expected target amount of buying with a given amount of tokens
      *
      * @param _amount  amount of reserve tokens to get the target amount for
      *
      * @return amount of liquid tokens that the user will receive
      * @return amount of liquid tokens that the user will pay as fee
    */
    function purchaseTargetAmount(uint256 _amount)
        internal
        view
        active
        returns (uint256, uint256)
    {
        uint256 totalSupply = ISmartToken(anchor).totalSupply();

        // if the current supply is zero, then return the input amount divided by the normalized reserve-weight
        if (totalSupply == 0)
            return (_amount.mul(PPM_RESOLUTION).div(reserves[reserveToken].weight), 0);

        IERC20Token reserveToken = reserveTokens[0];
        uint256 amount = IBancorFormula(addressOf(BANCOR_FORMULA)).purchaseTargetAmount(
            totalSupply,
            reserveBalance(reserveToken),
            reserves[reserveToken].weight,
            _amount
        );

        // return the amount minus the conversion fee and the conversion fee
        uint256 fee = calculateFee(amount);
        return (amount - fee, fee);
    }

    /**
      * @dev returns the expected target amount of selling a given amount of tokens
      *
      * @param _amount  amount of liquid tokens to get the target amount for
      *
      * @return expected reserve tokens
      * @return expected fee
    */
    function saleTargetAmount(uint256 _amount)
        internal
        view
        active
        returns (uint256, uint256)
    {
        uint256 totalSupply = ISmartToken(anchor).totalSupply();

        IERC20Token reserveToken = reserveTokens[0];

        // if selling the entire supply, then return the entire reserve
        if (totalSupply == _amount)
            return (reserveBalance(reserveToken), 0);

        uint256 amount = IBancorFormula(addressOf(BANCOR_FORMULA)).saleTargetAmount(
            totalSupply,
            reserveBalance(reserveToken),
            reserves[reserveToken].weight,
            _amount
        );

        // return the amount minus the conversion fee and the conversion fee
        uint256 fee = calculateFee(amount);
        return (amount - fee, fee);
    }

    /**
      * @dev buys the liquid token by depositing in its reserve
      *
      * @param _amount      amount of reserve token to buy the token for
      * @param _trader      address of the caller who executed the conversion
      * @param _beneficiary wallet to receive the conversion result
      *
      * @return amount of liquid tokens received
    */
    function buy(uint256 _amount, address _trader, address _beneficiary) internal returns (uint256) {
        // get expected target amount and fee
        (uint256 amount, uint256 fee) = purchaseTargetAmount(_amount);

        // ensure the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        IERC20Token reserveToken = reserveTokens[0];

        // ensure that the input amount was already deposited
        if (reserveToken == ETH_RESERVE_ADDRESS)
            require(msg.value == _amount, "ERR_ETH_AMOUNT_MISMATCH");
        else
            require(msg.value == 0 && reserveToken.balanceOf(this).sub(reserveBalance(reserveToken)) >= _amount, "ERR_INVALID_AMOUNT");

        // sync the reserve balance
        syncReserveBalance(reserveToken);

        // issue new funds to the beneficiary in the liquid token
        ISmartToken(anchor).issue(_beneficiary, amount);

        // dispatch the conversion event
        dispatchConversionEvent(reserveToken, ISmartToken(anchor), _trader, _amount, amount, fee);

        return amount;
    }

    /**
      * @dev sells the liquid token by withdrawing from its reserve
      *
      * @param _amount      amount of liquid tokens to sell
      * @param _trader      address of the caller who executed the conversion
      * @param _beneficiary wallet to receive the conversion result
      *
      * @return amount of reserve tokens received
    */
    function sell(uint256 _amount, address _trader, address _beneficiary) internal returns (uint256) {
        // ensure that the input amount was already deposited
        require(_amount <= ISmartToken(anchor).balanceOf(this), "ERR_INVALID_AMOUNT");

        // get expected target amount and fee
        (uint256 amount, uint256 fee) = saleTargetAmount(_amount);

        // ensure the trade gives something in return
        require(amount != 0, "ERR_ZERO_TARGET_AMOUNT");

        IERC20Token reserveToken = reserveTokens[0];

        // ensure that the trade will only deplete the reserve balance if the total supply is depleted as well
        uint256 tokenSupply = ISmartToken(anchor).totalSupply();
        uint256 rsvBalance = reserveBalance(reserveToken);
        assert(amount < rsvBalance || (amount == rsvBalance && _amount == tokenSupply));

        // destroy the tokens from the converter balance in the liquid token
        ISmartToken(anchor).destroy(this, _amount);

        // update the reserve balance
        reserves[reserveToken].balance = reserves[reserveToken].balance.sub(amount);

        // transfer funds to the beneficiary in the reserve token
        if (reserveToken == ETH_RESERVE_ADDRESS)
            _beneficiary.transfer(amount);
        else
            safeTransfer(reserveToken, _beneficiary, amount);

        // dispatch the conversion event
        dispatchConversionEvent(ISmartToken(anchor), reserveToken, _trader, _amount, amount, fee);

        return amount;
    }
}
