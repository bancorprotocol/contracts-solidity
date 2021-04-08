// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../token/SafeERC20Token.sol";

/**
 * @dev Extends the SafeERC20 library with additional operations
 */
contract TestSafeERC20Token {
    using SafeERC20Token for IERC20;

    function safeTransfer(
        IERC20 token,
        address to,
        uint256 amount
    ) external {
        token.safeTransfer(to, amount);
    }

    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) external {
        token.safeTransferFrom(from, to, amount);
    }

    function safeApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) external {
        token.safeApprove(spender, amount);
    }

    function ensureAllowance(
        IERC20 token,
        address spender,
        uint256 amount
    ) external {
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
