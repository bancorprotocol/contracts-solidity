// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../converter/ConverterRegistry.sol";

contract TestConverterRegistry is ConverterRegistry {
    IConverter private _createdConverter;

    constructor(IContractRegistry registry) public ConverterRegistry(registry) {}

    function newConverter(
        uint16 converterType,
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint32 maxConversionFee,
        IReserveToken[] memory reserveTokens,
        uint32[] memory reserveWeights
    ) public override returns (IConverter) {
        _createdConverter = super.newConverter(
            converterType,
            name,
            symbol,
            decimals,
            maxConversionFee,
            reserveTokens,
            reserveWeights
        );

        return _createdConverter;
    }

    function createdConverter() external view returns (IConverter) {
        return _createdConverter;
    }
}
