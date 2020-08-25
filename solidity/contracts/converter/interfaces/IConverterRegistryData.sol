// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IConverterAnchor.sol";

interface IConverterRegistryData {
    function addSmartToken(IConverterAnchor _anchor) external;
    function removeSmartToken(IConverterAnchor _anchor) external;

    function addLiquidityPool(IConverterAnchor _liquidityPoolAnchor) external;
    function removeLiquidityPool(IConverterAnchor _liquidityPoolAnchor) external;

    function addConvertibleToken(IERC20Token _convertibleToken, IConverterAnchor _anchor) external;
    function removeConvertibleToken(IERC20Token _convertibleToken, IConverterAnchor _anchor) external;

    function getSmartTokenCount() external view returns (uint256);
    function getSmartTokens() external view returns (address[] memory);
    function getSmartToken(uint256 _index) external view returns (IConverterAnchor);
    function isSmartToken(address _value) external view returns (bool);

    function getLiquidityPoolCount() external view returns (uint256);
    function getLiquidityPools() external view returns (address[] memory);
    function getLiquidityPool(uint256 _index) external view returns (IConverterAnchor);
    function isLiquidityPool(address _value) external view returns (bool);

    function getConvertibleTokenCount() external view returns (uint256);
    function getConvertibleTokens() external view returns (address[] memory);
    function getConvertibleToken(uint256 _index) external view returns (IERC20Token);
    function isConvertibleToken(address _value) external view returns (bool);

    function getConvertibleTokenSmartTokenCount(IERC20Token _convertibleToken) external view returns (uint256);
    function getConvertibleTokenSmartTokens(IERC20Token _convertibleToken) external view returns (address[] memory);
    function getConvertibleTokenSmartToken(IERC20Token _convertibleToken, uint256 _index) external view returns (IConverterAnchor);
    function isConvertibleTokenSmartToken(IERC20Token _convertibleToken, address _value) external view returns (bool);
}
