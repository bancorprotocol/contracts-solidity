pragma solidity ^0.4.18;
import '../converter/BancorConverter.sol';

/**
* Financie Bancor Converter interface
*/
contract IFinancieBancorConverter {

    function sellCards(uint256 _amount, uint256 _minReturn) public returns (uint256, uint256, uint256);
    function buyCards(uint256 _amount, uint256 _minReturn) public returns (uint256, uint256, uint256);
    function getReturn(IERC20Token _fromToken, IERC20Token _toToken, uint256 _amount) public view returns (uint256, uint256);

}
