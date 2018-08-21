pragma solidity ^0.4.18;
import '../BancorConverter.sol';
import './FinancieFee.sol';
import './IFinancieNotifier.sol';
import '../interfaces/IEtherToken.sol';

contract FinancieBancorConverter is BancorConverter, FinancieFee {

    IFinancieNotifier notifier;
    IERC20Token[] public quickSellPath;

    /**
        @dev constructor

        @param  _token              smart token governed by the converter
        @param  _connectorToken     optional, initial connector, allows defining the first connector at deployment time
        @param  _extensions         address of a bancor converter extensions contract
        @param  _heroFee            fee for financie hero, represented in ppm
        @param  _teamFee            fee for financie team, represented in ppm
        @param  _connectorWeight    optional, weight for the initial connector
    */
    function FinancieBancorConverter(
        ISmartToken _token,
        IEtherToken _etherToken,
        IERC20Token _connectorToken,
        address _hero_wallet,
        address _team_wallet,
        IBancorConverterExtensions _extensions,
        address _notifier_address,
        uint32 _heroFee,
        uint32 _teamFee,
        uint32 _connectorWeight)
        public
        BancorConverter(_token, _extensions, 0, _connectorToken, _connectorWeight)
        FinancieFee(_heroFee, _teamFee, _hero_wallet, _team_wallet)
    {
        notifier = IFinancieNotifier(_notifier_address);

        // when receiving ether, then deposit to ether token -> change to smart token -> change to connector token
        quickBuyPath.push(_etherToken);
        quickBuyPath.push(_token);
        quickBuyPath.push(_connectorToken);

        quickSellPath.push(_connectorToken);
        quickSellPath.push(_token);
        quickSellPath.push(_etherToken);
    }

    function getVersion() public view returns (uint256) {
        return 6;
    }

    /**

    */
    function sellCards(uint256 _amount, uint256 _minReturn) public returns (uint256) {
        uint256 result = quickConvertInternal(quickSellPath, _amount, 1, this);

        uint256 feeAmount = distributeFees(result);
        uint256 net = safeSub(result, feeAmount);

        msg.sender.transfer(net);

        notifier.notifyConvertCards(msg.sender, address(quickSellPath[0]), address(quickSellPath[2]), _amount, net);
        assert(result >= _minReturn);

        return result;
    }

    /**

    */
    function buyCards(uint256 _amount, uint256 _minReturn) payable public returns (uint256) {
        uint256 feeAmount = distributeFees(_amount);
        uint256 net = safeSub(_amount, feeAmount);

        uint256 result = quickConvertInternal(quickBuyPath, net, 1, msg.sender);

        notifier.notifyConvertCards(msg.sender, address(quickBuyPath[0]), address(quickBuyPath[2]), _amount, result);
        assert(result >= _minReturn);

        return result;
    }

    function quickConvertInternal(IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _spender)
        internal
        validConversionPath(_path)
        returns (uint256)
    {
        IERC20Token fromToken = _path[0];
        IBancorQuickConverter quickConverter = extensions.quickConverter();
        if ( msg.value == 0 ) {
            assert(fromToken.transferFrom(msg.sender, quickConverter, _amount));
            return quickConverter.convertFor.value(0)(_path, _amount, _minReturn, _spender);
        } else {
            return quickConverter.convertFor.value(_amount)(_path, _amount, _minReturn, _spender);
        }
    }

    /**
        @dev overridden
    */
    function() payable public {
    }

    /**
        @dev overridden
    */
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public view returns (uint256) {
        require(_fromToken == quickSellPath[0] || _fromToken == quickBuyPath[0]);
        require(_toToken == quickSellPath[2] || _toToken == quickBuyPath[2]);

        if ( _fromToken == quickSellPath[0] ) {
            uint256 grossSell = super.getReturn(_fromToken, _toToken, _amount);
            return safeSub(grossSell, getFinancieFee(grossSell));
        } else {
            return super.getReturn(_fromToken, _toToken, safeSub(_amount, getFinancieFee(_amount)));
        }

    }

}
