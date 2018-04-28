pragma solidity ^0.4.21;
import './IBancorConverterExtensions.sol';
import '../../token/interfaces/IERC20Token.sol';
import '../../token/interfaces/ISmartToken.sol';

/*
    Bancor Converter Factory interface
*/
contract IBancorConverterFactory {
    function createConverter(ISmartToken _token, IBancorConverterExtensions _extensions, uint32 _maxConversionFee, IERC20Token _connectorToken, uint32 _connectorWeight) public returns (address);
}
