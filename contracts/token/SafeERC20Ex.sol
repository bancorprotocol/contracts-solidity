// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

/**
 * @dev Extends the SafeERC20 library with additional operations
 */
library SafeERC20Ex {
    using SafeERC20 for IERC20;

    /**
     * @dev ensures that the spender has sufficient allowance
     */
    function ensureApprove(
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
