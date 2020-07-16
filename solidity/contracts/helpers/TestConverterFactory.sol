pragma solidity 0.4.26;
import "../converter/ConverterFactory.sol";

/*
    Utils test helper that exposes the converter factory functions
*/
contract TestConverterFactory is ConverterFactory {
    IConverter public createdConverter;
    IConverterAnchor public createdAnchor;

    function createAnchor(uint16 _converterType, string _name, string _symbol, uint8 _decimals) public returns (IConverterAnchor) {
        createdAnchor = super.createAnchor(_converterType, _name, _symbol, _decimals);

        return createdAnchor;
    }

    function createConverter(uint16 _type, IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter) {
        createdConverter = super.createConverter(_type, _anchor, _registry, _maxConversionFee);

        return createdConverter;
    }
}
