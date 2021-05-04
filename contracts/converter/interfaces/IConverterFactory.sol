// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IConverter.sol";
import "./IConverterAnchor.sol";
import "../../utility/interfaces/IContractRegistry.sol";

/*
    Converter Factory interface
*/
interface IConverterFactory {
    function createAnchor(
        uint16 converterType,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external returns (IConverterAnchor);

    function createConverter(
        uint16 converterType,
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) external returns (IConverter);
}
