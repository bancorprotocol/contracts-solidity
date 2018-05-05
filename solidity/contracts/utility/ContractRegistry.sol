pragma solidity ^0.4.21;
import './Owned.sol';
import './interfaces/IContractRegistry.sol';

/**
    Contract Registry

    The contract registry keeps contract addresses by name.
    The owner can update contract addresses so that a contract name always points to the latest version
    of the given contract.
    Other contracts can query the registry to get updated addresses instead of depending on specific
    addresses.

    Note that contract names are limited to 32 bytes, UTF8 strings to optimize gas costs
*/
contract ContractRegistry is IContractRegistry, Owned {
    mapping (bytes32 => address) addresses;

    event AddressUpdate(bytes32 _contractName, address _contractAddress);

    /**
        @dev constructor
    */
    function ContractRegistry() public {
    }

    /**
        @dev returns the address associated with the given contract name

        @param _contractName    contract name

        @return contract address
    */
    function getAddress(bytes32 _contractName) public view returns (address) {
        return addresses[_contractName];
    }

    /**
        @dev registers a new address for the contract name

       @param _contractName     contract name
       @param _contractAddress  contract address
    */
    function registerAddress(bytes32 _contractName, address _contractAddress) public ownerOnly {
        require(_contractName.length > 0); // validating input

        addresses[_contractName] = _contractAddress;
        emit AddressUpdate(_contractName, _contractAddress);
    }
}
