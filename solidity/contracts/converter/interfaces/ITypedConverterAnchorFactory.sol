// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./IConverterAnchor.sol";

/*
    Typed Converter Anchor Factory interface
*/
contract ITypedConverterAnchorFactory {
    function converterType() public pure returns (uint16);
    function createAnchor(string memory _name, string memory _symbol, uint8 _decimals) public returns (IConverterAnchor);
}
