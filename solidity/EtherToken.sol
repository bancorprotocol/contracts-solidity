pragma solidity ^0.4.10;
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
        assert(balanceOf[msg.sender] + msg.value >= balanceOf[msg.sender]); // overflow protection
        balanceOf[msg.sender] += msg.value;
        return true;
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount) public returns (bool success) {
        require(_amount <= balanceOf[msg.sender]); // balance check

        // deduct the amount from the account balance
        balanceOf[msg.sender] -= _amount;
        // send the amount
        assert(msg.sender.send(_amount));
        return true;
    }

    // deposit ether in the account - identical to deposit function
    function() public payable {
        assert(balanceOf[msg.sender] + msg.value >= balanceOf[msg.sender]); // overflow protection
        balanceOf[msg.sender] += msg.value;
    }
}
