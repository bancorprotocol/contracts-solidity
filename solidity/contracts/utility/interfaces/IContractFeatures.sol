pragma solidity ^0.4.21;

/*
    Contract Features interface
*/
contract IContractFeatures {
    function isSupported(address _contract, uint256 _feature) public returns (bool);
    function enableFeature(uint256 _feature, bool _enable) public;
}
