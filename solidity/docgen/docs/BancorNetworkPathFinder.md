The BancorNetworkPathFinder contract allows for retrieving the conversion path between any pair of tokens in the Bancor Network.

This conversion path can then be used in various functions on the BancorNetwork contract (see this contract for more details on conversion paths).

# Functions:

- [`constructor(contract IContractRegistry _contractRegistry)`](#BancorNetworkPathFinder-constructor-contract-IContractRegistry-)

- [`updateAnchorToken()`](#BancorNetworkPathFinder-updateAnchorToken--)

- [`get(address _sourceToken, address _targetToken, contract BancorConverterRegistry[] _converterRegistries)`](#BancorNetworkPathFinder-get-address-address-contract-BancorConverterRegistry---)

# Function `constructor(contract IContractRegistry _contractRegistry)` {#BancorNetworkPathFinder-constructor-contract-IContractRegistry-}

initializes a new BancorNetworkPathFinder instance

## Parameters:

- `_contractRegistry`:    address of a contract registry contract

# Function `updateAnchorToken()` {#BancorNetworkPathFinder-updateAnchorToken--}

updates the anchor token to point to the most recent BNT token deployed

Note that this function needs to be called only when the BNT token has been redeployed

# Function `get(address _sourceToken, address _targetToken, contract BancorConverterRegistry[] _converterRegistries) → address[]` {#BancorNetworkPathFinder-get-address-address-contract-BancorConverterRegistry---}

retrieves the conversion path between a given pair of tokens in the Bancor Network

## Parameters:

- `_sourceToken`:         address of the source token

- `_targetToken`:         address of the target token

- `_converterRegistries`: array of converter registries depicting some part of the network

## Return Values:

- path from the source token to the target token
