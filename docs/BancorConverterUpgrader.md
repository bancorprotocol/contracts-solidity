# Contract `BancorConverterUpgrader`



#### Functions:
- `constructor(contract IContractRegistry _registry)`
- `setRegistry(contract IContractRegistry _registry)`
- `upgrade(bytes32 _version)`
- `upgrade(uint16 _version)`
- `upgradeOld(contract IBancorConverter _converter, bytes32 _version)`

#### Events:
- `ConverterOwned(address _converter, address _owner)`
- `ConverterUpgrade(address _oldConverter, address _newConverter)`

---

#### Function `constructor(contract IContractRegistry _registry)`
constructor
#### Function `setRegistry(contract IContractRegistry _registry)`
No description
#### Function `upgrade(bytes32 _version)`
upgrades an old converter to the latest version
will throw if ownership wasn&#x27;t transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.
can only be called by a converter

###### Parameters:
- `_version`: old converter version
#### Function `upgrade(uint16 _version)`
upgrades an old converter to the latest version
will throw if ownership wasn&#x27;t transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.
can only be called by a converter

###### Parameters:
- `_version`: old converter version
#### Function `upgradeOld(contract IBancorConverter _converter, bytes32 _version)`
upgrades an old converter to the latest version
will throw if ownership wasn&#x27;t transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.

###### Parameters:
- `_converter`:   old converter contract address

- `_version`:     old converter version

#### Event `ConverterOwned(address _converter, address _owner)`
No description
#### Event `ConverterUpgrade(address _oldConverter, address _newConverter)`
No description


