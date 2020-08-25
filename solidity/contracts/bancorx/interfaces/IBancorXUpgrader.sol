// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/*
    Bancor X Upgrader interface
*/
abstract contract IBancorXUpgrader {
    function upgrade(uint16 _version, address[] memory _reporters) public virtual;
}
