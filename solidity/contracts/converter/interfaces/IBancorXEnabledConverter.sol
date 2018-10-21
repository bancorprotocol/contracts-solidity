pragma solidity ^0.4.24;

/**
    BancorXEnabledConverter interface
 */
contract IBancorXEnabledConverter {
    function claimTokens(address _from, uint256 _amount) public;
}
