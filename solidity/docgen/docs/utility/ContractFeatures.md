

# Functions:
- [`constructor()`](#ContractFeatures-constructor--)
- [`isSupported(address _contract, uint256 _features)`](#ContractFeatures-isSupported-address-uint256-)
- [`enableFeatures(uint256 _features, bool _enable)`](#ContractFeatures-enableFeatures-uint256-bool-)

---

# Events:
- [`FeaturesAddition(address _address, uint256 _features)`](#ContractFeatures-FeaturesAddition-address-uint256-)
- [`FeaturesRemoval(address _address, uint256 _features)`](#ContractFeatures-FeaturesRemoval-address-uint256-)

---

## Function `constructor()` {#ContractFeatures-constructor--}
constructor
## Function `isSupported(address _contract, uint256 _features) → bool` {#ContractFeatures-isSupported-address-uint256-}
returns true if a given contract supports the given feature(s), false if not

### Parameters:
- `_contract`:    contract address to check support for

- `_features`:    feature(s) to check for

## Function `enableFeatures(uint256 _features, bool _enable)` {#ContractFeatures-enableFeatures-uint256-bool-}
allows a contract to enable/disable certain feature(s)

### Parameters:
- `_features`:    feature(s) to enable/disable

- `_enable`:      true to enable the feature(s), false to disabled them

---

## Event `FeaturesAddition(address _address, uint256 _features)` {#ContractFeatures-FeaturesAddition-address-uint256-}
No description
## Event `FeaturesRemoval(address _address, uint256 _features)` {#ContractFeatures-FeaturesRemoval-address-uint256-}
No description
