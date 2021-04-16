// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../token/ReserveToken.sol";

contract TestReserveToken {
    using ReserveToken for IReserveToken;

    receive() external payable {}

    function isNativeToken(IReserveToken reserveToken) external pure returns (bool) {
        return reserveToken.isNativeToken();
    }

    function balanceOf(IReserveToken reserveToken, address account) external view returns (uint256) {
        return reserveToken.balanceOf(account);
    }

    function safeTransfer(
        IReserveToken reserveToken,
        address to,
        uint256 amount
    ) external {
        reserveToken.safeTransfer(to, amount);
    }

    function safeTransferFrom(
        IReserveToken reserveToken,
        address from,
        address to,
        uint256 amount
    ) external {
        reserveToken.safeTransferFrom(from, to, amount);
    }

    function ensureApprove(
        IReserveToken reserveToken,
        address spender,
        uint256 amount
    ) external {
        reserveToken.ensureApprove(spender, amount);
    }
}
