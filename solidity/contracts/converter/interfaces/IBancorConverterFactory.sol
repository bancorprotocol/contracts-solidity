pragma solidity ^0.4.24;
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
        IERC20Token _connectorToken,
        uint32 _connectorWeight
    )
    public returns (address);
}
