// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IConverterAnchor.sol";

abstract contract IConverterRegistry {
    function getAnchorCount() public virtual view returns (uint256);
    function getAnchors() public virtual view returns (address[] memory);
    function getAnchor(uint256 _index) public virtual view returns (IConverterAnchor);
    function isAnchor(address _value) public virtual view returns (bool);

    function getLiquidityPoolCount() public virtual view returns (uint256);
    function getLiquidityPools() public virtual view returns (address[] memory);
    function getLiquidityPool(uint256 _index) public virtual view returns (IConverterAnchor);
    function isLiquidityPool(address _value) public virtual view returns (bool);

    function getConvertibleTokenCount() public virtual view returns (uint256);
    function getConvertibleTokens() public virtual view returns (address[] memory);
    function getConvertibleToken(uint256 _index) public virtual view returns (IERC20Token);
    function isConvertibleToken(address _value) public virtual view returns (bool);

    function getConvertibleTokenAnchorCount(IERC20Token _convertibleToken) public virtual view returns (uint256);
    function getConvertibleTokenAnchors(IERC20Token _convertibleToken) public virtual view returns (address[] memory);
    function getConvertibleTokenAnchor(IERC20Token _convertibleToken, uint256 _index) public virtual view returns (IConverterAnchor);
    function isConvertibleTokenAnchor(IERC20Token _convertibleToken, address _value) public virtual view returns (bool);
}
