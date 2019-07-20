pragma solidity ^0.4.24;
import './Owned.sol';
import './interfaces/IAddressList.sol';

/*
    Non standard token registry

    manages tokens who don't return true/false on transfer/transferFrom/approve but revert on failure instead 
*/
contract NonStandardTokenRegistry is IAddressList, Owned {

    mapping (address => bool) public listedAddresses;

    /**
        @dev initializes a new NonStandardTokenRegistry instance
    */
    constructor() public {

    }

    function setAddress(address token, bool register) public ownerOnly {
        listedAddresses[token] = register;
    }
}