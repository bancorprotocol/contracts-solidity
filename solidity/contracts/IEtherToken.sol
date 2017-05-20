pragma solidity ^0.4.10;
import './IERC20Token.sol';

/*
    Ether Token interface
*/
contract IEtherToken is IERC20Token {
    function deposit() public payable;
    function withdraw(uint256 _amount) public;
}
