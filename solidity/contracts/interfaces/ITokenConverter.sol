pragma solidity ^0.4.11;
import './IERC20Token.sol';

/*
    EIP228 Token Converter interface
*/
contract ITokenConverter {
    function convertibleTokenCount() public constant returns (uint16);
    function convertibleToken(uint16 _tokenIndex) public constant returns (address);
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public constant returns (uint256);
    function convert(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256);
    // deprecated, backward compatibility
    function change(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256);
}
