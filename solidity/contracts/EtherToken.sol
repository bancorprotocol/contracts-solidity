pragma solidity ^0.4.11;
import './IEtherToken.sol';
import './ERC20Token.sol';
import './TokenHolder.sol';
import './Owned.sol';

/**
    Ether tokenization contract

    'Owned' is specified here for readability reasons
*/
contract EtherToken is IEtherToken, ERC20Token, Owned, TokenHolder {
    // triggered when the total supply is increased
    event Issuance(uint256 _amount);
    // triggered when the total supply is decreased
    event Destruction(uint256 _amount);

    /**
        @dev constructor
    */
    function EtherToken()
        ERC20Token('Ether Token', 'ETH', 18) {
    }

    /**
        @dev deposit ether in the account
    */
    function deposit()
        public
        payable
    {
        balanceOf[msg.sender] = safeAdd(balanceOf[msg.sender], msg.value); // add the value to the account balance
        totalSupply = safeAdd(totalSupply, msg.value); // increase the total supply

        Issuance(msg.value);
        Transfer(this, msg.sender, msg.value);
    }

    /**
        @dev withdraw ether from the account

        @param _amount  amount of ether to withdraw
    */
    function withdraw(uint256 _amount) public {
        balanceOf[msg.sender] = safeSub(balanceOf[msg.sender], _amount); // deduct the amount from the account balance
        totalSupply = safeSub(totalSupply, _amount); // decrease the total supply
        assert(msg.sender.send(_amount)); // send the amount

        Transfer(msg.sender, this, _amount);
        Destruction(_amount);
    }

    // ERC20 standard method overrides with some extra protection

    /**
        @dev send coins
        throws on any error rather then return a false flag to minimize user errors

        @param _to      target address
        @param _value   transfer amount

        @return true if the transfer was successful, false if it wasn't
    */
    function transfer(address _to, uint256 _value)
        public
        returns (bool success)
    {
        require(_to != address(this));
        assert(super.transfer(_to, _value));
        return true;
    }

    /**
        @dev an account/contract attempts to get the coins
        throws on any error rather then return a false flag to minimize user errors

        @param _from    source address
        @param _to      target address
        @param _value   transfer amount

        @return true if the transfer was successful, false if it wasn't
    */
    function transferFrom(address _from, address _to, uint256 _value)
        public
        returns (bool success)
    {
        require(_to != address(this));
        assert(super.transferFrom(_from, _to, _value));
        return true;
    }

    /**
        @dev deposit ether in the account
    */
    function() public payable {
        deposit();
    }
}
