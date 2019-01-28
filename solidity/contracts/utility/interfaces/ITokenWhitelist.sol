pragma solidity ^0.4.24;

/*
    Token Whitelist interface
*/
contract ITokenWhitelist {
    mapping (address => bool) public whitelistedTokens;
}
