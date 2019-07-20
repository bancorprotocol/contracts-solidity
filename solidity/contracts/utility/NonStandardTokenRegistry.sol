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

    /**
        @dev registers/unregisters a new non standard ERC20 token in the registry

        @param token    token address
        @param register true to register the token, false to remove it
    */
    function setAddress(address token, bool register) public ownerOnly {
        listedAddresses[token] = register;
    }
}