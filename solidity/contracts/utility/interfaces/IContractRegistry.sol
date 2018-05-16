pragma solidity ^0.4.21;

/*
    Contract Registry interface
*/
contract IContractRegistry {
    function getAddress(bytes32 _contractName) public view returns (address);
}
