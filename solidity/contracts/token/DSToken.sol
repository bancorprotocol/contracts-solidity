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

    uint8 private immutable tokenDecimals;

    /**
     * @dev triggered when the total supply is increased
     *
     * @param _amount  amount that gets added to the supply
     */
    event Issuance(uint256 _amount);

    /**
     * @dev triggered when the total supply is decreased
     *
     * @param _amount  amount that gets removed from the supply
     */
    event Destruction(uint256 _amount);

    /**
     * @dev initializes a new DSToken instance
     *
     * @param _name       token name
     * @param _symbol     token short symbol, minimum 1 character
     * @param _decimals   for display purposes only
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public ERC20(_name, _symbol) {
        tokenDecimals = _decimals;
    }

    function decimals() public view override returns (uint8) {
        return tokenDecimals;
    }

    /**
     * @dev increases the token supply and sends the new tokens to the given account
     * can only be called by the contract owner
     *
     * @param _to      account to receive the new amount
     * @param _amount  amount to increase the supply by
     */
    function issue(address _to, uint256 _amount) public override ownerOnly validAddress(_to) notThis(_to) {
        _mint(_to, _amount);

        emit Issuance(_amount);
    }

    /**
     * @dev removes tokens from the given account and decreases the token supply
     * can only be called by the contract owner
     *
     * @param _from    account to remove the amount from
     * @param _amount  amount to decrease the supply by
     */
    function destroy(address _from, uint256 _amount) public override ownerOnly {
        _burn(_from, _amount);

        emit Destruction(_amount);
    }
}
