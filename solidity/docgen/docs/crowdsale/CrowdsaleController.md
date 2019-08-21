Crowdsale
The crowdsale version of the smart token controller, allows contributing ether in exchange for Bancor tokens
The price remains fixed for the entire duration of the crowdsale
Note that 20% of the contributions are the BNT token's ETH connector balance

# Functions:
- [`constructor(contract ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash)`](#CrowdsaleController-constructor-contract-ISmartToken-uint256-address-address-bytes32-)
- [`computeRealCap(uint256 _cap, uint256 _key)`](#CrowdsaleController-computeRealCap-uint256-uint256-)
- [`enableRealCap(uint256 _cap, uint256 _key)`](#CrowdsaleController-enableRealCap-uint256-uint256-)
- [`computeReturn(uint256 _contribution)`](#CrowdsaleController-computeReturn-uint256-)
- [`contributeETH()`](#CrowdsaleController-contributeETH--)
- [`contributeBTCs()`](#CrowdsaleController-contributeBTCs--)
- [`fallback()`](#CrowdsaleController-fallback--)

# Events:
- [`Contribution(address _contributor, uint256 _amount, uint256 _return)`](#CrowdsaleController-Contribution-address-uint256-uint256-)

# Function `constructor(contract ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash)` {#CrowdsaleController-constructor-contract-ISmartToken-uint256-address-address-bytes32-}
initializes a new CrowdsaleController instance

## Parameters:
- `_token`:          smart token the crowdsale is for

- `_startTime`:      crowdsale start time

- `_beneficiary`:    address to receive all ether contributions

- `_btcs`:           bitcoin suisse address
# Function `computeRealCap(uint256 _cap, uint256 _key) → bytes32` {#CrowdsaleController-computeRealCap-uint256-uint256-}
computes the real cap based on the given cap & key

## Parameters:
- `_cap`:    cap

- `_key`:    key used to compute the cap hash

# Function `enableRealCap(uint256 _cap, uint256 _key)` {#CrowdsaleController-enableRealCap-uint256-uint256-}
enables the real cap defined on deployment

## Parameters:
- `_cap`:    predefined cap

- `_key`:    key used to compute the cap hash
# Function `computeReturn(uint256 _contribution) → uint256` {#CrowdsaleController-computeReturn-uint256-}
computes the number of tokens that should be issued for a given contribution

## Parameters:
- `_contribution`:    contribution amount

# Function `contributeETH() → uint256 amount` {#CrowdsaleController-contributeETH--}
ETH contribution
can only be called during the crowdsale

# Function `contributeBTCs() → uint256 amount` {#CrowdsaleController-contributeBTCs--}
Contribution through BTCs (Bitcoin Suisse only)
can only be called before the crowdsale started

# Function `fallback()` {#CrowdsaleController-fallback--}
No description

# Event `Contribution(address _contributor, uint256 _amount, uint256 _return)` {#CrowdsaleController-Contribution-address-uint256-uint256-}
No description
