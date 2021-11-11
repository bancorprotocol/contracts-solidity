// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../token/interfaces/IReserveToken.sol";

import "./IConverterAnchor.sol";

/**
 * @dev Converter Registry interface
 */
interface IConverterRegistry {
    function getAnchorCount() external view returns (uint256);

    function getAnchors() external view returns (address[] memory);

    function getAnchor(uint256 index) external view returns (IConverterAnchor);

    function isAnchor(address value) external view returns (bool);

    function getLiquidityPoolCount() external view returns (uint256);

    function getLiquidityPools() external view returns (address[] memory);

    function getLiquidityPool(uint256 index) external view returns (IConverterAnchor);

    function isLiquidityPool(address value) external view returns (bool);

    function getConvertibleTokenCount() external view returns (uint256);

    function getConvertibleTokens() external view returns (address[] memory);

    function getConvertibleToken(uint256 index) external view returns (IReserveToken);

    function isConvertibleToken(address value) external view returns (bool);

    function getConvertibleTokenAnchorCount(IReserveToken convertibleToken) external view returns (uint256);

    function getConvertibleTokenAnchors(IReserveToken convertibleToken) external view returns (address[] memory);

    function getConvertibleTokenAnchor(IReserveToken convertibleToken, uint256 index)
        external
        view
        returns (IConverterAnchor);

    function isConvertibleTokenAnchor(IReserveToken convertibleToken, address value) external view returns (bool);

    function getLiquidityPoolByConfig(
        uint16 converterType,
        IReserveToken[] memory reserveTokens,
        uint32[] memory reserveWeights
    ) external view returns (IConverterAnchor);
}
