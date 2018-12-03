pragma solidity ^0.4.24;

contract IBancorX {
    function xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _converionId) public;
    function markCompletedConversion(uint256 _conversionId) public;
    function getConversion(uint256 _conversionId) public returns (uint256, address, bool);
}