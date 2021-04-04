// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IOwned.sol";

/*
    Token Holder interface
*/
interface ITokenHolder is IOwned {
    receive() external payable;

    function withdrawTokens(
        IERC20 token,
        address payable to,
        uint256 amount
    ) external;

    function withdrawTokensMultiple(
        IERC20[] calldata tokens,
        address payable to,
        uint256[] calldata amounts
    ) external;
}
