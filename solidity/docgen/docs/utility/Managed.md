Provides support and utilities for contract management
Note that a managed contract must also have an owner

# Functions:
- [`constructor()`](#Managed-constructor--)
- [`transferManagement(address _newManager)`](#Managed-transferManagement-address-)
- [`acceptManagement()`](#Managed-acceptManagement--)

# Events:
- [`ManagerUpdate(address _prevManager, address _newManager)`](#Managed-ManagerUpdate-address-address-)


# Function `constructor()` {#Managed-constructor--}
initializes a new Managed instance


# Function `transferManagement(address _newManager)` {#Managed-transferManagement-address-}
allows transferring the contract management
the new manager still needs to accept the transfer
can only be called by the contract manager


## Parameters:
- `_newManager`:    new contract manager


# Function `acceptManagement()` {#Managed-acceptManagement--}
used by a new manager to accept a management transfer



# Event `ManagerUpdate(address _prevManager, address _newManager)` {#Managed-ManagerUpdate-address-address-}
triggered when the manager is updated


## Parameters:
- `_prevManager`: previous manager

- `_newManager`:  new manager

