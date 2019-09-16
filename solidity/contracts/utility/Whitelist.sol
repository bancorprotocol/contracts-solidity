pragma solidity 0.4.26;
import './Owned.sol';
import './Utils.sol';
import './interfaces/IWhitelist.sol';

/**
  * @dev The contract manages a list of whitelisted addresses
*/
contract Whitelist is IWhitelist, Owned, Utils {
    mapping (address => bool) private whitelist;

    /**
      * @dev triggered when an address is added to the whitelist
      * 
      * @param _address address that's added from the whitelist
    */
    event AddressAddition(address _address);

    /**
      * @dev triggered when an address is removed from the whitelist
      * 
      * @param _address address that's removed from the whitelist
    */
    event AddressRemoval(address _address);

    /**
      * @dev initializes a new Whitelist instance
    */
    constructor() public {
    }

    /**
      * @dev returns true if a given address is whitelisted, false if not
      * 
      * @param _address address to check
      * 
      * @return true if the address is whitelisted, false if not
    */
    function isWhitelisted(address _address) public view returns (bool) {
        return whitelist[_address];
    }

    /**
      * @dev adds a given address to the whitelist
      * 
      * @param _address address to add
    */
    function addAddress(address _address)
        ownerOnly
        validAddress(_address)
        public 
    {
        if (whitelist[_address]) // checks if the address is already whitelisted
            return;

        whitelist[_address] = true;
        emit AddressAddition(_address);
    }

    /**
      * @dev adds a list of addresses to the whitelist
      * 
      * @param _addresses addresses to add
    */
    function addAddresses(address[] _addresses) public {
        for (uint256 i = 0; i < _addresses.length; i++) {
            addAddress(_addresses[i]);
        }
    }

    /**
      * @dev removes a given address from the whitelist
      * 
      * @param _address address to remove
    */
    function removeAddress(address _address) ownerOnly public {
        if (!whitelist[_address]) // checks if the address is actually whitelisted
            return;

        whitelist[_address] = false;
        emit AddressRemoval(_address);
    }

    /**
      * @dev removes a list of addresses from the whitelist
      * 
      * @param _addresses addresses to remove
    */
    function removeAddresses(address[] _addresses) public {
        for (uint256 i = 0; i < _addresses.length; i++) {
            removeAddress(_addresses[i]);
        }
    }
}
