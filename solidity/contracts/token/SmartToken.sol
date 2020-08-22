// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "./ERC20Token.sol";
import "./interfaces/ISmartToken.sol";
import "../utility/Owned.sol";
import "../utility/TokenHolder.sol";

/**
  * @dev Smart Token
  *
  * 'Owned' is specified here for readability reasons
*/
contract SmartToken is ISmartToken, Owned, ERC20Token, TokenHolder {
    using SafeMath for uint256;

    uint16 public constant version = 4;

    bool public transfersEnabled = true;    // true if transfer/transferFrom are enabled, false otherwise

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
      * @dev initializes a new SmartToken instance
      *
      * @param _name       token name
      * @param _symbol     token short symbol, minimum 1 character
      * @param _decimals   for display purposes only
    */
    constructor(string _name, string _symbol, uint8 _decimals)
        public
        ERC20Token(_name, _symbol, _decimals, 0)
    {
    }

    // allows execution only when transfers are enabled
    modifier transfersAllowed {
        _transfersAllowed();
        _;
    }

    // error message binary size optimization
    function _transfersAllowed() internal view {
        require(transfersEnabled, "ERR_TRANSFERS_DISABLED");
    }

    /**
      * @dev disables/enables transfers
      * can only be called by the contract owner
      *
      * @param _disable    true to disable transfers, false to enable them
    */
    function disableTransfers(bool _disable) public ownerOnly {
        transfersEnabled = !_disable;
    }

    /**
      * @dev increases the token supply and sends the new tokens to the given account
      * can only be called by the contract owner
      *
      * @param _to      account to receive the new amount
      * @param _amount  amount to increase the supply by
    */
    function issue(address _to, uint256 _amount)
        public
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
    function destroy(address _from, uint256 _amount) public ownerOnly {
        balanceOf[_from] = balanceOf[_from].sub(_amount);
        totalSupply = totalSupply.sub(_amount);

        emit Transfer(_from, address(0), _amount);
        emit Destruction(_amount);
    }

    // ERC20 standard method overrides with some extra functionality

    /**
      * @dev send coins
      * throws on any error rather then return a false flag to minimize user errors
      * in addition to the standard checks, the function throws if transfers are disabled
      *
      * @param _to      target address
      * @param _value   transfer amount
      *
      * @return true if the transfer was successful, false if it wasn't
    */
    function transfer(address _to, uint256 _value) public transfersAllowed returns (bool) {
        assert(super.transfer(_to, _value));
        return true;
    }

    /**
      * @dev an account/contract attempts to get the coins
      * throws on any error rather then return a false flag to minimize user errors
      * in addition to the standard checks, the function throws if transfers are disabled
      *
      * @param _from    source address
      * @param _to      target address
      * @param _value   transfer amount
      *
      * @return true if the transfer was successful, false if it wasn't
    */
    function transferFrom(address _from, address _to, uint256 _value) public transfersAllowed returns (bool) {
        assert(super.transferFrom(_from, _to, _value));
        return true;
    }
}
