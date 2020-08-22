// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;

interface IConverterRegistryData {
    function addSmartToken(address _smartToken) external;
    function removeSmartToken(address _smartToken) external;
    function addLiquidityPool(address _liquidityPool) external;
    function removeLiquidityPool(address _liquidityPool) external;
    function addConvertibleToken(address _convertibleToken, address _smartToken) external;
    function removeConvertibleToken(address _convertibleToken, address _smartToken) external;
    function getSmartTokenCount() external view returns (uint256);
    function getSmartTokens() external view returns (address[] memory);
    function getSmartToken(uint256 _index) external view returns (address);
    function isSmartToken(address _value) external view returns (bool);
    function getLiquidityPoolCount() external view returns (uint256);
    function getLiquidityPools() external view returns (address[] memory);
    function getLiquidityPool(uint256 _index) external view returns (address);
    function isLiquidityPool(address _value) external view returns (bool);
    function getConvertibleTokenCount() external view returns (uint256);
    function getConvertibleTokens() external view returns (address[] memory);
    function getConvertibleToken(uint256 _index) external view returns (address);
    function isConvertibleToken(address _value) external view returns (bool);
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint256);
    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[] memory);
    function getConvertibleTokenSmartToken(address _convertibleToken, uint256 _index) external view returns (address);
    function isConvertibleTokenSmartToken(address _convertibleToken, address _value) external view returns (bool);
}
