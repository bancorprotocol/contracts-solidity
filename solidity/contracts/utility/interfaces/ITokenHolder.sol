// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./IOwned.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Token Holder interface
*/
interface ITokenHolder is IOwned {
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) external;
}
