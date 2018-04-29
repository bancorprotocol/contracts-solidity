pragma solidity ^0.4.21;

/*
    Contract Features interface
*/
contract IContractFeatures {
    function isSupported(address _contract, uint256 _feature) public returns (bool);
    function enableFeatures(uint256 _features, bool _enable) public;
}
