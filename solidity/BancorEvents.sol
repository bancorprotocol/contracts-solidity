pragma solidity ^0.4.8;

/*
    Open issues:
    - Anyone can send an event with an invalid address (_token/_sender is the msg sender's address) - shouldn't be an issue but point to consider.
      Essentially, the listener should make sure that it trusts the sender address before handling the event.
    - TokenChange event - the _changer isn't indexed so it's impossible to search for all changes a certain account initiated in a given token.
      This isn't a big deal since the same info can be obtained from the token contract itself and in that contract the _changer IS indexed.
*/
/*
    this contract allows intercepting events from multiple bancor contracts easily,
    by listening to events from a single contract instead of multiple ones
*/
contract BancorEvents {
    string public version = '0.1';

    event NewToken(address _token);
    event TokenUpdate(address indexed _token);
    event NewTokenOwner(address indexed _token, address indexed _prevOwner, address indexed _newOwner);
    event TokenTransfer(address indexed _token, address indexed _from, address indexed _to, uint256 _value);
    event TokenApproval(address indexed _token, address indexed _owner, address indexed _spender, uint256 _value);
    event TokenChange(address indexed _sender, address indexed _fromToken, address indexed _toToken, address _changer, uint256 _amount, uint256 _return);

    function BancorEvents() {
    }

    function newToken() public {
        NewToken(msg.sender);
    }

    function tokenUpdate() public {
        TokenUpdate(msg.sender);
    }

    function newTokenOwner(address _prevOwner, address _newOwner) public {
        NewTokenOwner(msg.sender, _prevOwner, _newOwner);
    }

    function tokenTransfer(address _from, address _to, uint256 _value) public {
        TokenTransfer(msg.sender, _from, _to, _value);
    }

    function tokenApproval(address _owner, address _spender, uint256 _value) public {
        TokenApproval(msg.sender, _owner, _spender, _value);
    }

    function tokenChange(address _fromToken, address _toToken, address _changer, uint256 _amount, uint256 _return) public {
        TokenChange(msg.sender, _fromToken, _toToken, _changer, _amount, _return);
    }

    function() {
        throw;
    }
}
