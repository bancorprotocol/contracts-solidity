pragma solidity ^0.4.18;
import '../converter/BancorConverter.sol';
import './FinancieFee.sol';
import '../token/interfaces/IERC20Token.sol';
import './FinancieNotifierDelegate.sol';
import './IFinancieBancorConverter.sol';

/**
* Financie Bancor Converter
*
*  Based on BancorConverter, extended and overriden for...
*    - allow conversion only from ETH/Card to Card/ETH
*    - ignore base fee model and use Financie fee model
*
*/
contract FinancieBancorConverter is IFinancieBancorConverter, BancorConverter, FinancieNotifierDelegate, FinancieFee {

    IERC20Token[] public quickSellPath;
    IERC20Token[] public quickBuyPath;                  // conversion path that's used in order to buy the token

    /**
    *   @dev constructor
    *
    *   @param  _token                smart token governed by the converter
    *   @param  _currencyToken        currency token for payment
    *   @param  _connectorToken       card connector for defining the first connector at deployment time
    *   @param  _hero_wallet          issuer's wallet
    *   @param  _team_wallet          Financie team wallet
    *   @param  _registry             address of a bancor converter extensions contract
    *   @param  _notifier_address     address of Financie Notifier contract
    *   @param  _heroFee              fee for financie hero, represented in ppm
    *   @param  _teamFee              fee for financie team, represented in ppm
    *   @param  _connectorWeight      optional, weight for the initial connector
    */
    constructor(
        ISmartToken _token,
        IERC20Token _currencyToken,
        IERC20Token _connectorToken,
        address _hero_wallet,
        address _team_wallet,
        IContractRegistry _registry,
        address _notifier_address,
        uint32 _heroFee,
        uint32 _teamFee,
        uint32 _connectorWeight)
        public
        BancorConverter(_token, _registry, 0, _connectorToken, _connectorWeight)
        FinancieNotifierDelegate(_notifier_address)
    {
        // when receiving , then deposit to currency token -> change to smart token -> change to connector token
        quickBuyPath.push(_currencyToken);
        quickBuyPath.push(_token);
        quickBuyPath.push(_connectorToken);

        quickSellPath.push(_connectorToken);
        quickSellPath.push(_token);
        quickSellPath.push(_currencyToken);

        setFee(_heroFee, _teamFee, _hero_wallet, _team_wallet, _currencyToken);
    }

    function getVersion() public pure returns (uint256) {
        return 13;
    }

    function startTrading() public {
        notifyApproveNewBancor(address(quickSellPath[0]), address(this));
    }

    function getQuickBuyPathLength() public view returns (uint256) {
        return quickBuyPath.length;
    }

    function setQuickBuyPath(IERC20Token[] _path)
        public
        ownerOnly
        validConversionPath(_path)
    {
        quickBuyPath = _path;
    }

    function copyQuickBuyPath(FinancieBancorConverter _oldConverter) public ownerOnly {
        uint256 quickBuyPathLength = _oldConverter.getQuickBuyPathLength();
        if (quickBuyPathLength <= 0)
            return;

        IERC20Token[] memory path = new IERC20Token[](quickBuyPathLength);
        for (uint256 i = 0; i < quickBuyPathLength; i++) {
            path[i] = _oldConverter.quickBuyPath(i);
        }

        setQuickBuyPath(path);
    }

    /**
    *   @dev Sell Card Tokens - required approval for this contract before calling this function
    *
    *   @param  _amount           amount of sale tokens in wei
    *   @param  _minReturn        minimum demands currency in wei, in case of lower result, the function will be failed
    */
    function sellCards(uint256 _amount, uint256 _minReturn) public returns (uint256) {
        IERC20Token cardToken = quickSellPath[0];
        IERC20Token currencyToken = quickSellPath[2];
        uint256 result = quickConvertInternal(quickSellPath, _amount, 1, this);

        uint256 feeAmount = distributeFees(result);
        uint256 net = safeSub(result, feeAmount);

        currencyToken.transfer(msg.sender, net);

        notifyConvertCards(msg.sender, address(cardToken), address(currencyToken), _amount, net);
        assert(net >= _minReturn);

        // Notify logs of revenue
        notifyExchangeRevenue(msg.sender, address(this), address(cardToken), hero_wallet, getHeroFee(result), team_wallet, getTeamFee(result));

        return net;
    }

    /**
    *   @dev Buy Card Tokens - required specified amount of currency
    *
    *   @param  _amount           amount of purchase payment currency in wei
    *   @param  _minReturn        minimum demands cards in wei, in case of lower result, the function will be failed
    */
    function buyCards(uint256 _amount, uint256 _minReturn) public returns (uint256) {
        IERC20Token currencyToken = quickBuyPath[0];
        IERC20Token cardToken = quickBuyPath[2];
        assert(currencyToken.transferFrom(msg.sender, this, getFinancieFee(_amount)));
        uint256 feeAmount = distributeFees(_amount);
        uint256 net = safeSub(_amount, feeAmount);

        uint256 result = quickConvertInternal(quickBuyPath, net, 1, msg.sender);

        notifyConvertCards(msg.sender, address(currencyToken), address(cardToken), _amount, result);
        assert(result >= _minReturn);

        // Notify logs of revenue
        notifyExchangeRevenue(msg.sender, address(this), address(currencyToken), hero_wallet, getHeroFee(_amount), team_wallet, getTeamFee(_amount));

        return result;
    }

    /**
    *   @dev Convert with Quick Converter - overriden for specified amount conversion
    */
    function quickConvertInternal(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _spender)
        internal
        validConversionPath(_path)
        returns (uint256)
    {
        IERC20Token fromToken = _path[0];
        IBancorNetwork bancorNetwork = IBancorNetwork(registry.addressOf(ContractIds.BANCOR_NETWORK));

        // otherwise, we assume we already have allowance, transfer the tokens directly to the BancorNetwork contract
        assert(fromToken.transferFrom(msg.sender, bancorNetwork, _amount));

        // execute the conversion and pass on the ETH with the call
        return bancorNetwork.convertForPrioritized2(_path, _amount, _minReturn, _spender, 0x0, 0x0, 0x0, 0x0);
    }


    /**
    *   @dev Overridden for original fee model
    */
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public view returns (uint256, uint256) {
        require(_fromToken == quickSellPath[0] || _fromToken == quickBuyPath[0]);
        require(_toToken == quickSellPath[2] || _toToken == quickBuyPath[2]);

        uint256 financieFee;
        uint256 bancorFee;
        uint256 totalFee;
        uint256 net;
        if ( _fromToken == quickSellPath[0] ) {
            uint256 gross;
            (gross, bancorFee) = super.getReturn(_fromToken, _toToken, _amount);
            assert(bancorFee == 0);
            financieFee = getFinancieFee(gross);
            totalFee = safeAdd(bancorFee, financieFee);
            net = safeSub(gross, totalFee);
            return (net, totalFee);
        } else {
            financieFee = getFinancieFee(_amount);
            _amount = safeSub(_amount, financieFee);
            (net, bancorFee) = super.getReturn(_fromToken, _toToken, _amount);
            assert(bancorFee == 0);
            totalFee = safeAdd(bancorFee, financieFee);
            return (net, totalFee);
        }

    }

    function quickConvertPrioritized(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)
        public
        payable
        validConversionPath(_path)
        returns (uint256)
    {
        revert();
    }

    function () public payable {
        // Override to receive currency before distribution revenue/fee
    }

}
