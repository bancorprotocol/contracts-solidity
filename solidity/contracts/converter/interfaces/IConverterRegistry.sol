// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    function getConvertibleToken(uint256 _index) external view returns (IERC20);

    function isConvertibleToken(address _value) external view returns (bool);

    function getConvertibleTokenAnchorCount(IERC20 _convertibleToken) external view returns (uint256);

    function getConvertibleTokenAnchors(IERC20 _convertibleToken) external view returns (address[] memory);

    function getConvertibleTokenAnchor(IERC20 _convertibleToken, uint256 _index)
        external
        view
        returns (IConverterAnchor);

    function isConvertibleTokenAnchor(IERC20 _convertibleToken, address _value) external view returns (bool);
}
