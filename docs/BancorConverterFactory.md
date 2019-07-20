# Contract `BancorConverterFactory`



#### Functions:
- `constructor()`
- `createConverter(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)`

#### Events:
- `NewConverter(address _converter, address _owner)`

---

#### Function `constructor()`
constructor
#### Function `createConverter(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight) → address converterAddress`
creates a new converter with the given arguments and transfers
the ownership and management to the sender.

###### Parameters:
- `_token`:              smart token governed by the converter

- `_registry`:           address of a contract registry contract

- `_maxConversionFee`:   maximum conversion fee, represented in ppm

- `_connectorToken`:     optional, initial connector, allows defining the first connector at deployment time

- `_connectorWeight`:    optional, weight for the initial connector


#### Event `NewConverter(address _converter, address _owner)`
No description


