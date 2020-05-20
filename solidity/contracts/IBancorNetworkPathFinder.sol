pragma solidity 0.4.26;
import "./token/interfaces/IERC20Token.sol";

/*
    Bancor Network Path Finder interface
*/
contract IBancorNetworkPathFinder {
    function findPath(address _sourceToken, address _targetToken) public view returns (address[] memory);
}
