// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../converter/ConverterFactory.sol";

/*
    Utils test helper that exposes the converter factory functions
*/
contract TestConverterFactory {
    ConverterFactory factory = new ConverterFactory();

    IConverter public createdConverter;
    IConverterAnchor public createdAnchor;

    function createAnchor(uint16 _converterType, string memory _name, string memory _symbol, uint8 _decimals) public returns (IConverterAnchor) {
        createdAnchor = factory.createAnchor(_converterType, _name, _symbol, _decimals);
        return createdAnchor;
    }

    function createConverter(uint16 _type, IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter) {
        createdConverter = factory.createConverter(_type, _anchor, _registry, _maxConversionFee);
        return createdConverter;
    }
}
