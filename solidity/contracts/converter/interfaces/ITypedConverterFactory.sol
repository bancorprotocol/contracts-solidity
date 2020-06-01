pragma solidity 0.4.26;
import "./IConverter.sol";
import "./IConverterAnchor.sol";
import "../../utility/interfaces/IContractRegistry.sol";

/*
    Typed Converter Factory interface
*/
contract ITypedConverterFactory {
    function converterType() public pure returns (uint8);
    function createConverter(IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) public returns (IConverter);
}
