pragma solidity ^0.4.24;
import './BadERC20Token.sol';

/*
    Test token with predefined supply
*/
contract TestBadERC20Token is BadERC20Token {
    constructor(string _name, string _symbol, uint256 _supply)
        public
        BadERC20Token(_name, _symbol, 0)
    {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }
}
