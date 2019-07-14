

# Functions:
- [`constructor()`](#ContractRegistry-constructor)
- [`itemCount()`](#ContractRegistry-itemCount)
- [`addressOf(bytes32 _contractName)`](#ContractRegistry-addressOf-bytes32)
- [`registerAddress(bytes32 _contractName, address _contractAddress)`](#ContractRegistry-registerAddress-bytes32-address)
- [`unregisterAddress(bytes32 _contractName)`](#ContractRegistry-unregisterAddress-bytes32)
- [`getAddress(bytes32 _contractName)`](#ContractRegistry-getAddress-bytes32)

# Events:
- [`AddressUpdate(bytes32 _contractName, address _contractAddress)`](#ContractRegistry-AddressUpdate-bytes32-address)

## Function `constructor()` {#ContractRegistry-constructor}
constructor
## Function `itemCount() → uint256` {#ContractRegistry-itemCount}
returns the number of items in the registry

## Function `addressOf(bytes32 _contractName) → address` {#ContractRegistry-addressOf-bytes32}
returns the address associated with the given contract name

### Parameters:
- `_contractName`:    contract name

## Function `registerAddress(bytes32 _contractName, address _contractAddress)` {#ContractRegistry-registerAddress-bytes32-address}
registers a new address for the contract name in the registry

### Parameters:
- `_contractName`:     contract name

- `_contractAddress`:  contract address
## Function `unregisterAddress(bytes32 _contractName)` {#ContractRegistry-unregisterAddress-bytes32}
removes an existing contract address from the registry

### Parameters:
- `_contractName`: contract name
## Function `getAddress(bytes32 _contractName) → address` {#ContractRegistry-getAddress-bytes32}
No description

## Event `AddressUpdate(bytes32 _contractName, address _contractAddress)` {#ContractRegistry-AddressUpdate-bytes32-address}
No description
