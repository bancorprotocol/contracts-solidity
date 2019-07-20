# Contract `ContractFeatures`



#### Functions:
- `constructor()`
- `isSupported(address _contract, uint256 _features)`
- `enableFeatures(uint256 _features, bool _enable)`

#### Events:
- `FeaturesAddition(address _address, uint256 _features)`
- `FeaturesRemoval(address _address, uint256 _features)`

---

#### Function `constructor()`
constructor
#### Function `isSupported(address _contract, uint256 _features) → bool`
returns true if a given contract supports the given feature(s), false if not

###### Parameters:
- `_contract`:    contract address to check support for

- `_features`:    feature(s) to check for

#### Function `enableFeatures(uint256 _features, bool _enable)`
allows a contract to enable/disable certain feature(s)

###### Parameters:
- `_features`:    feature(s) to enable/disable

- `_enable`:      true to enable the feature(s), false to disabled them

#### Event `FeaturesAddition(address _address, uint256 _features)`
No description
#### Event `FeaturesRemoval(address _address, uint256 _features)`
No description


