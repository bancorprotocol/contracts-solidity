pragma solidity 0.4.26;
import './interfaces/IBancorConverter.sol';
import './interfaces/IBancorConverterUpgrader.sol';
import './interfaces/IBancorFormula.sol';
import '../IBancorNetwork.sol';
import '../FeatureIds.sol';
import '../utility/SafeMath.sol';
import '../utility/ContractRegistryClient.sol';
import '../utility/interfaces/IContractFeatures.sol';
import '../token/SmartTokenController.sol';
import '../token/interfaces/ISmartToken.sol';
import '../token/interfaces/INonStandardERC20.sol';
import '../token/interfaces/IEtherToken.sol';
import '../bancorx/interfaces/IBancorX.sol';

/**
  * @dev Bancor Converter
  * 
  * The Bancor converter allows for conversions between a Smart Token and other ERC20 tokens and between different ERC20 tokens and themselves. 
  * 
  * This mechanism opens the possibility to create different financial tools (for example, lower slippage in conversions).
  * 
  * The converter is upgradable (just like any SmartTokenController) and all upgrades are opt-in. 
  * 
  * WARNING: It is NOT RECOMMENDED to use the converter with Smart Tokens that have less than 8 decimal digits or with very small numbers because of precision loss 
  * 
  * Open issues:
  * - Front-running attacks are currently mitigated by providing the minimum return argument for each conversion
  *   Other potential solutions might include a commit/reveal based schemes
*/
contract BancorConverter is IBancorConverter, SmartTokenController, ContractRegistryClient, FeatureIds {
    using SafeMath for uint256;

    uint32 private constant RATIO_RESOLUTION = 1000000;
    uint64 private constant CONVERSION_FEE_RESOLUTION = 1000000;

    struct Reserve {
        uint256 virtualBalance;         // reserve virtual balance
        uint32 ratio;                   // reserve ratio, represented in ppm, 1-1000000
        bool isVirtualBalanceEnabled;   // true if virtual balance is enabled, false if not
        bool isSaleEnabled;             // is sale of the reserve token enabled, can be set by the owner
        bool isSet;                     // used to tell if the mapping element is defined
    }

    /**
      * @dev version number
    */
    uint16 public version = 26;

    IWhitelist public conversionWhitelist;          // whitelist contract with list of addresses that are allowed to use the converter
    IERC20Token[] public reserveTokens;             // ERC20 standard token addresses (prior version 17, use 'connectorTokens' instead)
    mapping (address => Reserve) public reserves;   // reserve token addresses -> reserve data (prior version 17, use 'connectors' instead)
    uint32 public totalReserveRatio = 0;            // total ratio of all reservces, also used to efficiently prevent increasing
                                                    // the total reserve ratio above 100%
    uint32 public maxConversionFee = 0;             // maximum conversion fee for the lifetime of the contract,
                                                    // represented in ppm, 0...1000000 (0 = no fee, 100 = 0.01%, 1000000 = 100%)
    uint32 public conversionFee = 0;                // current conversion fee, represented in ppm, 0...maxConversionFee
    bool public conversionsEnabled = true;          // deprecated, backward compatibility

    /**
      * @dev triggered when a conversion between two tokens occurs
      * 
      * @param _fromToken       ERC20 token converted from
      * @param _toToken         ERC20 token converted to
      * @param _trader          wallet that initiated the trade
      * @param _amount          amount converted, in fromToken
      * @param _return          amount returned, minus conversion fee
      * @param _conversionFee   conversion fee
    */
    event Conversion(
        address indexed _fromToken,
        address indexed _toToken,
        address indexed _trader,
        uint256 _amount,
        uint256 _return,
        int256 _conversionFee
    );

    /**
      * @dev triggered after a conversion with new price data
      * 
      * @param  _connectorToken     reserve token
      * @param  _tokenSupply        smart token supply
      * @param  _connectorBalance   reserve balance
      * @param  _connectorWeight    reserve ratio
    */
    event PriceDataUpdate(
        address indexed _connectorToken,
        uint256 _tokenSupply,
        uint256 _connectorBalance,
        uint32 _connectorWeight
    );

    /**
      * @dev triggered when the conversion fee is updated
      * 
      * @param  _prevFee    previous fee percentage, represented in ppm
      * @param  _newFee     new fee percentage, represented in ppm
    */
    event ConversionFeeUpdate(uint32 _prevFee, uint32 _newFee);

    /**
      * @dev initializes a new BancorConverter instance
      * 
      * @param  _token              smart token governed by the converter
      * @param  _registry           address of a contract registry contract
      * @param  _maxConversionFee   maximum conversion fee, represented in ppm
      * @param  _reserveToken       optional, initial reserve, allows defining the first reserve at deployment time
      * @param  _reserveRatio       optional, ratio for the initial reserve
    */
    constructor(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee,
        IERC20Token _reserveToken,
        uint32 _reserveRatio
    )   ContractRegistryClient(_registry)
        public
        SmartTokenController(_token)
        validConversionFee(_maxConversionFee)
    {
        IContractFeatures features = IContractFeatures(addressOf(CONTRACT_FEATURES));

        // initialize supported features
        if (features != address(0))
            features.enableFeatures(FeatureIds.CONVERTER_CONVERSION_WHITELIST, true);

        maxConversionFee = _maxConversionFee;

        if (_reserveToken != address(0))
            addReserve(_reserveToken, _reserveRatio);
    }

    // validates a reserve token address - verifies that the address belongs to one of the reserve tokens
    modifier validReserve(IERC20Token _address) {
        require(reserves[_address].isSet);
        _;
    }

    // validates conversion fee
    modifier validConversionFee(uint32 _conversionFee) {
        require(_conversionFee >= 0 && _conversionFee <= CONVERSION_FEE_RESOLUTION);
        _;
    }

    // validates reserve ratio
    modifier validReserveRatio(uint32 _ratio) {
        require(_ratio > 0 && _ratio <= RATIO_RESOLUTION);
        _;
    }

    // allows execution only if the total-supply of the token is greater than zero
    modifier totalSupplyGreaterThanZeroOnly {
        require(token.totalSupply() > 0);
        _;
    }

    // allows execution only on a multiple-reserve converter
    modifier multipleReservesOnly {
        require(reserveTokens.length > 1);
        _;
    }

    /**
      * @dev returns the number of reserve tokens defined
      * note that prior to version 17, you should use 'connectorTokenCount' instead
      * 
      * @return number of reserve tokens
    */
    function reserveTokenCount() public view returns (uint16) {
        return uint16(reserveTokens.length);
    }

    /**
      * @dev allows the owner to update & enable the conversion whitelist contract address
      * when set, only addresses that are whitelisted are actually allowed to use the converter
      * note that the whitelist check is actually done by the BancorNetwork contract
      * 
      * @param _whitelist    address of a whitelist contract
    */
    function setConversionWhitelist(IWhitelist _whitelist)
        public
        ownerOnly
        notThis(_whitelist)
    {
        conversionWhitelist = _whitelist;
    }

    /**
      * @dev allows transferring the token ownership
      * the new owner needs to accept the transfer
      * can only be called by the contract owner
      * note that token ownership can only be transferred while the owner is the converter upgrader contract
      * 
      * @param _newOwner    new token owner
    */
    function transferTokenOwnership(address _newOwner)
        public
        ownerOnly
        only(BANCOR_CONVERTER_UPGRADER)
    {
        super.transferTokenOwnership(_newOwner);
    }

    /**
      * @dev used by a new owner to accept a token ownership transfer
      * can only be called by the contract owner
      * note that token ownership can only be accepted if its total-supply is greater than zero
    */
    function acceptTokenOwnership()
        public
        ownerOnly
        totalSupplyGreaterThanZeroOnly
    {
        super.acceptTokenOwnership();
    }

    /**
      * @dev updates the current conversion fee
      * can only be called by the contract owner
      * 
      * @param _conversionFee new conversion fee, represented in ppm
    */
    function setConversionFee(uint32 _conversionFee)
        public
        ownerOnly
    {
        require(_conversionFee >= 0 && _conversionFee <= maxConversionFee);
        emit ConversionFeeUpdate(conversionFee, _conversionFee);
        conversionFee = _conversionFee;
    }

    /**
      * @dev given a return amount, returns the amount minus the conversion fee
      * 
      * @param _amount      return amount
      * @param _magnitude   1 for standard conversion, 2 for cross reserve conversion
      * 
      * @return return amount minus conversion fee
    */
    function getFinalAmount(uint256 _amount, uint8 _magnitude) public view returns (uint256) {
        return _amount.mul((CONVERSION_FEE_RESOLUTION - conversionFee) ** _magnitude).div(CONVERSION_FEE_RESOLUTION ** _magnitude);
    }

    /**
      * @dev withdraws tokens held by the converter and sends them to an account
      * can only be called by the owner
      * note that reserve tokens can only be withdrawn by the owner while the converter is inactive
      * unless the owner is the converter upgrader contract
      * 
      * @param _token   ERC20 token contract address
      * @param _to      account to receive the new amount
      * @param _amount  amount to withdraw
    */
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public {
        address converterUpgrader = addressOf(BANCOR_CONVERTER_UPGRADER);

        // if the token is not a reserve token, allow withdrawal
        // otherwise verify that the converter is inactive or that the owner is the upgrader contract
        require(!reserves[_token].isSet || token.owner() != address(this) || owner == converterUpgrader);
        super.withdrawTokens(_token, _to, _amount);
    }

    /**
      * @dev upgrades the converter to the latest version
      * can only be called by the owner
      * note that the owner needs to call acceptOwnership on the new converter after the upgrade
    */
    function upgrade() public ownerOnly {
        IBancorConverterUpgrader converterUpgrader = IBancorConverterUpgrader(addressOf(BANCOR_CONVERTER_UPGRADER));

        transferOwnership(converterUpgrader);
        converterUpgrader.upgrade(version);
        acceptOwnership();
    }

    /**
      * @dev defines a new reserve for the token
      * can only be called by the owner while the converter is inactive
      * note that prior to version 17, you should use 'addConnector' instead
      * 
      * @param _token                  address of the reserve token
      * @param _ratio                  constant reserve ratio, represented in ppm, 1-1000000
    */
    function addReserve(IERC20Token _token, uint32 _ratio)
        public
        ownerOnly
        inactive
        validAddress(_token)
        notThis(_token)
        validReserveRatio(_ratio)
    {
        require(_token != token && !reserves[_token].isSet && totalReserveRatio + _ratio <= RATIO_RESOLUTION); // validate input

        reserves[_token].ratio = _ratio;
        reserves[_token].isVirtualBalanceEnabled = false;
        reserves[_token].virtualBalance = 0;
        reserves[_token].isSaleEnabled = true;
        reserves[_token].isSet = true;
        reserveTokens.push(_token);
        totalReserveRatio += _ratio;
    }

    /**
      * @dev updates a reserve's virtual balance
      * only used during an upgrade process
      * can only be called by the contract owner while the owner is the converter upgrader contract
      * note that prior to version 17, you should use 'updateConnector' instead
      * 
      * @param _reserveToken    address of the reserve token
      * @param _virtualBalance  new reserve virtual balance, or 0 to disable virtual balance
    */
    function updateReserveVirtualBalance(IERC20Token _reserveToken, uint256 _virtualBalance)
        public
        ownerOnly
        only(BANCOR_CONVERTER_UPGRADER)
        validReserve(_reserveToken)
    {
        Reserve storage reserve = reserves[_reserveToken];
        reserve.isVirtualBalanceEnabled = _virtualBalance != 0;
        reserve.virtualBalance = _virtualBalance;
    }

    /**
      * @dev returns the reserve's ratio
      * added in version 22
      * 
      * @param _reserveToken    reserve token contract address
      * 
      * @return reserve ratio
    */
    function getReserveRatio(IERC20Token _reserveToken)
        public
        view
        validReserve(_reserveToken)
        returns (uint256)
    {
        return reserves[_reserveToken].ratio;
    }

    /**
      * @dev returns the reserve's balance
      * note that prior to version 17, you should use 'getConnectorBalance' instead
      * 
      * @param _reserveToken    reserve token contract address
      * 
      * @return reserve balance
    */
    function getReserveBalance(IERC20Token _reserveToken)
        public
        view
        validReserve(_reserveToken)
        returns (uint256)
    {
        return _reserveToken.balanceOf(this);
    }

    /**
      * @dev calculates the expected return of converting a given amount of tokens
      * 
      * @param _fromToken  contract address of the token to convert from
      * @param _toToken    contract address of the token to convert to
      * @param _amount     amount of tokens received from the user
      * 
      * @return amount of tokens that the user will receive
      * @return amount of tokens that the user will pay as fee
    */
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public view returns (uint256, uint256) {
        require(_fromToken != _toToken); // validate input

        // conversion between the token and one of its reserves
        if (_toToken == token)
            return getPurchaseReturn(_fromToken, _amount);
        else if (_fromToken == token)
            return getSaleReturn(_toToken, _amount);

        // conversion between 2 reserves
        return getCrossReserveReturn(_fromToken, _toToken, _amount);
    }

    /**
      * @dev calculates the expected return of buying with a given amount of tokens
      * 
      * @param _reserveToken    contract address of the reserve token
      * @param _depositAmount   amount of reserve-tokens received from the user
      * 
      * @return amount of supply-tokens that the user will receive
      * @return amount of supply-tokens that the user will pay as fee
    */
    function getPurchaseReturn(IERC20Token _reserveToken, uint256 _depositAmount)
        public
        view
        active
        validReserve(_reserveToken)
        returns (uint256, uint256)
    {
        Reserve storage reserve = reserves[_reserveToken];

        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = _reserveToken.balanceOf(this);
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 amount = formula.calculatePurchaseReturn(tokenSupply, reserveBalance, reserve.ratio, _depositAmount);
        uint256 finalAmount = getFinalAmount(amount, 1);

        // return the amount minus the conversion fee and the conversion fee
        return (finalAmount, amount - finalAmount);
    }

    /**
      * @dev calculates the expected return of selling a given amount of tokens
      * 
      * @param _reserveToken    contract address of the reserve token
      * @param _sellAmount      amount of supply-tokens received from the user
      * 
      * @return amount of reserve-tokens that the user will receive
      * @return amount of reserve-tokens that the user will pay as fee
    */
    function getSaleReturn(IERC20Token _reserveToken, uint256 _sellAmount)
        public
        view
        active
        validReserve(_reserveToken)
        returns (uint256, uint256)
    {
        Reserve storage reserve = reserves[_reserveToken];
        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = _reserveToken.balanceOf(this);
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 amount = formula.calculateSaleReturn(tokenSupply, reserveBalance, reserve.ratio, _sellAmount);
        uint256 finalAmount = getFinalAmount(amount, 1);

        // return the amount minus the conversion fee and the conversion fee
        return (finalAmount, amount - finalAmount);
    }

    /**
      * @dev calculates the expected return of converting a given amount from one reserve to another
      * note that prior to version 17, you should use 'getCrossConnectorReturn' instead
      * 
      * @param _fromReserveToken    contract address of the reserve token to convert from
      * @param _toReserveToken      contract address of the reserve token to convert to
      * @param _amount              amount of tokens received from the user
      * 
      * @return amount of tokens that the user will receive
      * @return amount of tokens that the user will pay as fee
    */
    function getCrossReserveReturn(IERC20Token _fromReserveToken, IERC20Token _toReserveToken, uint256 _amount)
        public
        view
        active
        validReserve(_fromReserveToken)
        validReserve(_toReserveToken)
        returns (uint256, uint256)
    {
        Reserve storage fromReserve = reserves[_fromReserveToken];
        Reserve storage toReserve = reserves[_toReserveToken];

        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));
        uint256 amount = formula.calculateCrossReserveReturn(
            getReserveBalance(_fromReserveToken), 
            fromReserve.ratio, 
            getReserveBalance(_toReserveToken), 
            toReserve.ratio, 
            _amount);
        uint256 finalAmount = getFinalAmount(amount, 2);

        // return the amount minus the conversion fee and the conversion fee
        // the fee is higher (magnitude = 2) since cross reserve conversion equals 2 conversions (from / to the smart token)
        return (finalAmount, amount - finalAmount);
    }

    /**
      * @dev converts a specific amount of _fromToken to _toToken
      * can only be called by the bancor network contract
      * 
      * @param _fromToken  ERC20 token to convert from
      * @param _toToken    ERC20 token to convert to
      * @param _amount     amount to convert, in fromToken
      * @param _minReturn  if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * 
      * @return conversion return amount
    */
    function convertInternal(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn)
        public
        only(BANCOR_NETWORK)
        greaterThanZero(_minReturn)
        returns (uint256)
    {
        require(_fromToken != _toToken); // validate input

        // conversion between the token and one of its reserves
        if (_toToken == token)
            return buy(_fromToken, _amount, _minReturn);
        else if (_fromToken == token)
            return sell(_toToken, _amount, _minReturn);

        uint256 amount;
        uint256 feeAmount;

        // conversion between 2 reserves
        (amount, feeAmount) = getCrossReserveReturn(_fromToken, _toToken, _amount);
        // ensure the trade gives something in return and meets the minimum requested amount
        require(amount != 0 && amount >= _minReturn);

        Reserve storage fromReserve = reserves[_fromToken];
        Reserve storage toReserve = reserves[_toToken];

        // ensure that the trade won't deplete the reserve balance
        uint256 toReserveBalance = getReserveBalance(_toToken);
        assert(amount < toReserveBalance);

        // transfer funds from the caller in the from reserve token
        ensureTransferFrom(_fromToken, msg.sender, this, _amount);
        // transfer funds to the caller in the to reserve token
        ensureTransferFrom(_toToken, this, msg.sender, amount);

        // dispatch the conversion event
        // the fee is higher (magnitude = 2) since cross reserve conversion equals 2 conversions (from / to the smart token)
        dispatchConversionEvent(_fromToken, _toToken, _amount, amount, feeAmount);

        // dispatch price data updates for the smart token / both reserves
        emit PriceDataUpdate(_fromToken, token.totalSupply(), _fromToken.balanceOf(this), fromReserve.ratio);
        emit PriceDataUpdate(_toToken, token.totalSupply(), _toToken.balanceOf(this), toReserve.ratio);
        return amount;
    }

    /**
      * @dev buys the token by depositing one of its reserve tokens
      * 
      * @param _reserveToken    reserve token contract address
      * @param _depositAmount   amount to deposit (in the reserve token)
      * @param _minReturn       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * 
      * @return buy return amount
    */
    function buy(IERC20Token _reserveToken, uint256 _depositAmount, uint256 _minReturn) internal returns (uint256) {
        uint256 amount;
        uint256 feeAmount;
        (amount, feeAmount) = getPurchaseReturn(_reserveToken, _depositAmount);
        // ensure the trade gives something in return and meets the minimum requested amount
        require(amount != 0 && amount >= _minReturn);

        Reserve storage reserve = reserves[_reserveToken];

        // transfer funds from the caller in the reserve token
        ensureTransferFrom(_reserveToken, msg.sender, this, _depositAmount);
        // issue new funds to the caller in the smart token
        token.issue(msg.sender, amount);

        // dispatch the conversion event
        dispatchConversionEvent(_reserveToken, token, _depositAmount, amount, feeAmount);

        // dispatch price data update for the smart token/reserve
        emit PriceDataUpdate(_reserveToken, token.totalSupply(), _reserveToken.balanceOf(this), reserve.ratio);
        return amount;
    }

    /**
      * @dev sells the token by withdrawing from one of its reserve tokens
      * 
      * @param _reserveToken    reserve token contract address
      * @param _sellAmount      amount to sell (in the smart token)
      * @param _minReturn       if the conversion results in an amount smaller the minimum return - it is cancelled, must be nonzero
      * 
      * @return sell return amount
    */
    function sell(IERC20Token _reserveToken, uint256 _sellAmount, uint256 _minReturn) internal returns (uint256) {
        require(_sellAmount <= token.balanceOf(msg.sender)); // validate input
        uint256 amount;
        uint256 feeAmount;
        (amount, feeAmount) = getSaleReturn(_reserveToken, _sellAmount);
        // ensure the trade gives something in return and meets the minimum requested amount
        require(amount != 0 && amount >= _minReturn);

        // ensure that the trade will only deplete the reserve balance if the total supply is depleted as well
        uint256 tokenSupply = token.totalSupply();
        uint256 reserveBalance = _reserveToken.balanceOf(this);
        assert(amount < reserveBalance || (amount == reserveBalance && _sellAmount == tokenSupply));

        Reserve storage reserve = reserves[_reserveToken];

        // destroy _sellAmount from the caller's balance in the smart token
        token.destroy(msg.sender, _sellAmount);
        // transfer funds to the caller in the reserve token
        ensureTransferFrom(_reserveToken, this, msg.sender, amount);

        // dispatch the conversion event
        dispatchConversionEvent(token, _reserveToken, _sellAmount, amount, feeAmount);

        // dispatch price data update for the smart token/reserve
        emit PriceDataUpdate(_reserveToken, token.totalSupply(), _reserveToken.balanceOf(this), reserve.ratio);
        return amount;
    }

    /**
      * @dev converts a specific amount of _fromToken to _toToken
      * note that prior to version 16, you should use 'convert' instead
      * 
      * @param _fromToken           ERC20 token to convert from
      * @param _toToken             ERC20 token to convert to
      * @param _amount              amount to convert, in fromToken
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return conversion return amount
    */
    function convert2(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee) public returns (uint256) {
        IERC20Token[] memory path = new IERC20Token[](3);
        (path[0], path[1], path[2]) = (_fromToken, token, _toToken);
        return quickConvert2(path, _amount, _minReturn, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev converts the token to any other token in the bancor network by following a predefined conversion path
      * note that when converting from an ERC20 token (as opposed to a smart token), allowance must be set beforehand
      * note that prior to version 16, you should use 'quickConvert' instead
      * 
      * @param _path                conversion path, see conversion path format in the BancorNetwork contract
      * @param _amount              amount to convert from (in the initial source token)
      * @param _minReturn           if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _affiliateAccount    affiliate account
      * @param _affiliateFee        affiliate fee in PPM
      * 
      * @return tokens issued in return
    */
    function quickConvert2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _affiliateAccount, uint256 _affiliateFee)
        public
        payable
        returns (uint256)
    {
        IBancorNetwork bancorNetwork = IBancorNetwork(addressOf(BANCOR_NETWORK));

        // we need to transfer the source tokens from the caller to the BancorNetwork contract,
        // so it can execute the conversion on behalf of the caller
        if (msg.value == 0) {
            // not ETH, send the source tokens to the BancorNetwork contract
            // if the token is the smart token, no allowance is required - destroy the tokens
            // from the caller and issue them to the BancorNetwork contract
            if (_path[0] == token) {
                token.destroy(msg.sender, _amount); // destroy _amount tokens from the caller's balance in the smart token
                token.issue(bancorNetwork, _amount); // issue _amount new tokens to the BancorNetwork contract
            } else {
                // otherwise, we assume we already have allowance, transfer the tokens directly to the BancorNetwork contract
                ensureTransferFrom(_path[0], msg.sender, bancorNetwork, _amount);
            }
        }

        // execute the conversion and pass on the ETH with the call
        return bancorNetwork.convertFor2.value(msg.value)(_path, _amount, _minReturn, msg.sender, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev allows a user to convert BNT that was sent from another blockchain into any other
      * token on the BancorNetwork without specifying the amount of BNT to be converted, but
      * rather by providing the xTransferId which allows us to get the amount from BancorX.
      * note that prior to version 16, you should use 'completeXConversion' instead
      * 
      * @param _path            conversion path, see conversion path format in the BancorNetwork contract
      * @param _minReturn       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero
      * @param _conversionId    pre-determined unique (if non zero) id which refers to this transaction 
      * 
      * @return tokens issued in return
    */
    function completeXConversion2(
        IERC20Token[] _path,
        uint256 _minReturn,
        uint256 _conversionId
    )
        public
        returns (uint256)
    {
        IBancorX bancorX = IBancorX(addressOf(BANCOR_X));
        IBancorNetwork bancorNetwork = IBancorNetwork(addressOf(BANCOR_NETWORK));

        // verify that the first token in the path is BNT
        require(_path[0] == addressOf(BNT_TOKEN));

        // get conversion amount from BancorX contract
        uint256 amount = bancorX.getXTransferAmount(_conversionId, msg.sender);

        // send BNT from msg.sender to the BancorNetwork contract
        token.destroy(msg.sender, amount);
        token.issue(bancorNetwork, amount);

        return bancorNetwork.convertFor2(_path, amount, _minReturn, msg.sender, address(0), 0);
    }

    /**
      * @dev ensures transfer of tokens, taking into account that some ERC-20 implementations don't return
      * true on success but revert on failure instead
      * 
      * @param _token     the token to transfer
      * @param _from      the address to transfer the tokens from
      * @param _to        the address to transfer the tokens to
      * @param _amount    the amount to transfer
    */
    function ensureTransferFrom(IERC20Token _token, address _from, address _to, uint256 _amount) private {
        // We must assume that functions `transfer` and `transferFrom` do not return anything,
        // because not all tokens abide the requirement of the ERC20 standard to return success or failure.
        // This is because in the current compiler version, the calling contract can handle more returned data than expected but not less.
        // This may change in the future, so that the calling contract will revert if the size of the data is not exactly what it expects.
        uint256 prevBalance = _token.balanceOf(_to);
        if (_from == address(this))
            INonStandardERC20(_token).transfer(_to, _amount);
        else
            INonStandardERC20(_token).transferFrom(_from, _to, _amount);
        uint256 postBalance = _token.balanceOf(_to);
        require(postBalance > prevBalance);
    }

    /**
      * @dev buys the token with all reserve tokens using the same percentage
      * for example, if the caller increases the supply by 10%,
      * then it will cost an amount equal to 10% of each reserve token balance
      * note that the function can be called only when conversions are enabled
      * 
      * @param _amount  amount to increase the supply by (in the smart token)
    */
    function fund(uint256 _amount)
        public
        multipleReservesOnly
    {
        uint256 supply = token.totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));

        // iterate through the reserve tokens and transfer a percentage equal to the ratio between _amount
        // and the total supply in each reserve from the caller to the converter
        IERC20Token reserveToken;
        uint256 reserveBalance;
        uint256 reserveAmount;
        for (uint16 i = 0; i < reserveTokens.length; i++) {
            reserveToken = reserveTokens[i];
            reserveBalance = reserveToken.balanceOf(this);
            reserveAmount = formula.calculateFundCost(supply, reserveBalance, totalReserveRatio, _amount);

            Reserve storage reserve = reserves[reserveToken];

            // transfer funds from the caller in the reserve token
            ensureTransferFrom(reserveToken, msg.sender, this, reserveAmount);

            // dispatch price data update for the smart token/reserve
            emit PriceDataUpdate(reserveToken, supply + _amount, reserveBalance + reserveAmount, reserve.ratio);
        }

        // issue new funds to the caller in the smart token
        token.issue(msg.sender, _amount);
    }

    /**
      * @dev sells the token for all reserve tokens using the same percentage
      * for example, if the holder sells 10% of the supply,
      * then they will receive 10% of each reserve token balance in return
      * note that the function can be called also when conversions are disabled
      * 
      * @param _amount  amount to liquidate (in the smart token)
    */
    function liquidate(uint256 _amount)
        public
        multipleReservesOnly
    {
        uint256 supply = token.totalSupply();
        IBancorFormula formula = IBancorFormula(addressOf(BANCOR_FORMULA));

        // destroy _amount from the caller's balance in the smart token
        token.destroy(msg.sender, _amount);

        // iterate through the reserve tokens and send a percentage equal to the ratio between _amount
        // and the total supply from each reserve balance to the caller
        IERC20Token reserveToken;
        uint256 reserveBalance;
        uint256 reserveAmount;
        for (uint16 i = 0; i < reserveTokens.length; i++) {
            reserveToken = reserveTokens[i];
            reserveBalance = reserveToken.balanceOf(this);
            reserveAmount = formula.calculateLiquidateReturn(supply, reserveBalance, totalReserveRatio, _amount);

            Reserve storage reserve = reserves[reserveToken];

            // transfer funds to the caller in the reserve token
            ensureTransferFrom(reserveToken, this, msg.sender, reserveAmount);

            // dispatch price data update for the smart token/reserve
            emit PriceDataUpdate(reserveToken, supply - _amount, reserveBalance - reserveAmount, reserve.ratio);
        }
    }

    /**
      * @dev helper, dispatches the Conversion event
      * 
      * @param _fromToken       ERC20 token to convert from
      * @param _toToken         ERC20 token to convert to
      * @param _amount          amount purchased/sold (in the source token)
      * @param _returnAmount    amount returned (in the target token)
    */
    function dispatchConversionEvent(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _returnAmount, uint256 _feeAmount) private {
        // fee amount is converted to 255 bits -
        // negative amount means the fee is taken from the source token, positive amount means its taken from the target token
        // currently the fee is always taken from the target token
        // since we convert it to a signed number, we first ensure that it's capped at 255 bits to prevent overflow
        assert(_feeAmount < 2 ** 255);
        emit Conversion(_fromToken, _toToken, msg.sender, _amount, _returnAmount, int256(_feeAmount));
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function change(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        return convertInternal(_fromToken, _toToken, _amount, _minReturn);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function convert(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        return convert2(_fromToken, _toToken, _amount, _minReturn, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public payable returns (uint256) {
        return quickConvert2(_path, _amount, _minReturn, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function quickConvertPrioritized2(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256[] memory, address _affiliateAccount, uint256 _affiliateFee) public payable returns (uint256) {
        return quickConvert2(_path, _amount, _minReturn, _affiliateAccount, _affiliateFee);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function quickConvertPrioritized(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256, uint8, bytes32, bytes32) public payable returns (uint256) {
        return quickConvert2(_path, _amount, _minReturn, address(0), 0);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function completeXConversion(IERC20Token[] _path, uint256 _minReturn, uint256 _conversionId, uint256, uint8, bytes32, bytes32) public returns (uint256) {
        return completeXConversion2(_path, _minReturn, _conversionId);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function connectors(address _address) public view returns (uint256, uint32, bool, bool, bool) {
        Reserve storage reserve = reserves[_address];
        return(reserve.virtualBalance, reserve.ratio, reserve.isVirtualBalanceEnabled, reserve.isSaleEnabled, reserve.isSet);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function connectorTokens(uint256 _index) public view returns (IERC20Token) {
        return BancorConverter.reserveTokens[_index];
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function connectorTokenCount() public view returns (uint16) {
        return reserveTokenCount();
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function addConnector(IERC20Token _token, uint32 _weight, bool /*_enableVirtualBalance*/) public {
        addReserve(_token, _weight);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function updateConnector(IERC20Token _connectorToken, uint32 /*_weight*/, bool /*_enableVirtualBalance*/, uint256 _virtualBalance) public {
        updateReserveVirtualBalance(_connectorToken, _virtualBalance);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function getConnectorBalance(IERC20Token _connectorToken) public view returns (uint256) {
        return getReserveBalance(_connectorToken);
    }

    /**
      * @dev deprecated, backward compatibility
    */
    function getCrossConnectorReturn(IERC20Token _fromConnectorToken, IERC20Token _toConnectorToken, uint256 _amount) public view returns (uint256, uint256) {
        return getCrossReserveReturn(_fromConnectorToken, _toConnectorToken, _amount);
    }
}
