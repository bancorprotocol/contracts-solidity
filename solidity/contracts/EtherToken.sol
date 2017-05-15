pragma solidity ^0.4.10;
import './ERC20Token.sol';

/*
    Ether tokenization contract
*/
contract EtherToken is ERC20Token {
    function EtherToken()
        ERC20Token('Ether Token', 'ETH') {
    }

    // verifies that a transfer value is greater than zero
    modifier validValue(uint256 _value) {
        require(_value > 0);
        _;
    }

    // deposit ether in the account
    function deposit()
        public
        validValue(msg.value)
        payable
    {
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], msg.value); // add the value to the account balance
        totalSupply = safeAdd(totalSupply, msg.value); // increase the total supply
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount)
        public
        validValue(_amount)
    {
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount); // deduct the amount from the account balance
        totalSupply = safeSub(totalSupply, _amount); // decrease the total supply
        assert(msg.sender.send(_amount)); // send the amount
    }

    // deposit ether in the account
    function() public payable {
        deposit();
    }
}
