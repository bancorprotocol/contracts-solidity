pragma solidity 0.4.26;
import '../../token/interfaces/IERC20Token.sol';
import '../../token/interfaces/ISmartToken.sol';
import '../../utility/interfaces/IContractRegistry.sol';

/*
    Bancor Converter Factory interface
*/
contract IBancorConverterFactory {
    function createConverter(
        ISmartToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee,
        IERC20Token _reserveToken,
        uint32 _reserveRatio
    )
    public returns (address);
}
