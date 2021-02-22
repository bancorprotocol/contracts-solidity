// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./Utils.sol";
import "./OwnedUpgradeable.sol";
import "./interfaces/ITokenHolder.sol";

/**
 * @dev This contract provides a safety mechanism for allowing the owner to
 * send tokens that were sent to the contract by mistake back to the sender.
 *
 * We consider every contract to be a 'token holder' since it's currently not possible
 * for a contract to deny receiving tokens.
 *
 * Note that we use the non standard ERC-20 interface which has no return value for transfer
 * in order to support both non standard as well as standard token contracts.
 * see https://github.com/ethereum/solidity/issues/4116
 */
contract TokenHolderUpgradeable is Initializable, ITokenHolder, OwnedUpgradeable, Utils {
    using SafeERC20 for IERC20;

    /**
     * @dev initializes a new TokenHolderUpgradeable instance
     */
    function __TokenHolderUpgradeable_init() internal initializer {
        __OwnedUpgradeable_init();
        __TokenHolderUpgradeable_init_unchained();
    }

    function __TokenHolderUpgradeable_init_unchained() internal initializer {}

    /**
     * @dev withdraws tokens held by the contract and sends them to an account
     * can only be called by the owner
     *
     * @param _token   ERC20 token contract address
     * @param _to      account to receive the new amount
     * @param _amount  amount to withdraw
     */
    function withdrawTokens(
        IERC20 _token,
        address _to,
        uint256 _amount
    ) public virtual override ownerOnly validAddress(address(_token)) validAddress(_to) notThis(_to) {
        _token.safeTransfer(_to, _amount);
    }

    // https://docs.openzeppelin.com/contracts/3.x/upgradeable#storage_gaps
    uint256[49] private __gap;
}
