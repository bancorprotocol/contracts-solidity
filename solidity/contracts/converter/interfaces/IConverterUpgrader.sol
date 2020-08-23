// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;

/*
    Converter Upgrader interface
*/
abstract contract IConverterUpgrader {
    function upgrade(bytes32 _version) public virtual;
    function upgrade(uint16 _version) public virtual;
}
