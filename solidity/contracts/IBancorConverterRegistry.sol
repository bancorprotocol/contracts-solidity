pragma solidity 0.4.26;

contract IBancorConverterRegistry {
    function tokens(uint256 _index) public view returns (address) { _index; }
    function tokenCount() public view returns (uint256);
    function converterCount(address _token) public view returns (uint256);
    function converterAddress(address _token, uint32 _index) public view returns (address);
    function latestConverterAddress(address _token) public view returns (address);
    function tokenAddress(address _converter) public view returns (address);
}
