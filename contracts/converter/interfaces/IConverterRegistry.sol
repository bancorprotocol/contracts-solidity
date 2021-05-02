// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../token/interfaces/IReserveToken.sol";

import "./IConverterAnchor.sol";

interface IConverterRegistry {
    function getAnchorCount() external view returns (uint256);

    function getAnchors() external view returns (address[] memory);

    function getAnchor(uint256 _index) external view returns (IConverterAnchor);

    function isAnchor(address _value) external view returns (bool);

    function getLiquidityPoolCount() external view returns (uint256);

    function getLiquidityPools() external view returns (address[] memory);

    function getLiquidityPool(uint256 _index) external view returns (IConverterAnchor);

    function isLiquidityPool(address _value) external view returns (bool);

    function getConvertibleTokenCount() external view returns (uint256);

    function getConvertibleTokens() external view returns (address[] memory);

    function getConvertibleToken(uint256 _index) external view returns (IReserveToken);

    function isConvertibleToken(address _value) external view returns (bool);

    function getConvertibleTokenAnchorCount(IReserveToken _convertibleToken) external view returns (uint256);

    function getConvertibleTokenAnchors(IReserveToken _convertibleToken) external view returns (address[] memory);

    function getConvertibleTokenAnchor(IReserveToken _convertibleToken, uint256 _index)
        external
        view
        returns (IConverterAnchor);

    function isConvertibleTokenAnchor(IReserveToken _convertibleToken, address _value) external view returns (bool);

    function getLiquidityPoolByConfig(
        uint16 _type,
        IReserveToken[] memory _reserveTokens,
        uint32[] memory _reserveWeights
    ) external view returns (IConverterAnchor);
}
