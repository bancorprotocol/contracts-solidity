// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @dev Extends the SafeERC20 library with additional operations
 */
library SafeERC20Token {
    using SafeERC20 for IERC20;

    /**
     * @dev transfers ERC20 token using the SafeERC20 library
     *
     * @param token the address of the token to transfer
     * @param to the destination address to transfer the amount to
     * @param amount the amount to transfer
     */
    function safeTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        token.safeTransfer(to, amount);
    }

    /**
     * @dev transfers ERC20 token using the SafeERC20 library
     *
     * @param token the address of the token to transfer
     * @param from the source address to transfer the amount from
     * @param to the destination address to transfer the amount to
     * @param amount the amount to transfer
     */
    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) internal {
        token.safeTransferFrom(from, to, amount);
    }

    /**
     * @dev approves ERC20 token transfer using the SafeERC20 library
     *
     * @param token the address of the token to approve
     * @param spender the address allowed to spend
     * @param amount the allowed amount to spend
     */
    function safeApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        token.safeApprove(spender, amount);
    }

    /**
     * @dev ensures that the spender has sufficient allowance
     *
     * @param token the address of the token to ensure
     * @param spender the address allowed to spend
     * @param amount the allowed amount to spend
     */
    function ensureAllowance(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        if (amount == 0) {
            return;
        }

        uint256 allowance = token.allowance(address(this), spender);
        if (allowance >= amount) {
            return;
        }

        if (allowance > 0) {
            token.safeApprove(spender, 0);
        }
        token.safeApprove(spender, amount);
    }
}
