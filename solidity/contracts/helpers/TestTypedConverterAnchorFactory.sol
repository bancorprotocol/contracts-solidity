pragma solidity 0.4.26;
import "../converter/interfaces/IConverterAnchor.sol";
import "../converter/interfaces/ITypedConverterAnchorFactory.sol";
import "../token/SmartToken.sol";

contract TestTypedConverterAnchorFactory is ITypedConverterAnchorFactory {
    string public name;

    constructor(string _name) public {
        name = _name;
    }

    function converterType() public pure returns (uint16) {
        return 8;
    }

    function createAnchor(string /*_name */, string _symbol, uint8 _decimals) public returns (IConverterAnchor) {
        IConverterAnchor anchor = new SmartToken(name, _symbol, _decimals);

        anchor.transferOwnership(msg.sender);

        return anchor;
    }
}
