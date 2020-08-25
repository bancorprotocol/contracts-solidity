// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IConverter.sol";
import "./IConverterAnchor.sol";
import "./ITypedConverterCustomFactory.sol";
import "../../utility/interfaces/IContractRegistry.sol";

/*
    Converter Factory interface
*/
interface IConverterFactory {
    function createAnchor(uint16 _type, string memory _name, string memory _symbol, uint8 _decimals) external returns (IConverterAnchor);
    function createConverter(uint16 _type, IConverterAnchor _anchor, IContractRegistry _registry, uint32 _maxConversionFee) external returns (IConverter);

    function customFactories(uint16 _type) external view returns (ITypedConverterCustomFactory);
}
