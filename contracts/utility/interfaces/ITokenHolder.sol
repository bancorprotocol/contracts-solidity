// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../token/interfaces/IReserveToken.sol";

import "./IOwned.sol";

/**
 * @dev Token Holder interface
 */
interface ITokenHolder is IOwned {
    receive() external payable;

    function withdrawTokens(
        IReserveToken reserveToken,
        address payable to,
        uint256 amount
    ) external;

    function withdrawTokensMultiple(
        IReserveToken[] calldata reserveTokens,
        address payable to,
        uint256[] calldata amounts
    ) external;
}
