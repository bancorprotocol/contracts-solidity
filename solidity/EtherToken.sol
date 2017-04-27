pragma solidity ^0.4.10;
import './StandardToken.sol';

/*
    Ether tokenization contract
*/
contract EtherToken is StandardToken {
    function EtherToken()
        StandardToken('Ether Token', 'ETH') {
    }

    // deposit ether in the account
    function deposit() public payable returns (bool success) {
        assert(balanceOf[msg.sender] + msg.value >= balanceOf[msg.sender]); // overflow protection
        balanceOf[msg.sender] += msg.value; // add the balance to the account balance
        totalSupply += msg.value; // increase the total supply
        return true;
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount) public returns (bool success) {
        require(_amount <= balanceOf[msg.sender]); // balance check
        balanceOf[msg.sender] -= _amount; // deduct the amount from the account balance
        totalSupply -= _amount; // decrease the total supply
        assert(msg.sender.send(_amount)); // send the amount
        return true;
    }

    // deposit ether in the account - identical to deposit function
    function() public payable {
        assert(balanceOf[msg.sender] + msg.value >= balanceOf[msg.sender]); // overflow protection
        balanceOf[msg.sender] += msg.value; // add the balance to the account
        totalSupply += msg.value; // increase the total supply
    }
}
