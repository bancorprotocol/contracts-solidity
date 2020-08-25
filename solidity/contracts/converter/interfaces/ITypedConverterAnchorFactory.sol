// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IConverterAnchor.sol";

/*
    Typed Converter Anchor Factory interface
*/
interface ITypedConverterAnchorFactory {
    function converterType() external pure returns (uint16);
    function createAnchor(string memory _name, string memory _symbol, uint8 _decimals) external returns (IConverterAnchor);
}
