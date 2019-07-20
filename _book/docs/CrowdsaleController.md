# Contract `CrowdsaleController`



#### Functions:
- `constructor(contract ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash)`
- `computeRealCap(uint256 _cap, uint256 _key)`
- `enableRealCap(uint256 _cap, uint256 _key)`
- `computeReturn(uint256 _contribution)`
- `contributeETH()`
- `contributeBTCs()`
- `fallback()`

#### Events:
- `Contribution(address _contributor, uint256 _amount, uint256 _return)`

---

#### Function `constructor(contract ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash)`
constructor

###### Parameters:
- `_token`:          smart token the crowdsale is for

- `_startTime`:      crowdsale start time

- `_beneficiary`:    address to receive all ether contributions

- `_btcs`:           bitcoin suisse address
#### Function `computeRealCap(uint256 _cap, uint256 _key) → bytes32`
computes the real cap based on the given cap &amp; key

###### Parameters:
- `_cap`:    cap

- `_key`:    key used to compute the cap hash

#### Function `enableRealCap(uint256 _cap, uint256 _key)`
enables the real cap defined on deployment

###### Parameters:
- `_cap`:    predefined cap

- `_key`:    key used to compute the cap hash
#### Function `computeReturn(uint256 _contribution) → uint256`
computes the number of tokens that should be issued for a given contribution

###### Parameters:
- `_contribution`:    contribution amount

#### Function `contributeETH() → uint256 amount`
ETH contribution
can only be called during the crowdsale

#### Function `contributeBTCs() → uint256 amount`
Contribution through BTCs (Bitcoin Suisse only)
can only be called before the crowdsale started

#### Function `fallback()`
No description

#### Event `Contribution(address _contributor, uint256 _amount, uint256 _return)`
No description


