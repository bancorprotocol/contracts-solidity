pragma solidity ^0.4.18;

/*
    Whitelist interface
*/
contract IWhitelist {
    function isWhitelisted(address _address) public returns (bool);
}
