pragma solidity ^0.4.24;

/*
    Bancor X Upgrader interface
*/
contract IBancorXUpgrader {
    function upgrade(uint16 _version) public;
}
