// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./token/interfaces/IERC20Token.sol";

/*
    Conversion Path Finder interface
*/
interface IConversionPathFinder {
    function findPath(IERC20Token _sourceToken, IERC20Token _targetToken) external view returns (address[] memory);
}
