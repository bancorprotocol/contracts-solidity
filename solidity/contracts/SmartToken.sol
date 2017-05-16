pragma solidity ^0.4.10;
import './BancorEventsDispatcher.sol';
import './ERC20Token.sol';
import './SmartTokenInterface.sol';

/*
    Smart Token v0.1
*/
contract SmartToken is ERC20Token, BancorEventsDispatcher, SmartTokenInterface {
    string public version = '0.1';
    uint8 public numDecimalUnits = 0;       // for display purposes only
    bool public transfersEnabled = true;    // true if transfer/transferFrom are enabled, false if not
    address public changer = 0x0;           // changer contract address

    // events, can be used to listen to the contract directly, as opposed to through the events contract
    event ChangerUpdate(address _prevChanger, address _newChanger);

    /*
        _name               token name
        _symbol             token short symbol, 1-6 characters
        _numDecimalUnits    for display purposes only
        _events             optional, address of a bancor events contract
    */
    function SmartToken(string _name, string _symbol, uint8 _numDecimalUnits, address _events)
        ERC20Token(_name, _symbol)
        BancorEventsDispatcher(_events)
    {
        require(bytes(_name).length != 0 && bytes(_symbol).length >= 1 && bytes(_symbol).length <= 6); // validate input
        numDecimalUnits = _numDecimalUnits;

        if (address(events) != 0x0)
            events.newToken();
    }

    // verifies that a value is greater than zero
    modifier validValue(uint256 _value) {
        require(_value > 0);
        _;
    }

    // allows execution only when transfers aren't disabled
    modifier transfersAllowed {
        assert(transfersEnabled);
        _;
    }

    // allows execution by the current controller - owner if there's no changer defined or changer contract if a changer is defined
    modifier controllerOnly {
        assert((changer == 0x0 && msg.sender == owner) ||
               (changer != 0x0 && msg.sender == changer)); // validate state & permissions
        _;
    }

    function setOwner(address _newOwner) public ownerOnly {
        address prevOwner = owner;
        super.setOwner(_newOwner);

        if (address(events) != 0x0)
            events.tokenOwnerUpdate(prevOwner, owner);
    }

    /*
        sets the number of display decimal units
        can only be called by the token owner

        _numDecimalUnits    new number of decimal units
    */
    function setNumDecimalUnits(uint8 _numDecimalUnits) public ownerOnly {
        numDecimalUnits = _numDecimalUnits;
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
        validValue(_amount)
    {
        require(_to != address(this)); // validate input
        totalSupply = safeAdd(totalSupply, _amount);
        balanceOf[_to] = safeAdd(balanceOf[_to], _amount);
        dispatchTransfer(this, _to, _amount);
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
        validValue(_amount)
    {
        balanceOf[_from] = safeSub(balanceOf[_from], _amount);
        totalSupply = safeSub(totalSupply, _amount);
        dispatchTransfer(_from, this, _amount);
    }

    /*
        sets a changer contract address
        can only be called by the token owner (if no changer is defined) or the changer contract (if a changer is defined)
        the changer can be set to null to transfer ownership from the changer to the owner

        _changer    new changer contract address (can also be set to 0x0 to remove the current changer)
    */
    function setChanger(address _changer) public controllerOnly {
        require(_changer != changer);
        address prevChanger = changer;
        changer = _changer;
        dispatchChangerUpdate(prevChanger, changer);
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

        if (address(events) != 0x0)
            events.tokenTransfer(msg.sender, _to, _value);
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

        if (address(events) != 0x0)
            events.tokenTransfer(_from, _to, _value);
        return true;
    }

    // allow another account/contract to spend some tokens on your behalf
    function approve(address _spender, uint256 _value) public returns (bool success) {
        assert(super.approve(_spender, _value));

        if (address(events) != 0x0)
            events.tokenApproval(msg.sender, _spender, _value);
        return true;
    }

    // utility

    function dispatchChangerUpdate(address _prevChanger, address _newChanger) private {
        ChangerUpdate(_prevChanger, _newChanger);

        if (address(events) != 0x0)
            events.tokenChangerUpdate(_prevChanger, _newChanger);
    }

    function dispatchTransfer(address _from, address _to, uint256 _value) private {
        Transfer(_from, _to, _value);

        if (address(events) != 0x0)
            events.tokenTransfer(_from, _to, _value);
    }

    // fallback
    function() {
        assert(false);
    }
}
