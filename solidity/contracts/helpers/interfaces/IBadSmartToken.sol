pragma solidity ^0.4.24;
import './IBadERC20Token.sol';

/*
    Bad Smart Token interface
*/
contract IBadSmartToken is IBadERC20Token {
    function disableTransfers(bool _disable) public;
    function issue(address _to, uint256 _amount) public;
    function destroy(address _from, uint256 _amount) public;
}
