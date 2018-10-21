pragma solidity ^0.4.24;
import './Owned.sol';
import './Utils.sol';
import './interfaces/IWhitelist.sol';

/**
    Whitelist

    The contract manages a list of whitelisted addresses
*/
contract Whitelist is IWhitelist, Owned, Utils {
    mapping (address => bool) private whitelist;

    event AddressAddition(address _address);
    event AddressRemoval(address _address);

    /**
        @dev constructor
    */
    constructor() public {
    }

    // allows execution by a whitelisted address only
    modifier whitelistedOnly() {
        require(whitelist[msg.sender]);
        _;
    }

    /**
        @dev returns true if a given address is whitelisted, false if not

        @param _address address to check

        @return true if the address is whitelisted, false if not
    */
    function isWhitelisted(address _address) public view returns (bool) {
        return whitelist[_address];
    }

    /**
        @dev adds a given address to the whitelist

        @param _address address to add
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
        @dev adds a list of addresses to the whitelist

        @param _addresses addresses to add
    */
    function addAddresses(address[] _addresses) public {
        for (uint256 i = 0; i < _addresses.length; i++) {
            addAddress(_addresses[i]);
        }
    }

    /**
        @dev removes a given address from the whitelist

        @param _address address to remove
    */
    function removeAddress(address _address) ownerOnly public {
        if (!whitelist[_address]) // checks if the address is actually whitelisted
            return;

        whitelist[_address] = false;
        emit AddressRemoval(_address);
    }

    /**
        @dev removes a list of addresses from the whitelist

        @param _addresses addresses to remove
    */
    function removeAddresses(address[] _addresses) public {
        for (uint256 i = 0; i < _addresses.length; i++) {
            removeAddress(_addresses[i]);
        }
    }
}
