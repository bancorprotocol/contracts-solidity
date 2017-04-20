pragma solidity ^0.4.8;
import './ERC20Token.sol';

/*
    Open issues:
    - throw vs. return value?
*/

contract EtherToken is ERC20Token {
    function EtherToken()
        ERC20Token('Ether Token', 'ETH') {
    }

    // deposit ether in the account
    function deposit() public payable returns (bool success) {
        if (balanceOf[msg.sender] + msg.value < balanceOf[msg.sender]) // overflow protection
            throw;

        balanceOf[msg.sender] += msg.value;
        return true;
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount) public returns (bool success) {
        if (balanceOf[msg.sender] < _amount) // balance check
            throw;

        // deduct the amount from the account balance
        balanceOf[msg.sender] -= _amount;
        // send the amount
        if (!msg.sender.send(_amount))
            throw;

        return true;
    }

    // deposit ether in the account - identical to deposit function
    function() public payable {
        if (balanceOf[msg.sender] + msg.value < balanceOf[msg.sender]) // overflow protection
            throw;

        balanceOf[msg.sender] += msg.value;
    }
}
