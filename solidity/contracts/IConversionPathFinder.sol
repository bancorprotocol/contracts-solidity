// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./token/interfaces/IERC20Token.sol";

/*
    Conversion Path Finder interface
*/
contract IConversionPathFinder {
    function findPath(address _sourceToken, address _targetToken) public view returns (address[] memory);
}
