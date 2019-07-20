# Contract `BancorConverter`



#### Functions:
- `constructor(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)`
- `updateRegistry()`
- `restoreRegistry()`
- `disableRegistryUpdate(bool _disable)`
- `enableClaimTokens(bool _enable)`
- `connectorTokenCount()`
- `setConversionWhitelist(contract IWhitelist _whitelist)`
- `disableConversions(bool _disable)`
- `transferTokenOwnership(address _newOwner)`
- `setConversionFee(uint32 _conversionFee)`
- `getFinalAmount(uint256 _amount, uint8 _magnitude)`
- `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
- `claimTokens(address _from, uint256 _amount)`
- `upgrade()`
- `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`
- `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`
- `disableConnectorSale(contract IERC20Token _connectorToken, bool _disable)`
- `getConnectorBalance(contract IERC20Token _connectorToken)`
- `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount)`
- `getPurchaseReturn(contract IERC20Token _connectorToken, uint256 _depositAmount)`
- `getSaleReturn(contract IERC20Token _connectorToken, uint256 _sellAmount)`
- `getCrossConnectorReturn(contract IERC20Token _fromConnectorToken, contract IERC20Token _toConnectorToken, uint256 _sellAmount)`
- `convertInternal(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`
- `convert(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`
- `buy(contract IERC20Token _connectorToken, uint256 _depositAmount, uint256 _minReturn)`
- `sell(contract IERC20Token _connectorToken, uint256 _sellAmount, uint256 _minReturn)`
- `quickConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`
- `quickConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `completeXConversion(contract IERC20Token[] _path, uint256 _minReturn, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `fund(uint256 _amount)`
- `liquidate(uint256 _amount)`
- `change(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`

#### Events:
- `Conversion(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return, int256 _conversionFee)`
- `PriceDataUpdate(address _connectorToken, uint256 _tokenSupply, uint256 _connectorBalance, uint32 _connectorWeight)`
- `ConversionFeeUpdate(uint32 _prevFee, uint32 _newFee)`
- `ConversionsEnable(bool _conversionsEnabled)`

---

#### Function `constructor(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)`
constructor

###### Parameters:
- `_token`:              smart token governed by the converter

- `_registry`:           address of a contract registry contract

- `_maxConversionFee`:   maximum conversion fee, represented in ppm

- `_connectorToken`:     optional, initial connector, allows defining the first connector at deployment time

- `_connectorWeight`:    optional, weight for the initial connector
#### Function `updateRegistry()`
sets the contract registry to whichever address the current registry is pointing to
#### Function `restoreRegistry()`
security mechanism allowing the converter owner to revert to the previous registry,
to be used in emergency scenario
#### Function `disableRegistryUpdate(bool _disable)`
disables the registry update functionality
this is a safety mechanism in case of a emergency
can only be called by the manager or owner

###### Parameters:
- `_disable`:    true to disable registry updates, false to re-enable them
#### Function `enableClaimTokens(bool _enable)`
disables/enables the claim tokens functionality

###### Parameters:
- `_enable`:    true to enable claiming of tokens, false to disable
#### Function `connectorTokenCount() → uint16`
returns the number of connector tokens defined

#### Function `setConversionWhitelist(contract IWhitelist _whitelist)`
allows the owner to update &amp; enable the conversion whitelist contract address
when set, only addresses that are whitelisted are actually allowed to use the converter
note that the whitelist check is actually done by the BancorNetwork contract

###### Parameters:
- `_whitelist`:    address of a whitelist contract
#### Function `disableConversions(bool _disable)`
disables the entire conversion functionality
this is a safety mechanism in case of a emergency
can only be called by the manager

###### Parameters:
- `_disable`: true to disable conversions, false to re-enable them
#### Function `transferTokenOwnership(address _newOwner)`
allows transferring the token ownership
the new owner needs to accept the transfer
can only be called by the contract owner
note that token ownership can only be transferred while the owner is the converter upgrader contract

###### Parameters:
- `_newOwner`:    new token owner
#### Function `setConversionFee(uint32 _conversionFee)`
updates the current conversion fee
can only be called by the manager

###### Parameters:
- `_conversionFee`: new conversion fee, represented in ppm
#### Function `getFinalAmount(uint256 _amount, uint8 _magnitude) → uint256`
given a return amount, returns the amount minus the conversion fee

###### Parameters:
- `_amount`:      return amount

- `_magnitude`:   1 for standard conversion, 2 for cross connector conversion

#### Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
withdraws tokens held by the converter and sends them to an account
can only be called by the owner
note that connector tokens can only be withdrawn by the owner while the converter is inactive
unless the owner is the converter upgrader contract

###### Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw
#### Function `claimTokens(address _from, uint256 _amount)`
allows the BancorX contract to claim BNT from any address (so that users
dont have to first give allowance when calling BancorX)

###### Parameters:
- `_from`:      address to claim the BNT from

- `_amount`:    the amount to claim
#### Function `upgrade()`
upgrades the converter to the latest version
can only be called by the owner
note that the owner needs to call acceptOwnership/acceptManagement on the new converter after the upgrade
#### Function `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`
defines a new connector for the token
can only be called by the owner while the converter is inactive

###### Parameters:
- `_token`:                  address of the connector token

- `_weight`:                 constant connector weight, represented in ppm, 1-1000000

- `_enableVirtualBalance`:   true to enable virtual balance for the connector, false to disable it
#### Function `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`
updates one of the token connectors
can only be called by the owner

###### Parameters:
- `_connectorToken`:         address of the connector token

- `_weight`:                 constant connector weight, represented in ppm, 1-1000000

- `_enableVirtualBalance`:   true to enable virtual balance for the connector, false to disable it

- `_virtualBalance`:         new connector&#x27;s virtual balance
#### Function `disableConnectorSale(contract IERC20Token _connectorToken, bool _disable)`
disables converting from the given connector token in case the connector token got compromised
can only be called by the owner
note that converting to the token is still enabled regardless of this flag and it cannot be disabled by the owner

###### Parameters:
- `_connectorToken`:  connector token contract address

- `_disable`:         true to disable the token, false to re-enable it
#### Function `getConnectorBalance(contract IERC20Token _connectorToken) → uint256`
returns the connector&#x27;s virtual balance if one is defined, otherwise returns the actual balance

###### Parameters:
- `_connectorToken`:  connector token contract address

#### Function `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount) → uint256, uint256`
returns the expected return for converting a specific amount of _fromToken to _toToken

###### Parameters:
- `_fromToken`:  ERC20 token to convert from

- `_toToken`:    ERC20 token to convert to

- `_amount`:     amount to convert, in fromToken

#### Function `getPurchaseReturn(contract IERC20Token _connectorToken, uint256 _depositAmount) → uint256, uint256`
returns the expected return for buying the token for a connector token

###### Parameters:
- `_connectorToken`:  connector token contract address

- `_depositAmount`:   amount to deposit (in the connector token)

#### Function `getSaleReturn(contract IERC20Token _connectorToken, uint256 _sellAmount) → uint256, uint256`
returns the expected return for selling the token for one of its connector tokens

###### Parameters:
- `_connectorToken`:  connector token contract address

- `_sellAmount`:      amount to sell (in the smart token)

#### Function `getCrossConnectorReturn(contract IERC20Token _fromConnectorToken, contract IERC20Token _toConnectorToken, uint256 _sellAmount) → uint256, uint256`
returns the expected return for selling one of the connector tokens for another connector token

###### Parameters:
- `_fromConnectorToken`:  contract address of the connector token to convert from

- `_toConnectorToken`:    contract address of the connector token to convert to

- `_sellAmount`:          amount to sell (in the from connector token)

#### Function `convertInternal(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256`
converts a specific amount of _fromToken to _toToken

###### Parameters:
- `_fromToken`:  ERC20 token to convert from

- `_toToken`:    ERC20 token to convert to

- `_amount`:     amount to convert, in fromToken

- `_minReturn`:  if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `convert(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256`
converts a specific amount of _fromToken to _toToken

###### Parameters:
- `_fromToken`:  ERC20 token to convert from

- `_toToken`:    ERC20 token to convert to

- `_amount`:     amount to convert, in fromToken

- `_minReturn`:  if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `buy(contract IERC20Token _connectorToken, uint256 _depositAmount, uint256 _minReturn) → uint256`
buys the token by depositing one of its connector tokens

###### Parameters:
- `_connectorToken`:  connector token contract address

- `_depositAmount`:   amount to deposit (in the connector token)

- `_minReturn`:       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `sell(contract IERC20Token _connectorToken, uint256 _sellAmount, uint256 _minReturn) → uint256`
sells the token by withdrawing from one of its connector tokens

###### Parameters:
- `_connectorToken`:  connector token contract address

- `_sellAmount`:      amount to sell (in the smart token)

- `_minReturn`:       if the conversion results in an amount smaller the minimum return - it is cancelled, must be nonzero

#### Function `quickConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256`
converts the token to any other token in the bancor network by following a predefined conversion path
note that when converting from an ERC20 token (as opposed to a smart token), allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format in the BancorNetwork contract

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `quickConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
converts the token to any other token in the bancor network by following a predefined conversion path
note that when converting from an ERC20 token (as opposed to a smart token), allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format in the BancorNetwork contract

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_block`:       if the current block exceeded the given parameter - it is cancelled

- `_v`:           (signature[128:130]) associated with the signer address and helps validating if the signature is legit

- `_r`:           (signature[0:64]) associated with the signer address and helps validating if the signature is legit

- `_s`:           (signature[64:128]) associated with the signer address and helps validating if the signature is legit

#### Function `completeXConversion(contract IERC20Token[] _path, uint256 _minReturn, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
allows a user to convert BNT that was sent from another blockchain into any other
token on the BancorNetwork without specifying the amount of BNT to be converted, but
rather by providing the xTransferId which allows us to get the amount from BancorX.

###### Parameters:
- `_path`:             conversion path, see conversion path format in the BancorNetwork contract

- `_minReturn`:        if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_conversionId`:     pre-determined unique (if non zero) id which refers to this transaction 

- `_block`:            if the current block exceeded the given parameter - it is cancelled

- `_v`:                (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

- `_r`:                (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

- `_s`:                (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

#### Function `fund(uint256 _amount)`
buys the token with all connector tokens using the same percentage
i.e. if the caller increases the supply by 10%, it will cost an amount equal to
10% of each connector token balance
can only be called if the max total weight is exactly 100% and while conversions are enabled

###### Parameters:
- `_amount`:  amount to increase the supply by (in the smart token)
#### Function `liquidate(uint256 _amount)`
sells the token for all connector tokens using the same percentage
i.e. if the holder sells 10% of the supply, they will receive 10% of each
connector token balance in return
can only be called if the max total weight is exactly 100%
note that the function can also be called if conversions are disabled

###### Parameters:
- `_amount`:  amount to liquidate (in the smart token)
#### Function `change(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256`
No description

#### Event `Conversion(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return, int256 _conversionFee)`
No description
#### Event `PriceDataUpdate(address _connectorToken, uint256 _tokenSupply, uint256 _connectorBalance, uint32 _connectorWeight)`
No description
#### Event `ConversionFeeUpdate(uint32 _prevFee, uint32 _newFee)`
No description
#### Event `ConversionsEnable(bool _conversionsEnabled)`
No description


