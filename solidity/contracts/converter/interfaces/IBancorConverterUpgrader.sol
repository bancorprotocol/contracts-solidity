pragma solidity 0.4.26;
import './IBancorConverter.sol';

/*
    Bancor Converter Upgrader interface
*/
contract IBancorConverterUpgrader {
    function upgrade(bytes32 _version) public;
    function upgrade(uint16 _version) public;
}
