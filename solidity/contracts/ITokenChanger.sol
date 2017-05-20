pragma solidity ^0.4.10;

/*
    EIP228 Token Changer interface
*/
contract ITokenChanger {
    function changeableTokenCount() public constant returns (uint16 count);
    function changeableToken(uint16 _tokenIndex) public constant returns (address tokenAddress);
    function getReturn(address _fromToken, address _toToken, uint256 _amount) public constant returns (uint256 amount);
    function change(address _fromToken, address _toToken, uint256 _amount, uint256 _minReturn) public returns (uint256 amount);
}
