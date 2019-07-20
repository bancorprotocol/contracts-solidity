# Contract `Owned`



#### Functions:
- `constructor()`
- `transferOwnership(address _newOwner)`
- `acceptOwnership()`

#### Events:
- `OwnerUpdate(address _prevOwner, address _newOwner)`

---

#### Function `constructor()`
constructor
#### Function `transferOwnership(address _newOwner)`
allows transferring the contract ownership
the new owner still needs to accept the transfer
can only be called by the contract owner

###### Parameters:
- `_newOwner`:    new contract owner
#### Function `acceptOwnership()`
used by a new owner to accept an ownership transfer

#### Event `OwnerUpdate(address _prevOwner, address _newOwner)`
No description


