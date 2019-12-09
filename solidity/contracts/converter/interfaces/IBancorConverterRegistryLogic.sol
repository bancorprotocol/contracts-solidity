pragma solidity 0.4.26;
import './IBancorConverter.sol';

interface IBancorConverterRegistryLogic {
    function addConverter(IBancorConverter _converter) external;
    function removeConverter(IBancorConverter _converter) external;
    function getSmartTokenCount() external view returns (uint);
    function getSmartTokens() external view returns (address[]);
    function getSmartToken(uint _index) external view returns (address);
    function getLiquidityPoolCount() external view returns (uint);
    function getLiquidityPools() external view returns (address[]);
    function getLiquidityPool(uint _index) external view returns (address);
    function getConvertibleTokenCount() external view returns (uint);
    function getConvertibleTokens() external view returns (address[]);
    function getConvertibleToken(uint _index) external view returns (address);
    function getConvertibleTokenSmartTokenCount(address _convertibleToken) external view returns (uint);
    function getConvertibleTokenSmartTokens(address _convertibleToken) external view returns (address[]);
    function getConvertibleTokenSmartToken(address _convertibleToken, uint _index) external view returns (address);
}
