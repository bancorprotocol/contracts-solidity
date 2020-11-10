// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./ERC20Token.sol";
import "./interfaces/IDSToken.sol";
import "../utility/Owned.sol";

/**
 * @dev This contract represents a token with dynamic supply.
 *
 * The owner of the token can mint/burn tokens to/from any account.
 */
contract DSToken is IDSToken, ERC20Token, Owned {
    using SafeMath for uint256;

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
    ) public ERC20Token(_name, _symbol, _decimals, 0) {}

    /**
     * @dev increases the token supply and sends the new tokens to the given account
     * can only be called by the contract owner
     *
     * @param _to      account to receive the new amount
     * @param _amount  amount to increase the supply by
     */
    function issue(address _to, uint256 _amount)
        public
        override
        ownerOnly
        validAddress(_to)
        notThis(_to)
    {
        totalSupply = totalSupply.add(_amount);
        balanceOf[_to] = balanceOf[_to].add(_amount);

        emit Issuance(_amount);
        emit Transfer(address(0), _to, _amount);
    }

    /**
     * @dev removes tokens from the given account and decreases the token supply
     * can only be called by the contract owner
     *
     * @param _from    account to remove the amount from
     * @param _amount  amount to decrease the supply by
     */
    function destroy(address _from, uint256 _amount) public override ownerOnly {
        balanceOf[_from] = balanceOf[_from].sub(_amount);
        totalSupply = totalSupply.sub(_amount);

        emit Transfer(_from, address(0), _amount);
        emit Destruction(_amount);
    }
}
