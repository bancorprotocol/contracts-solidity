

# Functions:
- [`constructor(contract IContractRegistry _registry)`](#BancorConverterUpgrader-constructor-contract-IContractRegistry-)
- [`setRegistry(contract IContractRegistry _registry)`](#BancorConverterUpgrader-setRegistry-contract-IContractRegistry-)
- [`upgrade(bytes32 _version)`](#BancorConverterUpgrader-upgrade-bytes32-)
- [`upgrade(uint16 _version)`](#BancorConverterUpgrader-upgrade-uint16-)
- [`upgradeOld(contract IBancorConverter _converter, bytes32 _version)`](#BancorConverterUpgrader-upgradeOld-contract-IBancorConverter-bytes32-)

---

# Events:
- [`ConverterOwned(address _converter, address _owner)`](#BancorConverterUpgrader-ConverterOwned-address-address-)
- [`ConverterUpgrade(address _oldConverter, address _newConverter)`](#BancorConverterUpgrader-ConverterUpgrade-address-address-)

---

## Function `constructor(contract IContractRegistry _registry)` {#BancorConverterUpgrader-constructor-contract-IContractRegistry-}
constructor
## Function `setRegistry(contract IContractRegistry _registry)` {#BancorConverterUpgrader-setRegistry-contract-IContractRegistry-}
No description
## Function `upgrade(bytes32 _version)` {#BancorConverterUpgrader-upgrade-bytes32-}
upgrades an old converter to the latest version
will throw if ownership wasn't transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.
can only be called by a converter

### Parameters:
- `_version`: old converter version
## Function `upgrade(uint16 _version)` {#BancorConverterUpgrader-upgrade-uint16-}
upgrades an old converter to the latest version
will throw if ownership wasn't transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.
can only be called by a converter

### Parameters:
- `_version`: old converter version
## Function `upgradeOld(contract IBancorConverter _converter, bytes32 _version)` {#BancorConverterUpgrader-upgradeOld-contract-IBancorConverter-bytes32-}
upgrades an old converter to the latest version
will throw if ownership wasn't transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.

### Parameters:
- `_converter`:   old converter contract address

- `_version`:     old converter version

---

## Event `ConverterOwned(address _converter, address _owner)` {#BancorConverterUpgrader-ConverterOwned-address-address-}
No description
## Event `ConverterUpgrade(address _oldConverter, address _newConverter)` {#BancorConverterUpgrader-ConverterUpgrade-address-address-}
No description
