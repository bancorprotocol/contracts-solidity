pragma solidity ^0.4.8;

/*
    Open issues:
    - throw vs. return value?
    - approve - to minimize the risk of the approve/transferFrom attack vector
                (see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/), approve has to be called twice
                in 2 separate transactions - once to change the allowance to 0 and secondly to change it to the new allowance value
*/

/*
    ERC20 Standard Token implementation
*/
contract ERC20Token {
    string public standard = 'Token 0.1';
    string public name = '';
    string public symbol = '';
    uint256 public totalSupply = 0;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    function ERC20Token(string _name, string _symbol) {
        name = _name;
        symbol = _symbol;
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
}
