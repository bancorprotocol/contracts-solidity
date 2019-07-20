

# Functions:
- [`constructor()`](#Owned-constructor--)
- [`transferOwnership(address _newOwner)`](#Owned-transferOwnership-address-)
- [`acceptOwnership()`](#Owned-acceptOwnership--)

# Events:
- [`OwnerUpdate(address _prevOwner, address _newOwner)`](#Owned-OwnerUpdate-address-address-)

# Function `constructor()` {#Owned-constructor--}
constructor
# Function `transferOwnership(address _newOwner)` {#Owned-transferOwnership-address-}
allows transferring the contract ownership
the new owner still needs to accept the transfer
can only be called by the contract owner

## Parameters:
- `_newOwner`:    new contract owner
# Function `acceptOwnership()` {#Owned-acceptOwnership--}
used by a new owner to accept an ownership transfer

# Event `OwnerUpdate(address _prevOwner, address _newOwner)` {#Owned-OwnerUpdate-address-address-}
No description
