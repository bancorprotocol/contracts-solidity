Bancor Converter Upgrader

The Bancor converter upgrader contract allows upgrading an older Bancor converter contract (0.4 and up)

to the latest version.

To begin the upgrade process, simply execute the 'upgrade' function.

At the end of the process, the ownership of the newly upgraded converter will be transferred

back to the original owner and the original owner will need to execute the 'acceptOwnership' function.

The address of the new converter is available in the ConverterUpgrade event.

Note that for older converters that don't yet have the 'upgrade' function, ownership should first

be transferred manually to the ConverterUpgrader contract using the 'transferOwnership' function

and then the upgrader 'upgrade' function should be executed directly.

# Functions:

- [`constructor(contract IContractRegistry _registry)`](#BancorConverterUpgrader-constructor-contract-IContractRegistry-)

- [`setRegistry(contract IContractRegistry _registry)`](#BancorConverterUpgrader-setRegistry-contract-IContractRegistry-)

- [`upgrade(bytes32 _version)`](#BancorConverterUpgrader-upgrade-bytes32-)

- [`upgrade(uint16 _version)`](#BancorConverterUpgrader-upgrade-uint16-)

- [`upgradeOld(contract IBancorConverter _converter, bytes32 _version)`](#BancorConverterUpgrader-upgradeOld-contract-IBancorConverter-bytes32-)

# Events:

- [`ConverterOwned(address _converter, address _owner)`](#BancorConverterUpgrader-ConverterOwned-address-address-)

- [`ConverterUpgrade(address _oldConverter, address _newConverter)`](#BancorConverterUpgrader-ConverterUpgrade-address-address-)

# Function `constructor(contract IContractRegistry _registry)` {#BancorConverterUpgrader-constructor-contract-IContractRegistry-}

initializes a new BancorConverterUpgrader instance

# Function `setRegistry(contract IContractRegistry _registry)` {#BancorConverterUpgrader-setRegistry-contract-IContractRegistry-}

allows the owner to update the contract registry contract address

## Parameters:

- `_registry`:   address of a contract registry contract

# Function `upgrade(bytes32 _version)` {#BancorConverterUpgrader-upgrade-bytes32-}

upgrades an old converter to the latest version

will throw if ownership wasn't transferred to the upgrader before calling this function.

ownership of the new converter will be transferred back to the original owner.

fires the ConverterUpgrade event upon success.

can only be called by a converter

## Parameters:

- `_version`: old converter version

# Function `upgrade(uint16 _version)` {#BancorConverterUpgrader-upgrade-uint16-}

upgrades an old converter to the latest version

will throw if ownership wasn't transferred to the upgrader before calling this function.

ownership of the new converter will be transferred back to the original owner.

fires the ConverterUpgrade event upon success.

can only be called by a converter

## Parameters:

- `_version`: old converter version

# Function `upgradeOld(contract IBancorConverter _converter, bytes32 _version)` {#BancorConverterUpgrader-upgradeOld-contract-IBancorConverter-bytes32-}

upgrades an old converter to the latest version

will throw if ownership wasn't transferred to the upgrader before calling this function.

ownership of the new converter will be transferred back to the original owner.

fires the ConverterUpgrade event upon success.

## Parameters:

- `_converter`:   old converter contract address

- `_version`:     old converter version

# Event `ConverterOwned(address _converter, address _owner)` {#BancorConverterUpgrader-ConverterOwned-address-address-}

triggered when the contract accept a converter ownership

## Parameters:

- `_converter`:   converter address

- `_owner`:       new owner - local upgrader address

# Event `ConverterUpgrade(address _oldConverter, address _newConverter)` {#BancorConverterUpgrader-ConverterUpgrade-address-address-}

triggered when the upgrading process is done

## Parameters:

- `_oldConverter`:    old converter address

- `_newConverter`:    new converter address
