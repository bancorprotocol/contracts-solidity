pragma solidity ^0.4.24;
import '../token/ERC20Token.sol';

/*
    Test token with predefined supply
*/
contract TestERC20Token is ERC20Token {
    constructor(string _name, string _symbol, uint256 _supply)
        public
        ERC20Token(_name, _symbol, 0)
    {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }
}
