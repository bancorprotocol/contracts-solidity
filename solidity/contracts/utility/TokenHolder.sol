// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./Owned.sol";
import "./Utils.sol";
import "./interfaces/ITokenHolder.sol";

/**
 * @dev This contract provides a safety mechanism for allowing the owner to
 * send tokens that were sent to the contract by mistake back to the sender.
 *
 * We consider every contract to be a 'token holder' since it's currently not possible
 * for a contract to deny receiving tokens.
 */
contract TokenHolder is ITokenHolder, Owned, Utils {
    using SafeERC20 for IERC20;

    // prettier-ignore
    receive() external payable override virtual {}

    /**
     * @dev withdraws funds held by the contract and sends them to an account
     * can only be called by the owner
     *
     * @param token ERC20 token contract address (with a special handling of NATIVE_TOKEN_ADDRESS)
     * @param to account to receive the new amount
     * @param amount amount to withdraw
     */
    function withdrawTokens(
        IERC20 token,
        address to,
        uint256 amount
    ) public virtual override ownerOnly validAddress(to) {
        withdraw(token, to, amount);
    }

    /**
     * @dev withdraws multiple funds held by the contract and sends them to an account
     * can only be called by the owner
     *
     * @param tokens ERC20 token contract addresses (with a special handling of NATIVE_TOKEN_ADDRESS)
     * @param to account to receive the new amount
     * @param amounts amounts to withdraw
     */
    function withdrawMultipleTokens(
        IERC20[] calldata tokens,
        address to,
        uint256[] calldata amounts
    ) public virtual override ownerOnly validAddress(to) {
        uint256 length = tokens.length;
        require(length == amounts.length, "ERR_INVALID_LENGTH");

        for (uint256 i = 0; i < length; ++i) {
            withdraw(tokens[i], to, amounts[i]);
        }
    }

    /**
     * @dev withdraws funds held by the contract and sends them to an account
     *
     * @param token ERC20 token contract address
     * @param to account to receive the new amount
     * @param amount amount to withdraw
     */
    function withdraw(
        IERC20 token,
        address to,
        uint256 amount
    ) private {
        if (token == NATIVE_TOKEN_ADDRESS) {
            payable(to).transfer(amount);
        } else {
            token.safeTransfer(to, amount);
        }
    }
}
