// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/standard-pool/StandardPoolConverterFactory.sol";
import "./TestStandardPoolConverter.sol";

contract TestStandardPoolConverterFactory is StandardPoolConverterFactory {
    function createConverter(
        IConverterAnchor _anchor,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) external override returns (IConverter) {
        IConverter converter = new TestStandardPoolConverter(IDSToken(address(_anchor)), _registry, _maxConversionFee);
        converter.transferOwnership(msg.sender);
        return converter;
    }
}
