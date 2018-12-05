pragma solidity ^0.4.24;

contract IBancorX {
    function xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _conversionId) public;
    function markConversionCompleted(uint256 _conversionId) public;
    function getUncompletedConversion(uint256 _conversionId) public view returns (uint256, address);
}