

# Functions:
- [`constructor()`](#BancorFormula-constructor--)
- [`calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _depositAmount)`](#BancorFormula-calculatePurchaseReturn-uint256-uint256-uint32-uint256-)
- [`calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _sellAmount)`](#BancorFormula-calculateSaleReturn-uint256-uint256-uint32-uint256-)
- [`calculateCrossReserveReturn(uint256 _fromReserveBalance, uint32 _fromReserveRatio, uint256 _toReserveBalance, uint32 _toReserveRatio, uint256 _amount)`](#BancorFormula-calculateCrossReserveReturn-uint256-uint32-uint256-uint32-uint256-)
- [`calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount)`](#BancorFormula-calculateCrossConnectorReturn-uint256-uint32-uint256-uint32-uint256-)



# Function `constructor()` {#BancorFormula-constructor--}
No description


# Function `calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _depositAmount) → uint256` {#BancorFormula-calculatePurchaseReturn-uint256-uint256-uint32-uint256-}
given a token supply, reserve balance, ratio and a deposit amount (in the reserve token),
calculates the return for a given conversion (in the main token)

Formula:
Return = _supply * ((1 + _depositAmount / _reserveBalance) ^ (_reserveRatio / 1000000) - 1)


## Parameters:
- `_supply`:              token total supply

- `_reserveBalance`:      total reserve balance

- `_reserveRatio`:        reserve ratio, represented in ppm, 1-1000000

- `_depositAmount`:       deposit amount, in reserve token




# Function `calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint32 _reserveRatio, uint256 _sellAmount) → uint256` {#BancorFormula-calculateSaleReturn-uint256-uint256-uint32-uint256-}
given a token supply, reserve balance, ratio and a sell amount (in the main token),
calculates the return for a given conversion (in the reserve token)

Formula:
Return = _reserveBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_reserveRatio / 1000000)))


## Parameters:
- `_supply`:              token total supply

- `_reserveBalance`:      total reserve

- `_reserveRatio`:        constant reserve Ratio, represented in ppm, 1-1000000

- `_sellAmount`:          sell amount, in the token itself




# Function `calculateCrossReserveReturn(uint256 _fromReserveBalance, uint32 _fromReserveRatio, uint256 _toReserveBalance, uint32 _toReserveRatio, uint256 _amount) → uint256` {#BancorFormula-calculateCrossReserveReturn-uint256-uint32-uint256-uint32-uint256-}
given two reserve balances/ratios and a sell amount (in the first reserve token),
calculates the return for a conversion from the first reserve token to the second reserve token (in the second reserve token)

Formula:
Return = _toReserveBalance * (1 - (_fromReserveBalance / (_fromReserveBalance + _amount)) ^ (_fromReserveRatio / _toReserveRatio))


## Parameters:
- `_fromReserveBalance`:      input reserve balance

- `_fromReserveRatio`:        input reserve ratio, represented in ppm, 1-1000000

- `_toReserveBalance`:        output reserve balance

- `_toReserveRatio`:          output reserve ratio, represented in ppm, 1-1000000

- `_amount`:                  input reserve amount


















# Function `calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount) → uint256` {#BancorFormula-calculateCrossConnectorReturn-uint256-uint32-uint256-uint32-uint256-}
deprecated, backward compatibility


