# Contract `Whitelist`



#### Functions:
- `constructor()`
- `isWhitelisted(address _address)`
- `addAddress(address _address)`
- `addAddresses(address[] _addresses)`
- `removeAddress(address _address)`
- `removeAddresses(address[] _addresses)`

#### Events:
- `AddressAddition(address _address)`
- `AddressRemoval(address _address)`

---

#### Function `constructor()`
constructor
#### Function `isWhitelisted(address _address) → bool`
returns true if a given address is whitelisted, false if not

###### Parameters:
- `_address`: address to check

#### Function `addAddress(address _address)`
adds a given address to the whitelist

###### Parameters:
- `_address`: address to add
#### Function `addAddresses(address[] _addresses)`
adds a list of addresses to the whitelist

###### Parameters:
- `_addresses`: addresses to add
#### Function `removeAddress(address _address)`
removes a given address from the whitelist

###### Parameters:
- `_address`: address to remove
#### Function `removeAddresses(address[] _addresses)`
removes a list of addresses from the whitelist

###### Parameters:
- `_addresses`: addresses to remove

#### Event `AddressAddition(address _address)`
No description
#### Event `AddressRemoval(address _address)`
No description


