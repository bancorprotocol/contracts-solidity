pragma solidity 0.4.26;
import './NonStandardERC20Token.sol';

/*
    Test token with predefined supply
*/
contract TestNonStandardERC20Token is NonStandardERC20Token {
    constructor(string _name, string _symbol, uint256 _supply)
        public
        NonStandardERC20Token(_name, _symbol, 0)
    {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }
}
