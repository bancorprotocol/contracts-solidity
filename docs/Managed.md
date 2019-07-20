# Contract `Managed`



#### Functions:
- `constructor()`
- `transferManagement(address _newManager)`
- `acceptManagement()`

#### Events:
- `ManagerUpdate(address _prevManager, address _newManager)`

---

#### Function `constructor()`
constructor
#### Function `transferManagement(address _newManager)`
allows transferring the contract management
the new manager still needs to accept the transfer
can only be called by the contract manager

###### Parameters:
- `_newManager`:    new contract manager
#### Function `acceptManagement()`
used by a new manager to accept a management transfer

#### Event `ManagerUpdate(address _prevManager, address _newManager)`
No description


