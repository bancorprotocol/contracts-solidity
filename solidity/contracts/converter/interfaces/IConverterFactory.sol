pragma solidity 0.4.26;
import './IConverter.sol';
import './IConverterAnchor.sol';
import '../../utility/interfaces/IContractRegistry.sol';

/*
    Converter Factory interface
*/
contract IConverterFactory {
    function createAnchor(uint8 _type, string _name, string _symbol, uint8 _decimals) public returns (IConverterAnchor);
    function createConverter(uint8 _type, IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter);
}
