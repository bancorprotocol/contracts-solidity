# Contract `BancorFormula`



#### Functions:
- `constructor()`
- `calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount)`
- `calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount)`
- `calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount)`
- `power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD)`
- `generalLog(uint256 x)`
- `floorLog2(uint256 _n)`
- `findPositionInMaxExpArray(uint256 _x)`
- `generalExp(uint256 _x, uint8 _precision)`
- `optimalLog(uint256 x)`
- `optimalExp(uint256 x)`


---

#### Function `constructor()`
No description
#### Function `calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount) → uint256`
given a token supply, connector balance, weight and a deposit amount (in the connector token),
calculates the return for a given conversion (in the main token)
Formula:
Return &#x3D; _supply * ((1 + _depositAmount / _connectorBalance) ^ (_connectorWeight / 1000000) - 1)

###### Parameters:
- `_supply`:              token total supply

- `_connectorBalance`:    total connector balance

- `_connectorWeight`:     connector weight, represented in ppm, 1-1000000

- `_depositAmount`:       deposit amount, in connector token

#### Function `calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount) → uint256`
given a token supply, connector balance, weight and a sell amount (in the main token),
calculates the return for a given conversion (in the connector token)
Formula:
Return &#x3D; _connectorBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_connectorWeight / 1000000)))

###### Parameters:
- `_supply`:              token total supply

- `_connectorBalance`:    total connector

- `_connectorWeight`:     constant connector Weight, represented in ppm, 1-1000000

- `_sellAmount`:          sell amount, in the token itself

#### Function `calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount) → uint256`
given two connector balances/weights and a sell amount (in the first connector token),
calculates the return for a conversion from the first connector token to the second connector token (in the second connector token)
Formula:
Return &#x3D; _toConnectorBalance * (1 - (_fromConnectorBalance / (_fromConnectorBalance + _amount)) ^ (_fromConnectorWeight / _toConnectorWeight))

###### Parameters:
- `_fromConnectorBalance`:    input connector balance

- `_fromConnectorWeight`:     input connector weight, represented in ppm, 1-1000000

- `_toConnectorBalance`:      output connector balance

- `_toConnectorWeight`:       output connector weight, represented in ppm, 1-1000000

- `_amount`:                  input connector amount

#### Function `power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) → uint256, uint8`
No description
#### Function `generalLog(uint256 x) → uint256`
No description
#### Function `floorLog2(uint256 _n) → uint8`
No description
#### Function `findPositionInMaxExpArray(uint256 _x) → uint8`
No description
#### Function `generalExp(uint256 _x, uint8 _precision) → uint256`
No description
#### Function `optimalLog(uint256 x) → uint256`
No description
#### Function `optimalExp(uint256 x) → uint256`
No description



