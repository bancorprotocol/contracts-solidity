pragma solidity ^0.4.15;

/*
    ERC20 Standard Token interface
*/
contract IERC20Token {
    // these functions aren't abstract since the compiler emits automatically generated getter functions as external
    function name() public constant returns (string) { name; }
    function symbol() public constant returns (string) { symbol; }
    function decimals() public constant returns (uint8) { decimals; }
    function totalSupply() public constant returns (uint256) { totalSupply; }
    function balanceOf(address _owner) public constant returns (uint256 balance) { _owner; balance; }
    function allowance(address _owner, address _spender) public constant returns (uint256 remaining) { _owner; _spender; remaining; }

    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
    function approve(address _spender, uint256 _value) public returns (bool success);
}
