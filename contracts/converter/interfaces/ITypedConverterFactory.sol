// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./IConverter.sol";
import "./IConverterAnchor.sol";
import "../../utility/interfaces/IContractRegistry.sol";

/**
 * @dev Typed Converter Factory interface
 */
interface ITypedConverterFactory {
    function converterType() external pure returns (uint16);

    function createConverter(
        IConverterAnchor anchor,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) external returns (IConverter);
}
