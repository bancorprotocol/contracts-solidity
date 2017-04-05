pragma solidity ^0.4.8;

/*
    Open issues:
    - throw vs. return value?
*/

contract BancorEtherToken {
    string public standard = 'Token 0.1';
    string public name = "Bancor Network Ether";
    string public symbol = "BNE";
    uint256 public totalSupply = 0;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    function BancorEtherToken() {
    }

    // send coins
    function transfer(address _to, uint256 _value) public returns (bool success) {
        if (balanceOf[msg.sender] < _value) // balance check
            throw;
        if (balanceOf[_to] + _value < balanceOf[_to]) // overflow protection
            throw;

        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
        Transfer(msg.sender, _to, _value);
        return true;
    }

    // allow another account/contract to spend some tokens on your behalf
    function approve(address _spender, uint256 _value) public returns (bool success) {
        // if the allowance isn't 0, it can only be updated to 0 to prevent an allowance change immediately after withdrawal
        if (_value != 0 && allowance[msg.sender][_spender] != 0)
            throw;

        allowance[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    // an account/contract attempts to get the coins
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        if (balanceOf[_from] < _value) // balance check
            throw;
        if (balanceOf[_to] + _value < balanceOf[_to]) // overflow protection
            throw;
        if (_value > allowance[_from][msg.sender]) // allowance check
            throw;

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        allowance[_from][msg.sender] -= _value;
        Transfer(_from, _to, _value);
        return true;
    }

    // deposit ether in the account
    function deposit() public payable returns (bool success) {
        if (balanceOf[msg.sender] + msg.value < balanceOf[msg.sender]) // overflow protection
            throw;

        balanceOf[msg.sender] += msg.value;
        return true;
    }

    // withdraw ether from the account
    function withdraw(uint256 _amount) public returns (bool success) {
        if (balanceOf[msg.sender] < _amount) // balance check
            throw;

        // deduct the amount from the account balance
        balanceOf[msg.sender] -= _amount;
        // send the amount
        if (!msg.sender.send(_amount))
            throw;

        return true;
    }

    // deposit ether in the account - identical to deposit function
    function() public payable {
        if (balanceOf[msg.sender] + msg.value < balanceOf[msg.sender]) // overflow protection
            throw;

        balanceOf[msg.sender] += msg.value;
    }
}
