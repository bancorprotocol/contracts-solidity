pragma solidity ^0.4.10;
import './ERC20Token.sol';
import './IEtherToken.sol';

/*
    Ether tokenization contract
*/
contract EtherToken is ERC20Token, IEtherToken {
    // triggered when the total supply is increased
    event Issuance(uint256 _amount);
    // triggered when the total supply is decreased
    event Destruction(uint256 _amount);

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

        Issuance(msg.value);
        Transfer(this, msg.sender, msg.value);
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount)
        public
        validAmount(_amount)
    {
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount); // deduct the amount from the account balance
        totalSupply = safeSub(totalSupply, _amount); // decrease the total supply
        assert(msg.sender.send(_amount)); // send the amount

        Transfer(msg.sender, this, _amount);
        Destruction(_amount);
    }

    // ERC20 standard method overrides with some extra protection

    // send coins
    function transfer(address _to, uint256 _value)
        public
        returns (bool success)
    {
        require(_to != address(this));
        assert(super.transfer(_to, _value));
        return true;
    }

    // an account/contract attempts to get the coins
    function transferFrom(address _from, address _to, uint256 _value)
        public
        returns (bool success)
    {
        require(_to != address(this));
        assert(super.transferFrom(_from, _to, _value));
        return true;
    }

    // deposit ether in the account
    function() public payable {
        deposit();
    }
}
