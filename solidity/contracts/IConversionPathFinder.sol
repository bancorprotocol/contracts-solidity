pragma solidity 0.4.26;
import "./token/interfaces/IERC20Token.sol";

/*
    Conversion Path Finder interface
*/
contract IConversionPathFinder {
    function findPath(address _sourceToken, address _targetToken) public view returns (address[] memory);
}
