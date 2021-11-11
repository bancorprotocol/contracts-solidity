// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./IConverterAnchor.sol";

/**
 * @dev Typed Converter Anchor interface
 */
interface ITypedConverterAnchorFactory {
    function converterType() external pure returns (uint16);

    function name() external view returns (string calldata);

    function createAnchor(
        string memory anchorName,
        string memory symbol,
        uint8 decimals
    ) external returns (IConverterAnchor);
}
