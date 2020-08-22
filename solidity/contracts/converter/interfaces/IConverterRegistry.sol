// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;

contract IConverterRegistry {
    function getAnchorCount() public view returns (uint256);
    function getAnchors() public view returns (address[]);
    function getAnchor(uint256 _index) public view returns (address);
    function isAnchor(address _value) public view returns (bool);
    function getLiquidityPoolCount() public view returns (uint256);
    function getLiquidityPools() public view returns (address[]);
    function getLiquidityPool(uint256 _index) public view returns (address);
    function isLiquidityPool(address _value) public view returns (bool);
    function getConvertibleTokenCount() public view returns (uint256);
    function getConvertibleTokens() public view returns (address[]);
    function getConvertibleToken(uint256 _index) public view returns (address);
    function isConvertibleToken(address _value) public view returns (bool);
    function getConvertibleTokenAnchorCount(address _convertibleToken) public view returns (uint256);
    function getConvertibleTokenAnchors(address _convertibleToken) public view returns (address[]);
    function getConvertibleTokenAnchor(address _convertibleToken, uint256 _index) public view returns (address);
    function isConvertibleTokenAnchor(address _convertibleToken, address _value) public view returns (bool);
}
