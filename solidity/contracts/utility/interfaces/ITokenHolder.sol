// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IOwned.sol";

/*
    Token Holder interface
*/
interface ITokenHolder is IOwned {
    function withdrawTokens(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) external;
}
