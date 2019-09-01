

# Functions:
- [`constructor()`](#BancorFormula-constructor--)
- [`calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount)`](#BancorFormula-calculatePurchaseReturn-uint256-uint256-uint32-uint256-)
- [`calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount)`](#BancorFormula-calculateSaleReturn-uint256-uint256-uint32-uint256-)
- [`calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount)`](#BancorFormula-calculateCrossConnectorReturn-uint256-uint32-uint256-uint32-uint256-)
- [`calculateFundReturn(uint256 _supply, uint256 _connectorBalance, uint32 _totalWeight, uint256 _amount)`](#BancorFormula-calculateFundReturn-uint256-uint256-uint32-uint256-)
- [`calculateLiquidateReturn(uint256 _supply, uint256 _connectorBalance, uint32 _totalWeight, uint256 _amount)`](#BancorFormula-calculateLiquidateReturn-uint256-uint256-uint32-uint256-)
- [`power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD)`](#BancorFormula-power-uint256-uint256-uint32-uint32-)
- [`generalLog(uint256 x)`](#BancorFormula-generalLog-uint256-)
- [`floorLog2(uint256 _n)`](#BancorFormula-floorLog2-uint256-)
- [`findPositionInMaxExpArray(uint256 _x)`](#BancorFormula-findPositionInMaxExpArray-uint256-)
- [`generalExp(uint256 _x, uint8 _precision)`](#BancorFormula-generalExp-uint256-uint8-)
- [`optimalLog(uint256 x)`](#BancorFormula-optimalLog-uint256-)
- [`optimalExp(uint256 x)`](#BancorFormula-optimalExp-uint256-)


# Function `constructor()` {#BancorFormula-constructor--}
No description
# Function `calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount) → uint256` {#BancorFormula-calculatePurchaseReturn-uint256-uint256-uint32-uint256-}
given a token supply, connector balance, weight and a deposit amount (in the connector token),
calculates the return for a given conversion (in the main token)

Formula:
Return = _supply * ((1 + _depositAmount / _connectorBalance) ^ (_connectorWeight / 1000000) - 1)


## Parameters:
- `_supply`:              token total supply

- `_connectorBalance`:    total connector balance

- `_connectorWeight`:     connector weight, represented in ppm, 1-1000000

- `_depositAmount`:       deposit amount, in connector token


# Function `calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount) → uint256` {#BancorFormula-calculateSaleReturn-uint256-uint256-uint32-uint256-}
given a token supply, connector balance, weight and a sell amount (in the main token),
calculates the return for a given conversion (in the connector token)

Formula:
Return = _connectorBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_connectorWeight / 1000000)))


## Parameters:
- `_supply`:              token total supply

- `_connectorBalance`:    total connector

- `_connectorWeight`:     constant connector Weight, represented in ppm, 1-1000000

- `_sellAmount`:          sell amount, in the token itself


# Function `calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount) → uint256` {#BancorFormula-calculateCrossConnectorReturn-uint256-uint32-uint256-uint32-uint256-}
given two connector balances/weights and a sell amount (in the first connector token),
calculates the return for a conversion from the first connector token to the second connector token (in the second connector token)

Formula:
Return = _toConnectorBalance * (1 - (_fromConnectorBalance / (_fromConnectorBalance + _amount)) ^ (_fromConnectorWeight / _toConnectorWeight))


## Parameters:
- `_fromConnectorBalance`:    input connector balance

- `_fromConnectorWeight`:     input connector weight, represented in ppm, 1-1000000

- `_toConnectorBalance`:      output connector balance

- `_toConnectorWeight`:       output connector weight, represented in ppm, 1-1000000

- `_amount`:                  input connector amount


# Function `calculateFundReturn(uint256 _supply, uint256 _connectorBalance, uint32 _totalWeight, uint256 _amount) → uint256` {#BancorFormula-calculateFundReturn-uint256-uint256-uint32-uint256-}
given a relay token supply, connector balance, total weight and an amount of relay tokens,
calculates the amount of connector tokens required for purchasing the given amount of relay tokens

Formula:
Return = _connectorBalance * (((_supply + _amount) / _supply) ^ (MAX_WEIGHT / _totalWeight) - 1)


## Parameters:
- `_supply`:              relay token supply

- `_connectorBalance`:    connector token balance

- `_totalWeight`:         total weight, represented in ppm, 2-2000000

- `_amount`:              amount of relay tokens


# Function `calculateLiquidateReturn(uint256 _supply, uint256 _connectorBalance, uint32 _totalWeight, uint256 _amount) → uint256` {#BancorFormula-calculateLiquidateReturn-uint256-uint256-uint32-uint256-}
given a relay token supply, connector balance, total weight and an amount of relay tokens,
calculates the amount of connector tokens received for selling the given amount of relay tokens

Formula:
Return = _connectorBalance * ((_supply / (_supply - _amount)) ^ (MAX_WEIGHT / _totalWeight) - 1)


## Parameters:
- `_supply`:              relay token supply

- `_connectorBalance`:    connector token balance

- `_totalWeight`:         total weight, represented in ppm, 2-2000000

- `_amount`:              amount of relay tokens


# Function `power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) → uint256, uint8` {#BancorFormula-power-uint256-uint256-uint32-uint32-}
General Description:
    Determine a value of precision.
    Calculate an integer approximation of (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision.
    Return the result along with the precision used.

Detailed Description:
    Instead of calculating "base ^ exp", we calculate "e ^ (log(base) * exp)".
    The value of "log(base)" is represented with an integer slightly smaller than "log(base) * 2 ^ precision".
    The larger "precision" is, the more accurately this value represents the real value.
    However, the larger "precision" is, the more bits are required in order to store this value.
    And the exponentiation function, which takes "x" and calculates "e ^ x", is limited to a maximum exponent (maximum value of "x").
    This maximum exponent depends on the "precision" used, and it is given by "maxExpArray[precision] >> (MAX_PRECISION - precision)".
    Hence we need to determine the highest precision which can be used for the given input, before calling the exponentiation function.
    This allows us to compute "base ^ exp" with maximum accuracy and without exceeding 256 bits in any of the intermediate computations.
    This functions assumes that "_expN < 2 ^ 256 / log(MAX_NUM - 1)", otherwise the multiplication should be replaced with a "safeMul".
# Function `generalLog(uint256 x) → uint256` {#BancorFormula-generalLog-uint256-}
computes log(x / FIXED_1) * FIXED_1.
This functions assumes that "x >= FIXED_1", because the output would be negative otherwise.
# Function `floorLog2(uint256 _n) → uint8` {#BancorFormula-floorLog2-uint256-}
computes the largest integer smaller than or equal to the binary logarithm of the input.
# Function `findPositionInMaxExpArray(uint256 _x) → uint8` {#BancorFormula-findPositionInMaxExpArray-uint256-}
the global "maxExpArray" is sorted in descending order, and therefore the following statements are equivalent:
- This function finds the position of [the smallest value in "maxExpArray" larger than or equal to "x"]
- This function finds the highest position of [a value in "maxExpArray" larger than or equal to "x"]
# Function `generalExp(uint256 _x, uint8 _precision) → uint256` {#BancorFormula-generalExp-uint256-uint8-}
this function can be auto-generated by the script 'PrintFunctionGeneralExp.py'.
it approximates "e ^ x" via maclaurin summation: "(x^0)/0! + (x^1)/1! + ... + (x^n)/n!".
it returns "e ^ (x / 2 ^ precision) * 2 ^ precision", that is, the result is upshifted for accuracy.
the global "maxExpArray" maps each "precision" to "((maximumExponent + 1) << (MAX_PRECISION - precision)) - 1".
the maximum permitted value for "x" is therefore given by "maxExpArray[precision] >> (MAX_PRECISION - precision)".
# Function `optimalLog(uint256 x) → uint256` {#BancorFormula-optimalLog-uint256-}
computes log(x / FIXED_1) * FIXED_1
Input range: FIXED_1 <= x <= LOG_EXP_MAX_VAL - 1
Auto-generated via 'PrintFunctionOptimalLog.py'
Detailed description:
- Rewrite the input as a product of natural exponents and a single residual r, such that 1 < r < 2
- The natural logarithm of each (pre-calculated) exponent is the degree of the exponent
- The natural logarithm of r is calculated via Taylor series for log(1 + x), where x = r - 1
- The natural logarithm of the input is calculated by summing up the intermediate results above
- For example: log(250) = log(e^4 * e^1 * e^0.5 * 1.021692859) = 4 + 1 + 0.5 + log(1 + 0.021692859)
# Function `optimalExp(uint256 x) → uint256` {#BancorFormula-optimalExp-uint256-}
computes e ^ (x / FIXED_1) * FIXED_1
input range: 0 <= x <= OPT_EXP_MAX_VAL - 1
auto-generated via 'PrintFunctionOptimalExp.py'
Detailed description:
- Rewrite the input as a sum of binary exponents and a single residual r, as small as possible
- The exponentiation of each binary exponent is given (pre-calculated)
- The exponentiation of r is calculated via Taylor series for e^x, where x = r
- The exponentiation of the input is calculated by multiplying the intermediate results above
- For example: e^5.521692859 = e^(4 + 1 + 0.5 + 0.021692859) = e^4 * e^1 * e^0.5 * e^0.021692859

