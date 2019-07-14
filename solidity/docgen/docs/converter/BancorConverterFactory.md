# Contract `BancorConverterFactory`



#### Functions:
- [`constructor()`](#BancorConverterFactory-constructor)
- [`createConverter(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)`](#BancorConverterFactory-createConverter-contract-ISmartToken-contract-IContractRegistry-uint32-contract-IERC20Token-uint32)

#### Events:
- [`NewConverter(address _converter, address _owner)`](#BancorConverterFactory-NewConverter-address-address)

#### Function `constructor()` {#BancorConverterFactory-constructor}
constructor
#### Function `createConverter(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight) → address converterAddress` {#BancorConverterFactory-createConverter-contract-ISmartToken-contract-IContractRegistry-uint32-contract-IERC20Token-uint32}
creates a new converter with the given arguments and transfers
the ownership and management to the sender.

###### Parameters:
- `_token`:              smart token governed by the converter

- `_registry`:           address of a contract registry contract

- `_maxConversionFee`:   maximum conversion fee, represented in ppm

- `_connectorToken`:     optional, initial connector, allows defining the first connector at deployment time

- `_connectorWeight`:    optional, weight for the initial connector


#### Event `NewConverter(address _converter, address _owner)` {#BancorConverterFactory-NewConverter-address-address}
No description
