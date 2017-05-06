pragma solidity ^0.4.10;

/*
    ERC20 Standard Token interface
*/
contract ERC20TokenInterface {
    // these functions aren't abstract since the compiler doesn't recognize automatically generated getter functions as functions
    function totalSupply() public constant returns (uint256 totalSupply) {}
    function balanceOf(address _owner) public constant returns (uint256 balance) {}
    function allowance(address _owner, address _spender) public constant returns (uint256 remaining) {}

    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
    function approve(address _spender, uint256 _value) public returns (bool success);
}
