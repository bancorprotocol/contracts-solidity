pragma solidity ^0.4.24;
import './Owned.sol';
import './interfaces/ITokenWhitelist.sol';

/*
    Token Whitelist

    manages tokens who don't return true/false on transfer/transferFrom but revert on failure instead 
*/
contract TokenWhitelist is ITokenWhitelist, Owned {

    mapping (address => bool) public whitelistedTokens;

    /**
        @dev constructor
    */
    constructor() public {

    }

    function setToken(address token, bool status) public ownerOnly {
        whitelistedTokens[token] = status;
    }
}