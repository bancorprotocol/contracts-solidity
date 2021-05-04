// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./interfaces/ITokenHolder.sol";

import "./Owned.sol";
import "./Utils.sol";

import "../token/ReserveToken.sol";

/**
 * @dev This contract provides a safety mechanism for allowing the owner to
 * send tokens that were sent to the contract by mistake back to the sender.
 *
 * We consider every contract to be a 'token holder' since it's currently not possible
 * for a contract to deny receiving tokens.
 */
contract TokenHolder is ITokenHolder, Owned, Utils {
    using ReserveToken for IReserveToken;

    // prettier-ignore
    receive() external payable override virtual {}

    /**
     * @dev withdraws funds held by the contract and sends them to an account
     * can only be called by the owner
     *
     * @param reserveToken reserve token contract address
     * @param to account to receive the new amount
     * @param amount amount to withdraw
     */
    function withdrawTokens(
        IReserveToken reserveToken,
        address payable to,
        uint256 amount
    ) public virtual override ownerOnly validAddress(to) {
        reserveToken.safeTransfer(to, amount);
    }

    /**
     * @dev withdraws multiple funds held by the contract and sends them to an account
     * can only be called by the owner
     *
     * @param reserveTokens reserve tokens contract addresses
     * @param to account to receive the new amount
     * @param amounts amounts to withdraw
     */
    function withdrawTokensMultiple(
        IReserveToken[] calldata reserveTokens,
        address payable to,
        uint256[] calldata amounts
    ) public virtual override ownerOnly validAddress(to) {
        uint256 length = reserveTokens.length;
        require(length == amounts.length, "ERR_INVALID_LENGTH");

        for (uint256 i = 0; i < length; ++i) {
            reserveTokens[i].safeTransfer(to, amounts[i]);
        }
    }
}
