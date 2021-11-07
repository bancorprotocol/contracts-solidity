// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../token/interfaces/IReserveToken.sol";

import "./IConverterAnchor.sol";

/**
 * @dev Converter Registry Data interface
 */
interface IConverterRegistryData {
    function addSmartToken(IConverterAnchor anchor) external;

    function removeSmartToken(IConverterAnchor anchor) external;

    function addLiquidityPool(IConverterAnchor liquidityPoolAnchor) external;

    function removeLiquidityPool(IConverterAnchor liquidityPoolAnchor) external;

    function addConvertibleToken(IReserveToken convertibleToken, IConverterAnchor anchor) external;

    function removeConvertibleToken(IReserveToken convertibleToken, IConverterAnchor anchor) external;

    function getSmartTokenCount() external view returns (uint256);

    function getSmartTokens() external view returns (address[] memory);

    function getSmartToken(uint256 index) external view returns (IConverterAnchor);

    function isSmartToken(address value) external view returns (bool);

    function getLiquidityPoolCount() external view returns (uint256);

    function getLiquidityPools() external view returns (address[] memory);

    function getLiquidityPool(uint256 index) external view returns (IConverterAnchor);

    function isLiquidityPool(address value) external view returns (bool);

    function getConvertibleTokenCount() external view returns (uint256);

    function getConvertibleTokens() external view returns (address[] memory);

    function getConvertibleToken(uint256 index) external view returns (IReserveToken);

    function isConvertibleToken(address value) external view returns (bool);

    function getConvertibleTokenSmartTokenCount(IReserveToken convertibleToken) external view returns (uint256);

    function getConvertibleTokenSmartTokens(IReserveToken convertibleToken) external view returns (address[] memory);

    function getConvertibleTokenSmartToken(IReserveToken convertibleToken, uint256 index)
        external
        view
        returns (IConverterAnchor);

    function isConvertibleTokenSmartToken(IReserveToken convertibleToken, address value) external view returns (bool);
}
