// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
    Conversion Path Finder interface
*/
interface IConversionPathFinder {
    function findPath(IERC20 _sourceToken, IERC20 _targetToken) external view returns (address[] memory);
}
