pragma solidity ^0.4.11;
import './IERC20Token.sol';

/*
    Bancor Quick Converter interface
*/
contract IBancorQuickConverter {
    function quickConvert(IERC20Token[] _path, uint256 _amount, uint256 _minReturn) public returns (uint256);
}
