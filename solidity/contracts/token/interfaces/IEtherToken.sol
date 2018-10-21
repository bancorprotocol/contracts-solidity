pragma solidity ^0.4.24;
import './IERC20Token.sol';
import '../../utility/interfaces/ITokenHolder.sol';

/*
    Ether Token interface
*/
contract IEtherToken is ITokenHolder, IERC20Token {
    function deposit() public payable;
    function withdraw(uint256 _amount) public;
    function withdrawTo(address _to, uint256 _amount) public;
}
