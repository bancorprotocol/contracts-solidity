pragma solidity ^0.4.9;

/*
    Open issues:
    - Anyone can send an event with an invalid address (_token is the msg sender's address) - shouldn't be an issue but point to consider
*/
/*
    this contract allows intercepting events from multiple bancor contracts easily,
    by listening to events from a single contract instead of multiple ones
*/
contract BancorEvents {
    string public version = '0.1';

    event NewToken(address _token);
    event TokenUpdate(address _token);
    event TokenTransfer(address indexed _token, address indexed _from, address indexed _to, uint256 _value);
    event TokenApproval(address indexed _token, address indexed _owner, address indexed _spender, uint256 _value);
    event TokenConversion(address indexed _token, address indexed _reserveToken, address indexed _trader, bool _isPurchase,
                          uint256 _totalSupply, uint256 _reserveBalance, uint256 _tokenAmount, uint256 _reserveAmount);

    function BancorEvents() {
    }

    function newToken() public {
        NewToken(msg.sender);
    }

    function tokenUpdate() public {
        TokenUpdate(msg.sender);
    }

    function tokenTransfer(address _from, address _to, uint256 _value) public {
        TokenTransfer(msg.sender, _from, _to, _value);
    }

    function tokenApproval(address _owner, address _spender, uint256 _value) public {
        TokenApproval(msg.sender, _owner, _spender, _value);
    }

    function tokenConversion(address _reserveToken, address _trader, bool _isPurchase, uint256 _totalSupply,
                             uint256 _reserveBalance, uint256 _tokenAmount, uint256 _reserveAmount) public {
        TokenConversion(msg.sender, _reserveToken, _trader, _isPurchase, _totalSupply, _reserveBalance, _tokenAmount, _reserveAmount);
    }

    function() {
        throw;
    }
}
