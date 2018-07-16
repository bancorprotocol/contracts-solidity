pragma solidity ^0.4.18;
import './BancorConverter.sol';
import './interfaces/IFinancieCore.sol';
import './interfaces/IEtherToken.sol';

contract FinancieBancorConverter is BancorConverter {

    uint32 private constant MAX_FINANCIE_FEE = 1000000;

    IFinancieCore core;
    address hero_wallet;
    uint32 financieFee;
    IERC20Token[] public quickSellPath;

    /**
        @dev constructor

        @param  _token              smart token governed by the converter
        @param  _extensions         address of a bancor converter extensions contract
        @param  _financieFee        maximum conversion fee for financie platform, represented in ppm
        @param  _connectorToken     optional, initial connector, allows defining the first connector at deployment time
        @param  _connectorWeight    optional, weight for the initial connector
    */
    function FinancieBancorConverter(
        ISmartToken _token,
        IEtherToken _etherToken,
        IERC20Token _connectorToken,
        address _hero_wallet,
        IBancorConverterExtensions _extensions,
        address _core_address,
        uint32 _financieFee,
        uint32 _connectorWeight)
        public
        BancorConverter(_token, _extensions, 0, _connectorToken, _connectorWeight)
    {
        core = IFinancieCore(_core_address);
        hero_wallet = _hero_wallet;
        financieFee = _financieFee;

        // when receiving ether, then deposit to ether token -> change to smart token -> change to connector token
        quickBuyPath.push(_etherToken);
        quickBuyPath.push(_token);
        quickBuyPath.push(_connectorToken);

        quickSellPath.push(_connectorToken);
        quickSellPath.push(_token);
        quickSellPath.push(_etherToken);
    }

    function distributeFees(uint256 _feeAmount) private {
        uint256 feeAmountForTeam = _feeAmount / 2;
        uint256 feeAmountForHero = safeSub(_feeAmount, feeAmountForTeam);
        IEtherToken etherToken = IEtherToken(quickBuyPath[0]);
        etherToken.deposit.value(feeAmountForTeam)();
        hero_wallet.transfer(feeAmountForHero);
    }

    function getFinancieFee(uint256 _amount) private view returns (uint256) {
        return safeMul(_amount, financieFee) / MAX_FINANCIE_FEE;
    }

    /**
        @dev overridden
    */
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn)
        public
        payable
        validConversionPath(_path)
        returns (uint256)
    {
        IBancorQuickConverter quickConverter = extensions.quickConverter();
        uint256 result = quickConverter.convertFor.value(_amount)(_path, _amount, _minReturn, msg.sender);

        core.notifyConvertCards(msg.sender, address(_path[0]), address(_path[2]), _amount, result);

        return result;
    }

    /**
        @dev overridden
    */
    function convert(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256) {
        require(_fromToken != _toToken); // validate input

        uint256 result = super.convert(_fromToken, _toToken, _amount, _minReturn);

        core.notifyConvertCards(msg.sender, address(_fromToken), address(_toToken), _amount, result);

        return result;
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
