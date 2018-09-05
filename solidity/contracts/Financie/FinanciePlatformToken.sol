pragma solidity ^0.4.11;
import '../ERC20Token.sol';

/*
    **FROZEN**
    Financie token with predefined supply
*/
contract FinanciePlatformToken is ERC20Token {

    /**
    *   @dev Constructor
    *   @param _name 'Name' of ERC20-Token
    *   @param _symbol 'Symbol' of ERC20-Token
    *   @param _supply Total supply of token in wei, not additional issuable, burnable
    */
    function FinanciePlatformToken(string _name, string _symbol, uint256 _supply)
        public
        ERC20Token(_name, _symbol, 18)
    {
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
    }

}
