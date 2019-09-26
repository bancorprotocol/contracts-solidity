The contract manages a list of whitelisted addresses

# Functions:

- [`constructor()`](#Whitelist-constructor--)

- [`isWhitelisted(address _address)`](#Whitelist-isWhitelisted-address-)

- [`addAddress(address _address)`](#Whitelist-addAddress-address-)

- [`addAddresses(address[] _addresses)`](#Whitelist-addAddresses-address---)

- [`removeAddress(address _address)`](#Whitelist-removeAddress-address-)

- [`removeAddresses(address[] _addresses)`](#Whitelist-removeAddresses-address---)

# Events:

- [`AddressAddition(address _address)`](#Whitelist-AddressAddition-address-)

- [`AddressRemoval(address _address)`](#Whitelist-AddressRemoval-address-)

# Function `constructor()` {#Whitelist-constructor--}

initializes a new Whitelist instance

# Function `isWhitelisted(address _address) → bool` {#Whitelist-isWhitelisted-address-}

returns true if a given address is whitelisted, false if not

## Parameters:

- `_address`: address to check

# Function `addAddress(address _address)` {#Whitelist-addAddress-address-}

adds a given address to the whitelist

## Parameters:

- `_address`: address to add

# Function `addAddresses(address[] _addresses)` {#Whitelist-addAddresses-address---}

adds a list of addresses to the whitelist

## Parameters:

- `_addresses`: addresses to add

# Function `removeAddress(address _address)` {#Whitelist-removeAddress-address-}

removes a given address from the whitelist

## Parameters:

- `_address`: address to remove

# Function `removeAddresses(address[] _addresses)` {#Whitelist-removeAddresses-address---}

removes a list of addresses from the whitelist

## Parameters:

- `_addresses`: addresses to remove

# Event `AddressAddition(address _address)` {#Whitelist-AddressAddition-address-}

triggered when an address is added to the whitelist

## Parameters:

- `_address`: address that's added from the whitelist

# Event `AddressRemoval(address _address)` {#Whitelist-AddressRemoval-address-}

triggered when an address is removed from the whitelist

## Parameters:

- `_address`: address that's removed from the whitelist
