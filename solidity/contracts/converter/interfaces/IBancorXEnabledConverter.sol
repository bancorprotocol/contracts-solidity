pragma solidity ^0.4.24;

contract IBancorXEnabledConverter {
    // new method for BancorX
    function claimTokens(address _from, uint256 _amount) public;
}