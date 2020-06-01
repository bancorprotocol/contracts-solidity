pragma solidity 0.4.26;
import "./IConverterAnchor.sol";

/*
    Typed Converter Anchor Factory interface
*/
contract ITypedConverterAnchorFactory {
    function converterType() public pure returns (uint8);
    function createAnchor(string _name, string _symbol, uint8 _decimals) public returns (IConverterAnchor);
}
