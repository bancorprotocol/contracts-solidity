// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./IConverter.sol";
import "./IConverterAnchor.sol";
import "../../utility/interfaces/IContractRegistry.sol";

/*
    Typed Converter Factory interface
*/
contract ITypedConverterFactory {
    function converterType() public pure returns (uint16);
    function createConverter(IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter);
}
