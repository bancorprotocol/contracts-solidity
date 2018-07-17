pragma solidity ^0.4.11;
import '../ERC20Token.sol';

/*
    Test token with predefined supply
*/
contract FinanciePlatformToken is ERC20Token {
    function FinanciePlatformToken(string _name, string _symbol, uint256 _supply)
        public
        ERC20Token(_name, _symbol, 18)
    {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }
}
