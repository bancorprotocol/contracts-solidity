pragma solidity 0.4.26;
import "./ConverterBase.sol";
import "./interfaces/ITypedConverterFactory.sol";
import "../token/interfaces/ISmartToken.sol";

/*
    LiquidTokenConverter Factory
*/
contract LiquidTokenConverterFactory is ITypedConverterFactory {
    /**
      * @dev returns the converter type the factory is associated with
      *
      * @return converter type
    */
    function converterType() public pure returns (uint16) {
        return 0;
    }

    /**
      * @dev creates a new converter with the given arguments and transfers
      * the ownership to the caller
      *
      * @param _anchor            anchor governed by the converter
      * @param _registry          address of a contract registry contract
      * @param _maxConversionFee  maximum conversion fee, represented in ppm
      *
      * @return a new converter
    */
    function createConverter(IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter) {
        ConverterBase converter = new LiquidTokenConverter(ISmartToken(_anchor), _registry, _maxConversionFee);
        converter.transferOwnership(msg.sender);
        return converter;
    }
}

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
      * @dev returns the expected rate of converting the source token to the
      * target token along with the fee
      *
      * @param _sourceToken contract address of the source token
      * @param _targetToken contract address of the target token
      * @param _amount      amount of tokens received from the user
      *
      * @return expected rate
      * @return expected fee
    */
    function rateAndFee(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount) public view returns (uint256, uint256) {
        if (_targetToken == ISmartToken(anchor) && reserves[_sourceToken].isSet)
            return purchaseRate(_amount);
        if (_sourceToken == ISmartToken(anchor) && reserves[_targetToken].isSet)
            return saleRate(_amount);

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
      * @param _beneficiary wallet to receive the conversion result
      *
      * @return amount of tokens received (in units of the target token)
    */
    function convert(IERC20Token _sourceToken, IERC20Token _targetToken, uint256 _amount, address _trader, address _beneficiary)
        public
        payable
        returns (uint256)
    {
        // call the parent to verify input
        super.convert(_sourceToken, _targetToken, _amount, _trader, _beneficiary);

        if (_targetToken == ISmartToken(anchor) && reserves[_sourceToken].isSet)
            return buy(_amount, _beneficiary);
        if (_sourceToken == ISmartToken(anchor) && reserves[_targetToken].isSet)
            return sell(_amount, _beneficiary);

        // invalid input
        revert("ERR_INVALID_TOKEN");
    }

    /**
      * @dev returns the expected return of buying with a given amount of tokens
      *
      * @param _amount  amount of reserve tokens to get the rate for
      *
      * @return amount of liquid tokens that the user will receive
      * @return amount of liquid tokens that the user will pay as fee
    */
    function purchaseRate(uint256 _amount)
        internal
        view
        active
        returns (uint256, uint256)
    {
        uint256 totalSupply = ISmartToken(anchor).totalSupply();

        // special case for buying the initial supply
        if (totalSupply == 0)
            return (_amount, 0);

        IERC20Token reserveToken = reserveTokens[0];
        uint256 amount = IBancorFormula(addressOf(BANCOR_FORMULA)).purchaseRate(
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
      * @dev returns the expected return of selling a given amount of tokens
      *
      * @param _amount  amount of liquid tokens to get the rate for
      *
      * @return expected reserve tokens
      * @return expected fee
    */
    function saleRate(uint256 _amount)
        internal
        view
        active
        returns (uint256, uint256)
    {
        uint256 totalSupply = ISmartToken(anchor).totalSupply();

        IERC20Token reserveToken = reserveTokens[0];

        // special case for selling the entire supply - return the entire reserve
        if (totalSupply == _amount)
            return (reserveBalance(reserveToken), 0);

        uint256 amount = IBancorFormula(addressOf(BANCOR_FORMULA)).saleRate(
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
      * @param _beneficiary wallet to receive the conversion result
      *
      * @return amount of liquid tokens received
    */
    function buy(uint256 _amount, address _beneficiary) internal returns (uint256) {
        // get expected rate and fee
        (uint256 amount, uint256 fee) = purchaseRate(_amount);

        // ensure the trade gives something in return
        require(amount != 0, "ERR_ZERO_RATE");

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
        dispatchConversionEvent(reserveToken, ISmartToken(anchor), _amount, amount, fee);

        // dispatch price data update for the liquid token/reserve
        emit PriceDataUpdate(reserveToken, ISmartToken(anchor).totalSupply(), reserveBalance(reserveToken), reserves[reserveToken].weight);

        return amount;
    }

    /**
      * @dev sells the liquid token by withdrawing from its reserve
      *
      * @param _amount      amount of liquid tokens to sell
      * @param _beneficiary wallet to receive the conversion result
      *
      * @return amount of reserve tokens received
    */
    function sell(uint256 _amount, address _beneficiary) internal returns (uint256) {
        // ensure that the input amount was already deposited
        require(_amount <= ISmartToken(anchor).balanceOf(this), "ERR_INVALID_AMOUNT");

        // get expected rate and fee
        (uint256 amount, uint256 fee) = saleRate(_amount);

        // ensure the trade gives something in return
        require(amount != 0, "ERR_ZERO_RATE");

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
        dispatchConversionEvent(ISmartToken(anchor), reserveToken, _amount, amount, fee);

        // dispatch price data update for the liquid token/reserve
        emit PriceDataUpdate(reserveToken, ISmartToken(anchor).totalSupply(), reserveBalance(reserveToken), reserves[reserveToken].weight);

        return amount;
    }
}
