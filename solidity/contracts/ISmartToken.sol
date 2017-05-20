pragma solidity ^0.4.10;
import './IERC20Token.sol';
import './ITokenChanger.sol';

/*
    Smart Token interface
*/
contract ISmartToken is IERC20Token {
    // this function isn't abstract since the compiler emits automatically generated getter functions as external
    function changer() public constant returns (ITokenChanger changer) {}

    function disableTransfers(bool _disable) public;
    function issue(address _to, uint256 _amount) public;
    function destroy(address _from, uint256 _amount) public;
    function setChanger(ITokenChanger _changer) public;
}
