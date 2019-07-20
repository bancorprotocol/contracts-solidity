# Contract `ContractRegistry`



#### Functions:
- `constructor()`
- `itemCount()`
- `addressOf(bytes32 _contractName)`
- `registerAddress(bytes32 _contractName, address _contractAddress)`
- `unregisterAddress(bytes32 _contractName)`
- `getAddress(bytes32 _contractName)`

#### Events:
- `AddressUpdate(bytes32 _contractName, address _contractAddress)`

---

#### Function `constructor()`
constructor
#### Function `itemCount() → uint256`
returns the number of items in the registry

#### Function `addressOf(bytes32 _contractName) → address`
returns the address associated with the given contract name

###### Parameters:
- `_contractName`:    contract name

#### Function `registerAddress(bytes32 _contractName, address _contractAddress)`
registers a new address for the contract name in the registry

###### Parameters:
- `_contractName`:     contract name

- `_contractAddress`:  contract address
#### Function `unregisterAddress(bytes32 _contractName)`
removes an existing contract address from the registry

###### Parameters:
- `_contractName`: contract name
#### Function `getAddress(bytes32 _contractName) → address`
No description

#### Event `AddressUpdate(bytes32 _contractName, address _contractAddress)`
No description


