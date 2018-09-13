pragma solidity ^0.4.23;
import './IBancorConverter.sol';

/*
    Bancor Converter Upgrader interface
*/
contract IBancorConverterUpgrader {
    function upgrade(IBancorConverter _converter, bytes32 _version) public;
}
