// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

library SafeERC20Token {
    using SafeERC20 for IERC20;

    function safeTransfer(
        IERC20 token,
        address to,
        uint256 value
    ) internal {
        token.safeTransfer(to, value);
    }

    function safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) internal {
        token.safeTransferFrom(from, to, value);
    }

    function safeApprove(
        IERC20 token,
        address spender,
        uint256 value
    ) internal {
        token.safeApprove(spender, value);
    }

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
