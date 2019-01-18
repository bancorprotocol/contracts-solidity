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

    IERC20Token public currencyToken;
    IERC20Token[] private convertPath;

    /**
    *   @dev constructor
    *
    *   @param  _token                smart token governed by the converter
    *   @param  _currencyToken        currency token for payment
    *   @param  _connectorToken       card connector for defining the first connector at deployment time
    *   @param  _hero_id              issuer's id
    *   @param  _team_wallet          Financie team wallet
    *   @param  _registry             address of a bancor converter extensions contract
    *   @param  _notifier_address     address of Financie Notifier contract
    *   @param  _heroFee              fee for financie hero, represented in ppm
    *   @param  _teamFee              fee for financie team, represented in ppm
    *   @param  _connectorWeight      weight for the initial connector
    *   @param  _internalWallet       internal wallet contract
    */
    constructor(
        ISmartToken _token,
        IERC20Token _currencyToken,
        IERC20Token _connectorToken,
        uint32      _hero_id,
        address     _team_wallet,
        IContractRegistry _registry,
        address     _notifier_address,
        uint32      _heroFee,
        uint32      _teamFee,
        uint32      _connectorWeight,
        address     _internalWallet
        )
        public
        BancorConverter(_token, _registry, 0, _connectorToken, _connectorWeight)
        FinancieNotifierDelegate(_notifier_address)
    {
        currencyToken = _currencyToken;

        setFee(_heroFee, _teamFee, _hero_id, _team_wallet, _currencyToken, _internalWallet, false);
    }

    function getVersion() public pure returns (uint256) {
        return 13;
    }

    function startTrading() public {
        notifyApproveNewBancor(address(connectorTokens[0]), address(this));
    }

    /**
    *   @dev Sell Card Tokens - required approval for this contract before calling this function
    *
    *   @param  _amount           amount of sale tokens in wei
    *   @param  _minReturn        minimum demands currency in wei, in case of lower result, the function will be failed
    */
    function sellCards(uint256 _amount, uint256 _minReturn) public returns (uint256, uint256, uint256) {
        convertPath = [connectorTokens[0], token, currencyToken];
        uint256 result = quickConvertInternal(convertPath, _amount, 1, this);

        uint256 feeAmount = distributeFees(result);
        uint256 net = safeSub(result, feeAmount);

        currencyToken.transfer(msg.sender, net);

        notifyConvertCards(msg.sender, address(connectorTokens[0]), address(currencyToken), _amount, net);
        assert(net >= _minReturn);

        // Notify logs of revenue
        notifyExchangeRevenue(msg.sender, address(this), address(connectorTokens[0]), hero_id, getHeroFee(result), getTeamFee(result));

        return (net, getHeroFee(result), getTeamFee(result));
    }

    /**
    *   @dev Buy Card Tokens - required specified amount of currency
    *
    *   @param  _amount           amount of purchase payment currency in wei
    *   @param  _minReturn        minimum demands cards in wei, in case of lower result, the function will be failed
    */
    function buyCards(uint256 _amount, uint256 _minReturn) public returns (uint256, uint256, uint256) {
        assert(currencyToken.transferFrom(msg.sender, this, getFinancieFee(_amount)));
        uint256 feeAmount = distributeFees(_amount);
        uint256 net = safeSub(_amount, feeAmount);

        convertPath = [currencyToken, token, connectorTokens[0]];
        uint256 result = quickConvertInternal(convertPath, net, 1, msg.sender);

        notifyConvertCards(msg.sender, address(currencyToken), address(connectorTokens[0]), _amount, result);
        assert(result >= _minReturn);

        // Notify logs of revenue
        notifyExchangeRevenue(msg.sender, address(this), address(currencyToken), hero_id, getHeroFee(_amount), getTeamFee(_amount));

        return (result, getHeroFee(_amount), getTeamFee(_amount));
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
        require(_fromToken == connectorTokens[0] || _fromToken == currencyToken);
        require(_toToken == currencyToken || _toToken == connectorTokens[0]);

        uint256 financieFee;
        uint256 bancorFee;
        uint256 totalFee;
        uint256 net;
        if ( _fromToken == connectorTokens[0] ) {
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

}
