pragma solidity ^0.4.10;
import './ERC20Token.sol';
import './IEtherToken.sol';

/*
    Ether tokenization contract
*/
contract EtherToken is ERC20Token, IEtherToken {
    function EtherToken()
        ERC20Token('Ether Token', 'ETH', 18) {
    }

    // verifies that an amount is greater than zero
    modifier validAmount(uint256 _amount) {
        require(_amount > 0);
        _;
    }

    // deposit ether in the account
    function deposit()
        public
        validAmount(msg.value)
        payable
    {
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], msg.value); // add the value to the account balance
        totalSupply = safeAdd(totalSupply, msg.value); // increase the total supply
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount)
        public
        validAmount(_amount)
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
