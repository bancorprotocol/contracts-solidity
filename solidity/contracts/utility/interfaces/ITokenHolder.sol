// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./IOwned.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Token Holder interface
*/
abstract contract ITokenHolder is IOwned {
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) public virtual;
}
