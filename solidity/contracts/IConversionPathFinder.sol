// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./token/interfaces/IERC20Token.sol";

/*
    Conversion Path Finder interface
*/
abstract contract IConversionPathFinder {
    function findPath(IERC20Token _sourceToken, IERC20Token _targetToken) public virtual view returns (address[] memory);
}
