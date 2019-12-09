pragma solidity 0.4.26;

interface IBancorConverterRegistryData {
    function addSmartToken(address _smartToken) external;
    function removeSmartToken(address _smartToken) external;
    function addLiquidityPool(address _liquidityPool) external;
    function removeLiquidityPool(address _liquidityPool) external;
    function addConvertibleToken(address _convertibleToken, address _smartToken) external;
    function removeConvertibleToken(address _convertibleToken, address _smartToken) external;
    function getSmartTokenCount() external view returns (uint);
    function getSmartTokenArray() external view returns (address[]);
    function getSmartToken(uint _index) external view returns (address);
    function getLiquidityPoolCount() external view returns (uint);
    function getLiquidityPoolArray() external view returns (address[]);
    function getLiquidityPool(uint _index) external view returns (address);
    function getConvertibleTokenCount() external view returns (uint);
    function getConvertibleTokenArray() external view returns (address[]);
    function getConvertibleToken(uint _index) external view returns (address);
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint);
    function getConvertibleTokenSmartTokenArray(address _convertibleToken) external view returns (address[]);
    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address);
}
