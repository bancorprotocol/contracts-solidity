Contract Registry

The contract registry keeps contract addresses by name.

The owner can update contract addresses so that a contract name always points to the latest version

of the given contract.

Other contracts can query the registry to get updated addresses instead of depending on specific

addresses.

Note that contract names are limited to 32 bytes UTF8 encoded ASCII strings to optimize gas costs

# Functions:

- [`constructor()`](#ContractRegistry-constructor--)

- [`itemCount()`](#ContractRegistry-itemCount--)

- [`addressOf(bytes32 _contractName)`](#ContractRegistry-addressOf-bytes32-)

- [`registerAddress(bytes32 _contractName, address _contractAddress)`](#ContractRegistry-registerAddress-bytes32-address-)

- [`unregisterAddress(bytes32 _contractName)`](#ContractRegistry-unregisterAddress-bytes32-)

- [`getAddress(bytes32 _contractName)`](#ContractRegistry-getAddress-bytes32-)

# Events:

- [`AddressUpdate(bytes32 _contractName, address _contractAddress)`](#ContractRegistry-AddressUpdate-bytes32-address-)

# Function `constructor()` {#ContractRegistry-constructor--}

initializes a new ContractRegistry instance

# Function `itemCount() → uint256` {#ContractRegistry-itemCount--}

returns the number of items in the registry

# Function `addressOf(bytes32 _contractName) → address` {#ContractRegistry-addressOf-bytes32-}

returns the address associated with the given contract name

## Parameters:

- `_contractName`:    contract name

# Function `registerAddress(bytes32 _contractName, address _contractAddress)` {#ContractRegistry-registerAddress-bytes32-address-}

registers a new address for the contract name in the registry

## Parameters:

- `_contractName`:     contract name

- `_contractAddress`:  contract address

# Function `unregisterAddress(bytes32 _contractName)` {#ContractRegistry-unregisterAddress-bytes32-}

removes an existing contract address from the registry

## Parameters:

- `_contractName`: contract name

# Function `getAddress(bytes32 _contractName) → address` {#ContractRegistry-getAddress-bytes32-}

deprecated, backward compatibility

# Event `AddressUpdate(bytes32 _contractName, address _contractAddress)` {#ContractRegistry-AddressUpdate-bytes32-address-}

triggered when an address pointed to by a contract name is modified

## Parameters:

- `_contractName`:    contract name

- `_contractAddress`: new contract address
