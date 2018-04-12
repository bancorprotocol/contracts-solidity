pragma solidity ^0.4.18;
import './ISmartToken.sol';
import './IERC20Token.sol';
import './IBancorConverterExtensions.sol';

/*
    Bancor Converter Factory interface
*/
contract IBancorConverterFactory {
    function createConverter(ISmartToken _token, IBancorConverterExtensions _extensions, uint32 _maxConversionFee, IERC20Token _connectorToken, uint32 _connectorWeight) public returns (address);
}
