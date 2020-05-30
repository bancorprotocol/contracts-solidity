pragma solidity 0.4.26;
import "../../token/interfaces/ISmartToken.sol";

/*
    Typed Smart Token Factory interface
*/
contract ITypedSmartTokenFactory {
    function converterType() public pure returns (uint8);
    function createSmartToken(string _name, string _symbol, uint8 _decimals) public returns (ISmartToken);
}
