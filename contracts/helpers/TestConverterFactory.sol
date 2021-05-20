// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/ConverterFactory.sol";

/*
    Utils test helper that exposes the converter factory functions
*/
contract TestConverterFactory is ConverterFactory {
    IConverter public createdConverter;
    IConverterAnchor public createdAnchor;

    function createAnchor(
        uint16 converterType,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public override returns (IConverterAnchor) {
        createdAnchor = super.createAnchor(converterType, name, symbol, decimals);

        return createdAnchor;
    }

    function createConverter(
        uint16 converterType,
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) public override returns (IConverter) {
        createdConverter = super.createConverter(converterType, anchor, registry, maxConversionFee);

        return createdConverter;
    }
}
