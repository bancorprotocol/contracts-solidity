pragma solidity ^0.4.18;
import './IOwned.sol';
import './IERC20Token.sol';

/*
    Token Holder interface
*/
contract ITokenHolder is IOwned {
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public;
}
