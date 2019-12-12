pragma solidity 0.4.26;

interface IBancorConverterRegistryData {
    function addSmartToken(address _smartToken) external;
    function removeSmartToken(address _smartToken) external;
    function addLiquidityPool(address _liquidityPool) external;
    function removeLiquidityPool(address _liquidityPool) external;
    function addConvertibleToken(address _convertibleToken, address _smartToken) external;
    function removeConvertibleToken(address _convertibleToken, address _smartToken) external;
    function getSmartTokenCount() external view returns (uint);
    function getSmartTokens() external view returns (address[]);
    function getSmartToken(uint _index) external view returns (address);
    function isSmartToken(address _value) external view returns (bool);
    function getLiquidityPoolCount() external view returns (uint);
    function getLiquidityPools() external view returns (address[]);
    function getLiquidityPool(uint _index) external view returns (address);
    function isLiquidityPool(address _value) external view returns (bool);
    function getConvertibleTokenCount() external view returns (uint);
    function getConvertibleTokens() external view returns (address[]);
    function getConvertibleToken(uint _index) external view returns (address);
    function isConvertibleToken(address _value) external view returns (bool);
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint);
    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]);
    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address);
    function isConvertibleTokenSmartToken(address _convertibleToken, address _value) external view returns (bool);
}
