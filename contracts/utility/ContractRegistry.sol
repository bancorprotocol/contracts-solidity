// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./Owned.sol";
import "./Utils.sol";
import "./interfaces/IContractRegistry.sol";

/**
 * @dev This contract maintains contract addresses by name.
 *
 * The owner can update contract addresses so that a contract name always points to the latest version
 * of the given contract.
 *
 * Other contracts can query the registry to get updated addresses instead of depending on specific
 * addresses.
 *
 * Note that contract names are limited to 32 bytes UTF8 encoded ASCII strings to optimize gas costs
 */
contract ContractRegistry is IContractRegistry, Owned, Utils {
    struct RegistryItem {
        address contractAddress;
        uint256 nameIndex; // index of the item in the list of contract names
    }

    // the mapping between contract names and RegistryItem items
    mapping(bytes32 => RegistryItem) private _items;

    // the list of all registered contract names
    string[] private _contractNames;

    /**
     * @dev triggered when an address pointed to by a contract name is modified
     */
    event AddressUpdate(bytes32 indexed contractName, address contractAddress);

    /**
     * @dev returns the number of items in the registry
     */
    function itemCount() external view returns (uint256) {
        return _contractNames.length;
    }

    /**
     * @dev returns a registered contract name
     */
    function contractNames(uint256 index) external view returns (string memory) {
        return _contractNames[index];
    }

    /**
     * @dev returns the address associated with the given contract name
     */
    function addressOf(bytes32 contractName) public view override returns (address) {
        return _items[contractName].contractAddress;
    }

    /**
     * @dev registers a new address for the contract name in the registry
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function registerAddress(bytes32 contractName, address contractAddress)
        external
        ownerOnly
        validAddress(contractAddress)
    {
        require(contractName.length > 0, "ERR_INVALID_NAME");

        // check if any change is needed
        address currentAddress = _items[contractName].contractAddress;
        if (contractAddress == currentAddress) {
            return;
        }

        if (currentAddress == address(0)) {
            // update the item's index in the list
            _items[contractName].nameIndex = _contractNames.length;

            // add the contract name to the name list
            _contractNames.push(_bytes32ToString(contractName));
        }

        // update the address in the registry
        _items[contractName].contractAddress = contractAddress;

        // dispatch the address update event
        emit AddressUpdate(contractName, contractAddress);
    }

    /**
     * @dev removes an existing contract address from the registry
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     */
    function unregisterAddress(bytes32 contractName) public ownerOnly {
        require(contractName.length > 0, "ERR_INVALID_NAME");
        require(_items[contractName].contractAddress != address(0), "ERR_INVALID_NAME");

        // remove the address from the registry
        _items[contractName].contractAddress = address(0);

        // if there are multiple items in the registry, move the last element to the deleted element's position
        // and modify last element's registryItem.nameIndex in the items collection to point to the right position in contractNames
        if (_contractNames.length > 1) {
            string memory lastContractNameString = _contractNames[_contractNames.length - 1];
            uint256 unregisterIndex = _items[contractName].nameIndex;

            _contractNames[unregisterIndex] = lastContractNameString;
            bytes32 lastContractName = _stringToBytes32(lastContractNameString);
            RegistryItem storage registryItem = _items[lastContractName];
            registryItem.nameIndex = unregisterIndex;
        }

        // remove the last element from the name list
        _contractNames.pop();

        // zero the deleted element's index
        _items[contractName].nameIndex = 0;

        // dispatch the address update event
        emit AddressUpdate(contractName, address(0));
    }

    /**
     * @dev utility, converts bytes32 to a string
     *
     * note that the bytes32 argument is assumed to be UTF8 encoded ASCII string
     */
    function _bytes32ToString(bytes32 data) private pure returns (string memory) {
        bytes memory byteArray = new bytes(32);
        for (uint256 i = 0; i < 32; i++) {
            byteArray[i] = data[i];
        }

        return string(byteArray);
    }

    /**
     * @dev utility, converts string to bytes32
     *
     * note that the bytes32 argument is assumed to be UTF8 encoded ASCII string
     */
    function _stringToBytes32(string memory str) private pure returns (bytes32) {
        bytes32 result;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            result := mload(add(str, 32))
        }

        return result;
    }

    /**
     * @dev deprecated, backward compatibility
     */
    function getAddress(bytes32 contractName) public view returns (address) {
        return addressOf(contractName);
    }
}
