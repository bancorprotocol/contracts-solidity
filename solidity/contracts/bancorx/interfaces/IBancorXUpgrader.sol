pragma solidity 0.4.26;

/*
    Bancor X Upgrader interface
*/
contract IBancorXUpgrader {
    function upgrade(uint16 _version, address[] _reporters) public;
}
