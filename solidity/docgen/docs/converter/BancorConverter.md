Bancor Converter v13
The Bancor converter allows for conversions between a Smart Token and other ERC20 tokens and between different ERC20 tokens and themselves. 
The ERC20 connector balance can be virtual, meaning that the calculations are based on the virtual balance instead of relying on the actual connector balance. This is a security mechanism that prevents the need to keep a very large (and valuable) balance in a single contract. 
The converter is upgradable (just like any SmartTokenController) and all upgrades are opt-in. 
WARNING: It is NOT RECOMMENDED to use the converter with Smart Tokens that have less than 8 decimal digits or with very small numbers because of precision loss 
Open issues:
- Front-running attacks are currently mitigated by the following mechanisms:
- minimum return argument for each conversion provides a way to define a minimum/maximum price for the transaction
- gas price limit prevents users from having control over the order of execution
- gas price limit check can be skipped if the transaction comes from a trusted, whitelisted signer
Other potential solutions might include a commit/reveal based schemes
- Possibly add getters for the connector fields so that the client won't need to rely on the order in the struct

# Functions:
- [`constructor(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)`](#BancorConverter-constructor-contract-ISmartToken-contract-IContractRegistry-uint32-contract-IERC20Token-uint32-)
- [`updateRegistry()`](#BancorConverter-updateRegistry--)
- [`restoreRegistry()`](#BancorConverter-restoreRegistry--)
- [`disableRegistryUpdate(bool _disable)`](#BancorConverter-disableRegistryUpdate-bool-)
- [`enableClaimTokens(bool _enable)`](#BancorConverter-enableClaimTokens-bool-)
- [`connectorTokenCount()`](#BancorConverter-connectorTokenCount--)
- [`setConversionWhitelist(contract IWhitelist _whitelist)`](#BancorConverter-setConversionWhitelist-contract-IWhitelist-)
- [`disableConversions(bool _disable)`](#BancorConverter-disableConversions-bool-)
- [`transferTokenOwnership(address _newOwner)`](#BancorConverter-transferTokenOwnership-address-)
- [`setConversionFee(uint32 _conversionFee)`](#BancorConverter-setConversionFee-uint32-)
- [`getFinalAmount(uint256 _amount, uint8 _magnitude)`](#BancorConverter-getFinalAmount-uint256-uint8-)
- [`withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`](#BancorConverter-withdrawTokens-contract-IERC20Token-address-uint256-)
- [`claimTokens(address _from, uint256 _amount)`](#BancorConverter-claimTokens-address-uint256-)
- [`upgrade()`](#BancorConverter-upgrade--)
- [`addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`](#BancorConverter-addConnector-contract-IERC20Token-uint32-bool-)
- [`updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`](#BancorConverter-updateConnector-contract-IERC20Token-uint32-bool-uint256-)
- [`disableConnectorSale(contract IERC20Token _connectorToken, bool _disable)`](#BancorConverter-disableConnectorSale-contract-IERC20Token-bool-)
- [`getConnectorBalance(contract IERC20Token _connectorToken)`](#BancorConverter-getConnectorBalance-contract-IERC20Token-)
- [`getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount)`](#BancorConverter-getReturn-contract-IERC20Token-contract-IERC20Token-uint256-)
- [`getPurchaseReturn(contract IERC20Token _connectorToken, uint256 _depositAmount)`](#BancorConverter-getPurchaseReturn-contract-IERC20Token-uint256-)
- [`getSaleReturn(contract IERC20Token _connectorToken, uint256 _sellAmount)`](#BancorConverter-getSaleReturn-contract-IERC20Token-uint256-)
- [`getCrossConnectorReturn(contract IERC20Token _fromConnectorToken, contract IERC20Token _toConnectorToken, uint256 _sellAmount)`](#BancorConverter-getCrossConnectorReturn-contract-IERC20Token-contract-IERC20Token-uint256-)
- [`convertInternal(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`](#BancorConverter-convertInternal-contract-IERC20Token-contract-IERC20Token-uint256-uint256-)
- [`convert(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`](#BancorConverter-convert-contract-IERC20Token-contract-IERC20Token-uint256-uint256-)
- [`buy(contract IERC20Token _connectorToken, uint256 _depositAmount, uint256 _minReturn)`](#BancorConverter-buy-contract-IERC20Token-uint256-uint256-)
- [`sell(contract IERC20Token _connectorToken, uint256 _sellAmount, uint256 _minReturn)`](#BancorConverter-sell-contract-IERC20Token-uint256-uint256-)
- [`quickConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`](#BancorConverter-quickConvert-contract-IERC20Token---uint256-uint256-)
- [`quickConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorConverter-quickConvertPrioritized-contract-IERC20Token---uint256-uint256-uint256-uint8-bytes32-bytes32-)
- [`completeXConversion(contract IERC20Token[] _path, uint256 _minReturn, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`](#BancorConverter-completeXConversion-contract-IERC20Token---uint256-uint256-uint256-uint8-bytes32-bytes32-)
- [`fund(uint256 _amount)`](#BancorConverter-fund-uint256-)
- [`liquidate(uint256 _amount)`](#BancorConverter-liquidate-uint256-)
- [`change(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`](#BancorConverter-change-contract-IERC20Token-contract-IERC20Token-uint256-uint256-)

# Events:
- [`Conversion(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return, int256 _conversionFee)`](#BancorConverter-Conversion-address-address-address-uint256-uint256-int256-)
- [`PriceDataUpdate(address _connectorToken, uint256 _tokenSupply, uint256 _connectorBalance, uint32 _connectorWeight)`](#BancorConverter-PriceDataUpdate-address-uint256-uint256-uint32-)
- [`ConversionFeeUpdate(uint32 _prevFee, uint32 _newFee)`](#BancorConverter-ConversionFeeUpdate-uint32-uint32-)
- [`ConversionsEnable(bool _conversionsEnabled)`](#BancorConverter-ConversionsEnable-bool-)

# Function `constructor(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)` {#BancorConverter-constructor-contract-ISmartToken-contract-IContractRegistry-uint32-contract-IERC20Token-uint32-}
initializes a new BancorConverter instance

## Parameters:
- `_token`:              smart token governed by the converter

- `_registry`:           address of a contract registry contract

- `_maxConversionFee`:   maximum conversion fee, represented in ppm

- `_connectorToken`:     optional, initial connector, allows defining the first connector at deployment time

- `_connectorWeight`:    optional, weight for the initial connector
# Function `updateRegistry()` {#BancorConverter-updateRegistry--}
sets the contract registry to whichever address the current registry is pointing to
# Function `restoreRegistry()` {#BancorConverter-restoreRegistry--}
security mechanism allowing the converter owner to revert to the previous registry,
to be used in emergency scenario
# Function `disableRegistryUpdate(bool _disable)` {#BancorConverter-disableRegistryUpdate-bool-}
disables the registry update functionality
this is a safety mechanism in case of a emergency
can only be called by the manager or owner

## Parameters:
- `_disable`:    true to disable registry updates, false to re-enable them
# Function `enableClaimTokens(bool _enable)` {#BancorConverter-enableClaimTokens-bool-}
disables/enables the claim tokens functionality

## Parameters:
- `_enable`:    true to enable claiming of tokens, false to disable
# Function `connectorTokenCount() → uint16` {#BancorConverter-connectorTokenCount--}
returns the number of connector tokens defined

# Function `setConversionWhitelist(contract IWhitelist _whitelist)` {#BancorConverter-setConversionWhitelist-contract-IWhitelist-}
allows the owner to update & enable the conversion whitelist contract address
when set, only addresses that are whitelisted are actually allowed to use the converter
note that the whitelist check is actually done by the BancorNetwork contract

## Parameters:
- `_whitelist`:    address of a whitelist contract
# Function `disableConversions(bool _disable)` {#BancorConverter-disableConversions-bool-}
disables the entire conversion functionality
this is a safety mechanism in case of a emergency
can only be called by the manager

## Parameters:
- `_disable`: true to disable conversions, false to re-enable them
# Function `transferTokenOwnership(address _newOwner)` {#BancorConverter-transferTokenOwnership-address-}
allows transferring the token ownership
the new owner needs to accept the transfer
can only be called by the contract owner
note that token ownership can only be transferred while the owner is the converter upgrader contract

## Parameters:
- `_newOwner`:    new token owner
# Function `setConversionFee(uint32 _conversionFee)` {#BancorConverter-setConversionFee-uint32-}
updates the current conversion fee
can only be called by the manager

## Parameters:
- `_conversionFee`: new conversion fee, represented in ppm
# Function `getFinalAmount(uint256 _amount, uint8 _magnitude) → uint256` {#BancorConverter-getFinalAmount-uint256-uint8-}
given a return amount, returns the amount minus the conversion fee

## Parameters:
- `_amount`:      return amount

- `_magnitude`:   1 for standard conversion, 2 for cross connector conversion

# Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)` {#BancorConverter-withdrawTokens-contract-IERC20Token-address-uint256-}
withdraws tokens held by the converter and sends them to an account
can only be called by the owner
note that connector tokens can only be withdrawn by the owner while the converter is inactive
unless the owner is the converter upgrader contract

## Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw
# Function `claimTokens(address _from, uint256 _amount)` {#BancorConverter-claimTokens-address-uint256-}
allows the BancorX contract to claim BNT from any address (so that users
dont have to first give allowance when calling BancorX)

## Parameters:
- `_from`:      address to claim the BNT from

- `_amount`:    the amount to claim
# Function `upgrade()` {#BancorConverter-upgrade--}
upgrades the converter to the latest version
can only be called by the owner
note that the owner needs to call acceptOwnership/acceptManagement on the new converter after the upgrade
# Function `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)` {#BancorConverter-addConnector-contract-IERC20Token-uint32-bool-}
defines a new connector for the token
can only be called by the owner while the converter is inactive

## Parameters:
- `_token`:                  address of the connector token

- `_weight`:                 constant connector weight, represented in ppm, 1-1000000

- `_enableVirtualBalance`:   true to enable virtual balance for the connector, false to disable it
# Function `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)` {#BancorConverter-updateConnector-contract-IERC20Token-uint32-bool-uint256-}
updates one of the token connectors
can only be called by the owner

## Parameters:
- `_connectorToken`:         address of the connector token

- `_weight`:                 constant connector weight, represented in ppm, 1-1000000

- `_enableVirtualBalance`:   true to enable virtual balance for the connector, false to disable it

- `_virtualBalance`:         new connector's virtual balance
# Function `disableConnectorSale(contract IERC20Token _connectorToken, bool _disable)` {#BancorConverter-disableConnectorSale-contract-IERC20Token-bool-}
disables converting from the given connector token in case the connector token got compromised
can only be called by the owner
note that converting to the token is still enabled regardless of this flag and it cannot be disabled by the owner

## Parameters:
- `_connectorToken`:  connector token contract address

- `_disable`:         true to disable the token, false to re-enable it
# Function `getConnectorBalance(contract IERC20Token _connectorToken) → uint256` {#BancorConverter-getConnectorBalance-contract-IERC20Token-}
returns the connector's virtual balance if one is defined, otherwise returns the actual balance

## Parameters:
- `_connectorToken`:  connector token contract address

# Function `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount) → uint256, uint256` {#BancorConverter-getReturn-contract-IERC20Token-contract-IERC20Token-uint256-}
returns the expected return for converting a specific amount of _fromToken to _toToken

## Parameters:
- `_fromToken`:  ERC20 token to convert from

- `_toToken`:    ERC20 token to convert to

- `_amount`:     amount to convert, in fromToken

# Function `getPurchaseReturn(contract IERC20Token _connectorToken, uint256 _depositAmount) → uint256, uint256` {#BancorConverter-getPurchaseReturn-contract-IERC20Token-uint256-}
returns the expected return for buying the token for a connector token

## Parameters:
- `_connectorToken`:  connector token contract address

- `_depositAmount`:   amount to deposit (in the connector token)

# Function `getSaleReturn(contract IERC20Token _connectorToken, uint256 _sellAmount) → uint256, uint256` {#BancorConverter-getSaleReturn-contract-IERC20Token-uint256-}
returns the expected return for selling the token for one of its connector tokens

## Parameters:
- `_connectorToken`:  connector token contract address

- `_sellAmount`:      amount to sell (in the smart token)

# Function `getCrossConnectorReturn(contract IERC20Token _fromConnectorToken, contract IERC20Token _toConnectorToken, uint256 _sellAmount) → uint256, uint256` {#BancorConverter-getCrossConnectorReturn-contract-IERC20Token-contract-IERC20Token-uint256-}
returns the expected return for selling one of the connector tokens for another connector token

## Parameters:
- `_fromConnectorToken`:  contract address of the connector token to convert from

- `_toConnectorToken`:    contract address of the connector token to convert to

- `_sellAmount`:          amount to sell (in the from connector token)

# Function `convertInternal(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256` {#BancorConverter-convertInternal-contract-IERC20Token-contract-IERC20Token-uint256-uint256-}
converts a specific amount of _fromToken to _toToken
can only be called by the bancor network contract

## Parameters:
- `_fromToken`:  ERC20 token to convert from

- `_toToken`:    ERC20 token to convert to

- `_amount`:     amount to convert, in fromToken

- `_minReturn`:  if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

# Function `convert(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256` {#BancorConverter-convert-contract-IERC20Token-contract-IERC20Token-uint256-uint256-}
converts a specific amount of _fromToken to _toToken

## Parameters:
- `_fromToken`:  ERC20 token to convert from

- `_toToken`:    ERC20 token to convert to

- `_amount`:     amount to convert, in fromToken

- `_minReturn`:  if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

# Function `buy(contract IERC20Token _connectorToken, uint256 _depositAmount, uint256 _minReturn) → uint256` {#BancorConverter-buy-contract-IERC20Token-uint256-uint256-}
buys the token by depositing one of its connector tokens

## Parameters:
- `_connectorToken`:  connector token contract address

- `_depositAmount`:   amount to deposit (in the connector token)

- `_minReturn`:       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

# Function `sell(contract IERC20Token _connectorToken, uint256 _sellAmount, uint256 _minReturn) → uint256` {#BancorConverter-sell-contract-IERC20Token-uint256-uint256-}
sells the token by withdrawing from one of its connector tokens

## Parameters:
- `_connectorToken`:  connector token contract address

- `_sellAmount`:      amount to sell (in the smart token)

- `_minReturn`:       if the conversion results in an amount smaller the minimum return - it is cancelled, must be nonzero

# Function `quickConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256` {#BancorConverter-quickConvert-contract-IERC20Token---uint256-uint256-}
converts the token to any other token in the bancor network by following a predefined conversion path
note that when converting from an ERC20 token (as opposed to a smart token), allowance must be set beforehand

## Parameters:
- `_path`:        conversion path, see conversion path format in the BancorNetwork contract

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

# Function `quickConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorConverter-quickConvertPrioritized-contract-IERC20Token---uint256-uint256-uint256-uint8-bytes32-bytes32-}
converts the token to any other token in the bancor network by following a predefined conversion path
note that when converting from an ERC20 token (as opposed to a smart token), allowance must be set beforehand

## Parameters:
- `_path`:        conversion path, see conversion path format in the BancorNetwork contract

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_block`:       if the current block exceeded the given parameter - it is cancelled

- `_v`:           (signature[128:130]) associated with the signer address and helps validating if the signature is legit

- `_r`:           (signature[0:64]) associated with the signer address and helps validating if the signature is legit

- `_s`:           (signature[64:128]) associated with the signer address and helps validating if the signature is legit

# Function `completeXConversion(contract IERC20Token[] _path, uint256 _minReturn, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256` {#BancorConverter-completeXConversion-contract-IERC20Token---uint256-uint256-uint256-uint8-bytes32-bytes32-}
allows a user to convert BNT that was sent from another blockchain into any other
token on the BancorNetwork without specifying the amount of BNT to be converted, but
rather by providing the xTransferId which allows us to get the amount from BancorX.

## Parameters:
- `_path`:             conversion path, see conversion path format in the BancorNetwork contract

- `_minReturn`:        if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_conversionId`:     pre-determined unique (if non zero) id which refers to this transaction 

- `_block`:            if the current block exceeded the given parameter - it is cancelled

- `_v`:                (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

- `_r`:                (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

- `_s`:                (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

# Function `fund(uint256 _amount)` {#BancorConverter-fund-uint256-}
buys the token with all connector tokens using the same percentage
i.e. if the caller increases the supply by 10%, it will cost an amount equal to
10% of each connector token balance
can only be called if conversions are enabled

## Parameters:
- `_amount`:  amount to increase the supply by (in the smart token)
# Function `liquidate(uint256 _amount)` {#BancorConverter-liquidate-uint256-}
sells the token for all connector tokens using the same percentage
i.e. if the holder sells 10% of the supply, they will receive 10% of each
connector token balance in return
note that the function can also be called if conversions are disabled

## Parameters:
- `_amount`:  amount to liquidate (in the smart token)
# Function `change(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256` {#BancorConverter-change-contract-IERC20Token-contract-IERC20Token-uint256-uint256-}
deprecated, backward compatibility

# Event `Conversion(address _fromToken, address _toToken, address _trader, uint256 _amount, uint256 _return, int256 _conversionFee)` {#BancorConverter-Conversion-address-address-address-uint256-uint256-int256-}
triggered when a conversion between two tokens occurs

## Parameters:
- `_fromToken`:       ERC20 token converted from

- `_toToken`:         ERC20 token converted to

- `_trader`:          wallet that initiated the trade

- `_amount`:          amount converted, in fromToken

- `_return`:          amount returned, minus conversion fee

- `_conversionFee`:   conversion fee
# Event `PriceDataUpdate(address _connectorToken, uint256 _tokenSupply, uint256 _connectorBalance, uint32 _connectorWeight)` {#BancorConverter-PriceDataUpdate-address-uint256-uint256-uint32-}
triggered after a conversion with new price data

## Parameters:
- `_connectorToken`:     connector token

- `_tokenSupply`:        smart token supply

- `_connectorBalance`:   connector balance

- `_connectorWeight`:    connector weight
# Event `ConversionFeeUpdate(uint32 _prevFee, uint32 _newFee)` {#BancorConverter-ConversionFeeUpdate-uint32-uint32-}
triggered when the conversion fee is updated

## Parameters:
- `_prevFee`:    previous fee percentage, represented in ppm

- `_newFee`:     new fee percentage, represented in ppm
# Event `ConversionsEnable(bool _conversionsEnabled)` {#BancorConverter-ConversionsEnable-bool-}
triggered when conversions are enabled/disabled

## Parameters:
- `_conversionsEnabled`: true if conversions are enabled, false if not
