// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;

/*
    Bancor X Upgrader interface
*/
contract IBancorXUpgrader {
    function upgrade(uint16 _version, address[] _reporters) public;
}
