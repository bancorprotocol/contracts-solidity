pragma solidity ^0.4.10;
import './BancorEventsInterface.sol';

/*
    Open issues:
    - Anyone can send an event with an invalid address (_token/_changer is the msg sender's address) - shouldn't be an issue but point to consider.
      Essentially, the listener should make sure that it trusts the sender address before handling the event.
    - TokenChange event - the _trader isn't indexed so it's impossible to search for all changes a certain account initiated in a given token.
      This isn't a big deal since the same info can be obtained from the token contract itself and in that contract the _trader IS indexed.
*/
/*
    this contract allows intercepting events from multiple bancor contracts easily,
    by listening to events from a single contract instead of multiple ones
*/
contract BancorEvents is BancorEventsInterface {
    string public version = '0.1';

    event NewToken(address _token);
    event TokenOwnerUpdate(address indexed _token, address _prevOwner, address _newOwner);
    event TokenChangerUpdate(address indexed _token, address _prevChanger, address _newChanger);
    event TokenTransfer(address indexed _token, address indexed _from, address indexed _to, uint256 _value);
    event TokenApproval(address indexed _token, address indexed _owner, address indexed _spender, uint256 _value);
    event TokenChange(address indexed _changer, address indexed _fromToken, address indexed _toToken, address _trader, uint256 _amount, uint256 _return);

    function BancorEvents() {
    }

    function newToken() public {
        NewToken(msg.sender);
    }

    function tokenOwnerUpdate(address _prevOwner, address _newOwner) public {
        TokenOwnerUpdate(msg.sender, _prevOwner, _newOwner);
    }

    function tokenChangerUpdate(address _prevChanger, address _newChanger) public {
        TokenChangerUpdate(msg.sender, _prevChanger, _newChanger);
    }

    function tokenTransfer(address _from, address _to, uint256 _value) public {
        TokenTransfer(msg.sender, _from, _to, _value);
    }

    function tokenApproval(address _owner, address _spender, uint256 _value) public {
        TokenApproval(msg.sender, _owner, _spender, _value);
    }

    function tokenChange(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return) public {
        TokenChange(msg.sender, _fromToken, _toToken, _trader, _amount, _return);
    }

    function() {
        assert(false);
    }
}
