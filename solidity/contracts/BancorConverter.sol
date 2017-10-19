pragma solidity ^0.4.11;
import './SmartTokenController.sol';
import './Managed.sol';
import './Utils.sol';
import './interfaces/ITokenConverter.sol';
import './interfaces/ISmartToken.sol';
import './interfaces/IBancorConverterExtensions.sol';
import './interfaces/IEtherToken.sol';

/*
    Bancor Converter v0.4

    The Bancor version of the token converter, allows conversion between a smart token and other ERC20 tokens and between different ERC20 tokens and themselves.

    ERC20 reserve token balance can be virtual, meaning that the calculations are based on the virtual balance instead of relying on
    the actual reserve balance. This is a security mechanism that prevents the need to keep a very large (and valuable) balance in a single contract.

    The converter is upgradable (just like any SmartTokenController).

    WARNING: It is NOT RECOMMENDED to use the converter with Smart Tokens that have less than 8 decimal digits
             or with very small numbers because of precision loss


    Open issues:
    - Front-running attacks are currently mitigated by the following mechanisms:
        - minimum return argument for each conversion provides a way to define a minimum/maximum price for the transaction
        - gas price limit prevents users from having control over the order of execution
      Other potential solutions might include a commit/reveal based schemes
    - Possibly add getters for reserve fields so that the client won't need to rely on the order in the struct
*/
contract BancorConverter is ITokenConverter, SmartTokenController, Managed {
    uint32 private constant MAX_CRR = 1000000;
    uint32 private constant MAX_CONVERSION_FEE = 1000000;

    struct Reserve {
        uint256 virtualBalance;         // virtual balance
        uint32 ratio;                   // constant reserve ratio (CRR), represented in ppm, 1-1000000
        bool isVirtualBalanceEnabled;   // true if virtual balance is enabled, false if not
        bool isPurchaseEnabled;         // is purchase of the smart token enabled with the reserve, can be set by the owner
        bool isSet;                     // used to tell if the mapping element is defined
    }

    string public version = '0.4';
    string public converterType = 'bancor';

    IBancorConverterExtensions public extensions;   // bancor converter extensions contract
    IERC20Token[] public reserveTokens;             // ERC20 standard token addresses
    IERC20Token[] public quickBuyPath;              // conversion path that's used in order to buy the token with ETH
    mapping (address => Reserve) public reserves;   // reserve token addresses -> reserve data
    uint32 private totalReserveRatio = 0;           // used to efficiently prevent increasing the total reserve ratio above 100%
    uint32 public maxConversionFee = 0;             // maximum conversion fee for the lifetime of the contract, represented in ppm, 0...1000000 (0 = no fee, 100 = 0.01%, 1000000 = 100%)
    uint32 public conversionFee = 0;                // current conversion fee, represented in ppm, 0...maxConversionFee
    bool public conversionsEnabled = true;          // true if token conversions is enabled, false if not

    // triggered when a conversion between two tokens occurs (TokenConverter event)
    event Conversion(address indexed _fromToken, address indexed _toToken, address indexed _trader, uint256 _amount, uint256 _return,
                     uint256 _currentPriceN, uint256 _currentPriceD);

    /**
        @dev constructor

        @param  _token              smart token governed by the converter
        @param  _extensions         address of a bancor converter extensions contract
        @param  _maxConversionFee   maximum conversion fee, represented in ppm
        @param  _reserveToken       optional, initial reserve, allows defining the first reserve at deployment time
        @param  _reserveRatio       optional, ratio for the initial reserve
    */
    function BancorConverter(ISmartToken _token, IBancorConverterExtensions _extensions, uint32 _maxConversionFee, IERC20Token _reserveToken, uint32 _reserveRatio)
        SmartTokenController(_token)
        validAddress(_extensions)
        validMaxConversionFee(_maxConversionFee)
    {
        extensions = _extensions;
        maxConversionFee = _maxConversionFee;

        if (address(_reserveToken) != 0x0)
            addReserve(_reserveToken, _reserveRatio, false);
    }

    // validates a reserve token address - verifies that the address belongs to one of the reserve tokens
    modifier validReserve(IERC20Token _address) {
        require(reserves[_address].isSet);
        _;
    }

    // validates a token address - verifies that the address belongs to one of the convertible tokens
    modifier validToken(IERC20Token _address) {
        require(_address == token || reserves[_address].isSet);
        _;
    }

    // verifies that the gas price is lower than the universal limit
    modifier validGasPrice() {
        assert(tx.gasprice <= extensions.gasPriceLimit().gasPrice());
        _;
    }

    // validates maximum conversion fee
    modifier validMaxConversionFee(uint32 _conversionFee) {
        require(_conversionFee >= 0 && _conversionFee <= MAX_CONVERSION_FEE);
        _;
    }

    // validates conversion fee
    modifier validConversionFee(uint32 _conversionFee) {
        require(_conversionFee >= 0 && _conversionFee <= maxConversionFee);
        _;
    }

    // validates reserve ratio range
    modifier validReserveRatio(uint32 _ratio) {
        require(_ratio > 0 && _ratio <= MAX_CRR);
        _;
    }

    // validates a conversion path - verifies that the number of elements is odd and that maximum number of 'hops' is 10
    modifier validConversionPath(IERC20Token[] _path) {
        require(_path.length > 2 && _path.length <= (1 + 2 * 10) && _path.length % 2 == 1);
        _;
    }

    // allows execution only when conversions aren't disabled
    modifier conversionsAllowed {
        assert(conversionsEnabled);
        _;
    }

    /**
        @dev returns the number of reserve tokens defined

        @return number of reserve tokens
    */
    function reserveTokenCount() public constant returns (uint16) {
        return uint16(reserveTokens.length);
    }

    /**
        @dev returns the number of convertible tokens supported by the contract
        note that the number of convertible tokens is the number of reserve token, plus 1 (that represents the smart token)

        @return number of convertible tokens
    */
    function convertibleTokenCount() public constant returns (uint16) {
        return reserveTokenCount() + 1;
    }

    /**
        @dev given a convertible token index, returns its contract address

        @param _tokenIndex  convertible token index

        @return convertible token address
    */
    function convertibleToken(uint16 _tokenIndex) public constant returns (address) {
        if (_tokenIndex == 0)
            return token;
        return reserveTokens[_tokenIndex - 1];
    }

    /*
        @dev allows the owner to update the extensions contract address

        @param _extensions    address of a bancor converter extensions contract
    */
    function setExtensions(IBancorConverterExtensions _extensions)
        public
        ownerOnly
        validAddress(_extensions)
        notThis(_extensions)
    {
        extensions = _extensions;
    }

    /*
        @dev allows the manager to update the quick buy path

        @param _path    new quick buy path, see conversion path format in the BancorQuickConverter contract
    */
    function setQuickBuyPath(IERC20Token[] _path)
        public
        ownerOnly
        validConversionPath(_path)
    {
        quickBuyPath = _path;
    }

    /*
        @dev allows the manager to clear the quick buy path
    */
    function clearQuickBuyPath() public ownerOnly {
        quickBuyPath.length = 0;
    }

    /**
        @dev returns the length of the quick buy path array

        @return quick buy path length
    */
    function getQuickBuyPathLength() public constant returns (uint256) {
        return quickBuyPath.length;
    }

    /**
        @dev disables the entire conversion functionality
        this is a safety mechanism in case of a emergency
        can only be called by the manager

        @param _disable true to disable conversions, false to re-enable them
    */
    function disableConversions(bool _disable) public managerOnly {
        conversionsEnabled = !_disable;
    }

    /**
        @dev updates the current conversion fee
        can only be called by the manager

        @param _conversionFee new conversion fee, represented in ppm
    */
    function setConversionFee(uint32 _conversionFee)
        public
        managerOnly
        validConversionFee(_conversionFee)
    {
        conversionFee = _conversionFee;
    }

    /*
        @dev returns the conversion fee amount for a given return amount

        @return conversion fee amount
    */
    function getConversionFeeAmount(uint256 _amount) public constant returns (uint256) {
        return safeMul(_amount, conversionFee) / MAX_CONVERSION_FEE;
    }

    /**
        @dev defines a new reserve for the token
        can only be called by the owner while the converter is inactive

        @param _token                  address of the reserve token
        @param _ratio                  constant reserve ratio, represented in ppm, 1-1000000
        @param _enableVirtualBalance   true to enable virtual balance for the reserve, false to disable it
    */
    function addReserve(IERC20Token _token, uint32 _ratio, bool _enableVirtualBalance)
        public
        ownerOnly
        inactive
        validAddress(_token)
        notThis(_token)
        validReserveRatio(_ratio)
    {
        require(_token != token && !reserves[_token].isSet && totalReserveRatio + _ratio <= MAX_CRR); // validate input

        reserves[_token].virtualBalance = 0;
        reserves[_token].ratio = _ratio;
        reserves[_token].isVirtualBalanceEnabled = _enableVirtualBalance;
        reserves[_token].isPurchaseEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
    }

    /**
        @dev updates one of the token reserves
        can only be called by the owner

        @param _reserveToken           address of the reserve token
        @param _ratio                  constant reserve ratio, represented in ppm, 1-1000000
        @param _enableVirtualBalance   true to enable virtual balance for the reserve, false to disable it
        @param _virtualBalance         new reserve's virtual balance
    */
    function updateReserve(IERC20Token _reserveToken, uint32 _ratio, bool _enableVirtualBalance, uint256 _virtualBalance)
        public
        ownerOnly
        validReserve(_reserveToken)
        validReserveRatio(_ratio)
    {
        Reserve storage reserve = reserves[_reserveToken];
        require(totalReserveRatio - reserve.ratio + _ratio <= MAX_CRR); // validate input

        totalReserveRatio = totalReserveRatio - reserve.ratio + _ratio;
        reserve.ratio = _ratio;
        reserve.isVirtualBalanceEnabled = _enableVirtualBalance;
        reserve.virtualBalance = _virtualBalance;
    }

    /**
        @dev disables purchasing with the given reserve token in case the reserve token got compromised
        can only be called by the owner
        note that selling is still enabled regardless of this flag and it cannot be disabled by the owner

        @param _reserveToken    reserve token contract address
        @param _disable         true to disable the token, false to re-enable it
    */
    function disableReservePurchases(IERC20Token _reserveToken, bool _disable)
        public
        ownerOnly
        validReserve(_reserveToken)
    {
        reserves[_reserveToken].isPurchaseEnabled = !_disable;
    }

    /**
        @dev returns the reserve's virtual balance if one is defined, otherwise returns the actual balance

        @param _reserveToken    reserve token contract address

        @return reserve balance
    */
    function getReserveBalance(IERC20Token _reserveToken)
        public
        constant
        validReserve(_reserveToken)
        returns (uint256)
    {
        Reserve storage reserve = reserves[_reserveToken];
        return reserve.isVirtualBalanceEnabled ? reserve.virtualBalance : _reserveToken.balanceOf(this);
    }

    /**
        @dev returns the expected return for converting a specific amount of _fromToken to _toToken

        @param _fromToken  ERC20 token to convert from
        @param _toToken    ERC20 token to convert to
        @param _amount     amount to convert, in fromToken

        @return expected conversion return amount
    */
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public constant returns (uint256) {
        require(_fromToken != _toToken); // validate input

        // conversion between the token and one of its reserves
        if (_toToken == token)
            return getPurchaseReturn(_fromToken, _amount);
        else if (_fromToken == token)
            return getSaleReturn(_toToken, _amount);

        // conversion between 2 reserves
        uint256 purchaseReturnAmount = getPurchaseReturn(_fromToken, _amount);
        return getSaleReturn(_toToken, purchaseReturnAmount, safeAdd(token.totalSupply(), purchaseReturnAmount));
    }

    /**
        @dev returns the expected return for buying the token for a reserve token

        @param _reserveToken   reserve token contract address
        @param _depositAmount  amount to deposit (in the reserve token)

        @return expected purchase return amount
    */
    function getPurchaseReturn(IERC20Token _reserveToken, uint256 _depositAmount)
        public
        constant
        active
        validReserve(_reserveToken)
        returns (uint256)
    {
        Reserve storage reserve = reserves[_reserveToken];
        require(reserve.isPurchaseEnabled); // validate input

        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        uint256 amount = extensions.formula().calculatePurchaseReturn(tokenSupply, reserveBalance, reserve.ratio, _depositAmount);

        // deduct the fee from the return amount
        uint256 feeAmount = getConversionFeeAmount(amount);
        return safeSub(amount, feeAmount);
    }

    /**
        @dev returns the expected return for selling the token for one of its reserve tokens

        @param _reserveToken   reserve token contract address
        @param _sellAmount     amount to sell (in the smart token)

        @return expected sale return amount
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount) public constant returns (uint256) {
        return getSaleReturn(_reserveToken, _sellAmount, token.totalSupply());
    }

    /**
        @dev converts a specific amount of _fromToken to _toToken

        @param _fromToken  ERC20 token to convert from
        @param _toToken    ERC20 token to convert to
        @param _amount     amount to convert, in fromToken
        @param _minReturn  if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return conversion return amount
    */
    function convert(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        require(_fromToken != _toToken); // validate input

        // conversion between the token and one of its reserves
        if (_toToken == token)
            return buy(_fromToken, _amount, _minReturn);
        else if (_fromToken == token)
            return sell(_toToken, _amount, _minReturn);

        // conversion between 2 reserves
        uint256 purchaseAmount = buy(_fromToken, _amount, 1);
        return sell(_toToken, purchaseAmount, _minReturn);
    }

    /**
        @dev buys the token by depositing one of its reserve tokens

        @param _reserveToken   reserve token contract address
        @param _depositAmount  amount to deposit (in the reserve token)
        @param _minReturn      if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return buy return amount
    */
    function buy(IERC20Token _reserveToken, uint256 _depositAmount, uint256 _minReturn)
        public
        conversionsAllowed
        validGasPrice
        greaterThanZero(_minReturn)
        returns (uint256)
    {
        uint256 amount = getPurchaseReturn(_reserveToken, _depositAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        // update virtual balance if relevant
        Reserve storage reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeAdd(reserve.virtualBalance, _depositAmount);

        // transfer _depositAmount funds from the caller in the reserve token
        assert(_reserveToken.transferFrom(msg.sender, this, _depositAmount));
        // issue new funds to the caller in the smart token
        token.issue(msg.sender, amount);

        // calculate the new price using the simple price formula
        // price = reserve balance / (supply * CRR)
        // CRR is represented in ppm, so multiplying by 1000000
        uint256 reserveAmount = safeMul(getReserveBalance(_reserveToken), MAX_CRR);
        uint256 tokenAmount = safeMul(token.totalSupply(), reserve.ratio);
        Conversion(_reserveToken, token, msg.sender, _depositAmount, amount, reserveAmount, tokenAmount);
        return amount;
    }

    /**
        @dev sells the token by withdrawing from one of its reserve tokens

        @param _reserveToken   reserve token contract address
        @param _sellAmount     amount to sell (in the smart token)
        @param _minReturn      if the conversion results in an amount smaller the minimum return - it is cancelled, must be nonzero

        @return sell return amount
    */
    function sell(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _minReturn)
        public
        conversionsAllowed
        validGasPrice
        greaterThanZero(_minReturn)
        returns (uint256)
    {
        require(_sellAmount <= token.balanceOf(msg.sender)); // validate input

        uint256 amount = getSaleReturn(_reserveToken, _sellAmount);
        assert(amount != 0 && amount >= _minReturn); // ensure the trade gives something in return and meets the minimum requested amount

        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        // ensure that the trade will only deplete the reserve if the total supply is depleted as well
        assert(amount < reserveBalance || (amount == reserveBalance && _sellAmount == tokenSupply));

        // update virtual balance if relevant
        Reserve storage reserve = reserves[_reserveToken];
        if (reserve.isVirtualBalanceEnabled)
            reserve.virtualBalance = safeSub(reserve.virtualBalance, amount);

        // destroy _sellAmount from the caller's balance in the smart token
        token.destroy(msg.sender, _sellAmount);
        // transfer funds to the caller in the reserve token
        // the transfer might fail if the actual reserve balance is smaller than the virtual balance
        assert(_reserveToken.transfer(msg.sender, amount));

        // calculate the new price using the simple price formula
        // price = reserve balance / (supply * CRR)
        // CRR is represented in ppm, so multiplying by 1000000
        uint256 reserveAmount = safeMul(getReserveBalance(_reserveToken), MAX_CRR);
        uint256 tokenAmount = safeMul(token.totalSupply(), reserve.ratio);
        Conversion(token, _reserveToken, msg.sender, _sellAmount, amount, tokenAmount, reserveAmount);
        return amount;
    }

    /**
        @dev converts the token to any other token in the bancor network by following a predefined conversion path
        note that when converting from an ERC20 token (as opposed to a smart token), allowance must be set beforehand

        @param _path        conversion path, see conversion path format in the BancorQuickConverter contract
        @param _amount      amount to convert from (in the initial source token)
        @param _minReturn   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

        @return tokens issued in return
    */
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn)
        public
        payable
        validConversionPath(_path)
        returns (uint256)
    {
        IERC20Token fromToken = _path[0];
        IBancorQuickConverter quickConverter = extensions.quickConverter();

        // we need to transfer the source tokens from the caller to the quick converter,
        // so it can execute the conversion on behalf of the caller
        if (msg.value == 0) {
            // not ETH, send the source tokens to the quick converter
            // if the token is the smart token, no allowance is required - destroy the tokens from the caller and issue them to the quick converter
            if (fromToken == token) {
                token.destroy(msg.sender, _amount); // destroy _amount tokens from the caller's balance in the smart token
                token.issue(quickConverter, _amount); // issue _amount new tokens to the quick converter
            }
            else {
                // otherwise, we assume we already have allowance, transfer the tokens directly to the quick converter
                assert(fromToken.transferFrom(msg.sender, quickConverter, _amount));
            }
        }

        // execute the conversion and pass on the ETH with the call
        return quickConverter.convertFor.value(msg.value)(_path, _amount, _minReturn, msg.sender);
    }

    // deprecated, backward compatibility
    function change(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        return convert(_fromToken, _toToken, _amount, _minReturn);
    }

    // deprecated, backward compatibility
    function quickChange(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        return quickConvert(_path, _amount, _minReturn);
    }

    // deprecated, backward compatibility
    function quickBuy(uint256 _minReturn) public payable returns (uint256) {
        return quickConvert(quickBuyPath, msg.value, _minReturn);
    }

    /**
        @dev utility, returns the expected return for selling the token for one of its reserve tokens, given a total supply override

        @param _reserveToken   reserve token contract address
        @param _sellAmount     amount to sell (in the smart token)
        @param _totalSupply    total token supply, overrides the actual token total supply when calculating the return

        @return sale return amount
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _totalSupply)
        private
        constant
        active
        validReserve(_reserveToken)
        greaterThanZero(_totalSupply)
        returns (uint256)
    {
        Reserve storage reserve = reserves[_reserveToken];
        uint256 reserveBalance = getReserveBalance(_reserveToken);
        uint256 amount = extensions.formula().calculateSaleReturn(_totalSupply, reserveBalance, reserve.ratio, _sellAmount);

        // deduct the fee from the return amount
        uint256 feeAmount = getConversionFeeAmount(amount);
        return safeSub(amount, feeAmount);
    }

    /**
        @dev fallback, buys the smart token with ETH
        note that the purchase will use the price at the time of the purchase
    */
    function() payable {
        quickConvert(quickBuyPath, msg.value, 1);
    }
}
