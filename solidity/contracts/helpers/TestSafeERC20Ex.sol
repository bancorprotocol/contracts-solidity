// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../token/SafeERC20Ex.sol";

contract TestSafeERC20Ex {
    using SafeERC20Ex for IERC20;

    function ensureApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) external {
        token.ensureApprove(spender, amount);
    }
}
