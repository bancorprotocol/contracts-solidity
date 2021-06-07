// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./token/interfaces/IReserveToken.sol";

/**
 * @dev Conversion Path Finder interface
 */
interface IConversionPathFinder {
    function findPath(IReserveToken sourceToken, IReserveToken targetToken) external view returns (address[] memory);
}
