pragma solidity ^0.4.10;
import './ERC20Token.sol';
import './Owned.sol';
import './ISmartToken.sol';
import './ITokenChanger.sol';

/*
    Smart Token v0.1
*/
contract SmartToken is ERC20Token, Owned, ISmartToken {
    string public version = '0.1';

    bool public transfersEnabled = true;    // true if transfer/transferFrom are enabled, false if not
    ITokenChanger public changer;           // changer contract address

    // triggered when a smart token is deployed - the _token address is defined for forward compatibility, in case we want to trigger the event from a factory
    event NewSmartToken(address _token);
    // triggered when a token changer is updated/removed
    event ChangerUpdate(address _prevChanger, address _newChanger);

    /*
        _name       token name
        _symbol     token short symbol, 1-6 characters
        _decimals   for display purposes only
    */
    function SmartToken(string _name, string _symbol, uint8 _decimals)
        ERC20Token(_name, _symbol, _decimals)
    {
        require(bytes(_symbol).length <= 6); // validate input
        NewSmartToken(address(this));
    }

    // verifies that an amount is greater than zero
    modifier validAmount(uint256 _amount) {
        require(_amount > 0);
        _;
    }

    // allows execution only when transfers aren't disabled
    modifier transfersAllowed {
        assert(transfersEnabled);
        _;
    }

    // allows execution by the current controller - owner if there's no changer defined or changer contract if a changer is defined
    modifier controllerOnly {
        assert((address(changer) == 0x0 && msg.sender == owner) ||
               (address(changer) != 0x0 && msg.sender == address(changer))); // validate state & permissions
        _;
    }

    /*
        disables/enables transfers
        can only be called by the token owner (if no changer is defined) or the changer contract (if a changer is defined)

        _disable    true to disable transfers, false to enable them
    */
    function disableTransfers(bool _disable) public controllerOnly {
        transfersEnabled = !_disable;
    }

    /*
        increases the token supply and sends the new tokens to an account
        can only be called by the token owner (if no changer is defined) or the changer contract (if a changer is defined)

        _to         account to receive the new amount
        _amount     amount to increase the supply by
    */
    function issue(address _to, uint256 _amount)
        public
        controllerOnly
        validAddress(_to)
        validAmount(_amount)
    {
        require(_to != address(this)); // validate input
        totalSupply = safeAdd(totalSupply, _amount);
        balanceOf[_to] = safeAdd(balanceOf[_to], _amount);
        Transfer(this, _to, _amount);
    }

    /*
        removes tokens from an account and decreases the token supply
        can only be called by the token owner (if no changer is defined) or the changer contract (if a changer is defined)

        _from       account to remove the new amount from
        _amount     amount to decrease the supply by
    */
    function destroy(address _from, uint256 _amount)
        public
        controllerOnly
        validAmount(_amount)
    {
        balanceOf[_from] = safeSub(balanceOf[_from], _amount);
        totalSupply = safeSub(totalSupply, _amount);
        Transfer(_from, this, _amount);
    }

    /*
        sets a changer contract address
        can only be called by the token owner (if no changer is defined) or the changer contract (if a changer is defined)
        the changer can be set to null to transfer ownership from the changer to the owner

        _changer    new changer contract address (can also be set to 0x0 to remove the current changer)
    */
    function setChanger(ITokenChanger _changer) public controllerOnly {
        require(_changer != changer);
        ITokenChanger prevChanger = changer;
        changer = _changer;
        ChangerUpdate(prevChanger, changer);
    }

    // ERC20 standard method overrides with some extra functionality

    // send coins
    function transfer(address _to, uint256 _value) public transfersAllowed returns (bool success) {
        assert(super.transfer(_to, _value));

        // transferring to the contract address destroys tokens
        if (_to == address(this)) {
            balanceOf[_to] -= _value;
            totalSupply -= _value;
        }

        return true;
    }

    // an account/contract attempts to get the coins
    function transferFrom(address _from, address _to, uint256 _value) public transfersAllowed returns (bool success) {
        assert(super.transferFrom(_from, _to, _value));

        // transferring to the contract address destroys tokens
        if (_to == address(this)) {
            balanceOf[_to] -= _value;
            totalSupply -= _value;
        }

        return true;
    }

    // fallback
    function() {
        assert(false);
    }
}
