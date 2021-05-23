// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IDSToken.sol";
import "../utility/Owned.sol";
import "../utility/Utils.sol";

/**
 * @dev This contract represents a token with dynamic supply.
 *
 * The owner of the token can mint/burn tokens to/from any account.
 */
contract DSToken is IDSToken, ERC20, Owned, Utils {
    using SafeMath for uint256;

    /**
     * @dev triggered when the total supply is increased
     *
     * @param amount amount that gets added to the supply
     */
    event Issuance(uint256 amount);

    /**
     * @dev triggered when the total supply is decreased
     *
     * @param amount amount that gets removed from the supply
     */
    event Destruction(uint256 amount);

    /**
     * @dev initializes a new DSToken instance
     *
     * @param name token name
     * @param symbol token symbol
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public ERC20(name, symbol) {
        _setupDecimals(decimals);
    }

    /**
     * @dev increases the token supply and sends the new tokens to the given account
     * can only be called by the contract owner
     *
     * @param recipient account to receive the new amount
     * @param amount amount to increase the supply by
     */
    function issue(address recipient, uint256 amount) external override ownerOnly validExternalAddress(recipient) {
        _mint(recipient, amount);

        emit Issuance(amount);
    }

    /**
     * @dev removes tokens from the given account and decreases the token supply
     * can only be called by the contract owner
     *
     * @param recipient account to remove the amount from
     * @param amount amount to decrease the supply by
     */
    function destroy(address recipient, uint256 amount) external override ownerOnly {
        _burn(recipient, amount);

        emit Destruction(amount);
    }
}
