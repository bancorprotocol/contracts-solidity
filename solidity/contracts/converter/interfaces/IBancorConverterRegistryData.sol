pragma solidity 0.4.26;

interface IBancorConverterRegistryData {
    function addLiquidityPool(address _liquidityPool) external;
    function removeLiquidityPool(address _liquidityPool) external;
    function addConvertibleToken(address _convertibleToken, address _smartToken) external;
    function removeConvertibleToken(address _convertibleToken, address _smartToken) external;
    function getLiquidityPoolCount() external view returns (uint);
    function getLiquidityPoolArray() external view returns (address[]);
    function getLiquidityPool(uint _index) external view returns (address);
    function getConvertibleTokenCount() external view returns (uint);
    function getConvertibleTokenArray() external view returns (address[]);
    function getConvertibleToken(uint _index) external view returns (address);
    function getSmartTokenCount(address _convertibleToken) external view returns (uint);
    function getSmartTokenArray(address _convertibleToken) external view returns (address[]);
    function getSmartToken(address _convertibleToken, uint _index) external view returns (address);
}
