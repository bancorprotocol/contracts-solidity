---
---



# Contract `BancorConverterRegistry`



#### Functions:
- `constructor()`
- `tokenCount()`
- `converterCount(address _token)`
- `converterAddress(address _token, uint32 _index)`
- `tokenAddress(address _converter)`
- `registerConverter(address _token, address _converter)`
- `unregisterConverter(address _token, uint32 _index)`

#### Events:
- `ConverterAddition(address _token, address _address)`
- `ConverterRemoval(address _token, address _address)`

---

#### Function `constructor()`
constructor
#### Function `tokenCount() → uint256`
returns the number of tokens in the registry

#### Function `converterCount(address _token) → uint256`
returns the number of converters associated with the given token
or 0 if the token isn&#x27;t registered

###### Parameters:
- `_token`:   token address

#### Function `converterAddress(address _token, uint32 _index) → address`
returns the converter address associated with the given token
or zero address if no such converter exists

###### Parameters:
- `_token`:   token address

- `_index`:   converter index

#### Function `tokenAddress(address _converter) → address`
returns the token address associated with the given converter
or zero address if no such converter exists

###### Parameters:
- `_converter`:   converter address

#### Function `registerConverter(address _token, address _converter)`
adds a new converter address for a given token to the registry
throws if the converter is already registered

###### Parameters:
- `_token`:       token address

- `_converter`:   converter address
#### Function `unregisterConverter(address _token, uint32 _index)`
removes an existing converter from the registry
note that the function doesn&#x27;t scale and might be needed to be called
multiple times when removing an older converter from a large converter list

###### Parameters:
- `_token`:   token address

- `_index`:   converter index

#### Event `ConverterAddition(address _token, address _address)`
No description
#### Event `ConverterRemoval(address _token, address _address)`
No description


# Contract `BancorNetwork`



#### Functions:
- `constructor(contract IContractRegistry _registry)`
- `setRegistry(contract IContractRegistry _registry)`
- `setSignerAddress(address _signerAddress)`
- `registerEtherToken(contract IEtherToken _token, bool _register)`
- `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`
- `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId)`
- `xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount)`
- `getReturnByPath(contract IERC20Token[] _path, uint256 _amount)`
- `claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`
- `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`
- `claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`
- `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s)`


---

#### Function `constructor(contract IContractRegistry _registry)`
constructor

###### Parameters:
- `_registry`:    address of a contract registry contract
#### Function `setRegistry(contract IContractRegistry _registry)`
No description
#### Function `setSignerAddress(address _signerAddress)`
No description
#### Function `registerEtherToken(contract IEtherToken _token, bool _register)`
allows the owner to register/unregister ether tokens

###### Parameters:
- `_token`:       ether token contract address

- `_register`:    true to register, false to unregister
#### Function `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256`
converts the token to any other token in the bancor network by following
a predefined conversion path and transfers the result tokens to a target account
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

#### Function `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
converts the token to any other token in the bancor network
by following a predefined conversion path and transfers the result
tokens to a target account.
this version of the function also allows the verified signer
to bypass the universal gas price limit.
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

- `_customVal`:   custom value that was signed for prioritized conversion

- `_block`:       if the current block exceeded the given parameter - it is cancelled

- `_v`:           (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

- `_r`:           (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

- `_s`:           (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

#### Function `xConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId) → uint256`
converts any other token to BNT in the bancor network
by following a predefined conversion path and transfers the resulting
tokens to BancorX.
note that the network should already have been given allowance of the source token (if not ETH)

###### Parameters:
- `_path`:             conversion path, see conversion path format above

- `_amount`:           amount to convert from (in the initial source token)

- `_minReturn`:        if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_toBlockchain`:     blockchain BNT will be issued on

- `_to`:               address/account on _toBlockchain to send the BNT to

- `_conversionId`:     pre-determined unique (if non zero) id which refers to this transaction 

#### Function `xConvertPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, bytes32 _toBlockchain, bytes32 _to, uint256 _conversionId, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
converts any other token to BNT in the bancor network
by following a predefined conversion path and transfers the resulting
tokens to BancorX.
this version of the function also allows the verified signer
to bypass the universal gas price limit.
note that the network should already have been given allowance of the source token (if not ETH)

###### Parameters:
- `_path`:            conversion path, see conversion path format above

- `_amount`:          amount to convert from (in the initial source token)

- `_minReturn`:       if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address/account on _toBlockchain to send the BNT to

- `_conversionId`:    pre-determined unique (if non zero) id which refers to this transaction 

- `_block`:           if the current block exceeded the given parameter - it is cancelled

- `_v`:               (signature[128:130]) associated with the signer address and helps to validate if the signature is legit

- `_r`:               (signature[0:64]) associated with the signer address and helps to validate if the signature is legit

- `_s`:               (signature[64:128]) associated with the signer address and helps to validate if the signature is legit

#### Function `getReturn(address _dest, address _fromToken, address _toToken, uint256 _amount) → uint256, uint256`
No description
#### Function `getReturnByPath(contract IERC20Token[] _path, uint256 _amount) → uint256, uint256`
returns the expected return amount for converting a specific amount by following
a given conversion path.
notice that there is no support for circular paths.

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

#### Function `claimAndConvertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256`
claims the caller&#x27;s tokens, converts them to any other token in the bancor network
by following a predefined conversion path and transfers the result tokens to a target account
note that allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

- `_for`:         account that will receive the conversion result

#### Function `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256`
converts the token to any other token in the bancor network by following
a predefined conversion path and transfers the result tokens back to the sender
note that the converter should already own the source tokens

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `claimAndConvert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256`
claims the caller&#x27;s tokens, converts them to any other token in the bancor network
by following a predefined conversion path and transfers the result tokens back to the sender
note that allowance must be set beforehand

###### Parameters:
- `_path`:        conversion path, see conversion path format above

- `_amount`:      amount to convert from (in the initial source token)

- `_minReturn`:   if the conversion results in an amount smaller than the minimum return - it is cancelled, must be nonzero

#### Function `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description
#### Function `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description



# Contract `ContractIds`





---




# Contract `FeatureIds`





---




# Contract `IBancorNetwork`



#### Functions:
- `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn)`
- `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for)`
- `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s)`
- `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s)`


---

#### Function `convert(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn) → uint256`
No description
#### Function `convertFor(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for) → uint256`
No description
#### Function `convertForPrioritized3(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _customVal, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description
#### Function `convertForPrioritized2(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description
#### Function `convertForPrioritized(contract IERC20Token[] _path, uint256 _amount, uint256 _minReturn, address _for, uint256 _block, uint256 _nonce, uint8 _v, bytes32 _r, bytes32 _s) → uint256`
No description



# Contract `BancorX`



#### Functions:
- `constructor(uint256 _maxLockLimit, uint256 _maxReleaseLimit, uint256 _minLimit, uint256 _limitIncPerBlock, uint256 _minRequiredReports, address _registry)`
- `setMaxLockLimit(uint256 _maxLockLimit)`
- `setMaxReleaseLimit(uint256 _maxReleaseLimit)`
- `setMinLimit(uint256 _minLimit)`
- `setLimitIncPerBlock(uint256 _limitIncPerBlock)`
- `setMinRequiredReports(uint256 _minRequiredReports)`
- `setReporter(address _reporter, bool _active)`
- `enableXTransfers(bool _enable)`
- `enableReporting(bool _enable)`
- `disableRegistryUpdate(bool _disable)`
- `setBNTConverterAddress()`
- `updateRegistry()`
- `restoreRegistry()`
- `upgrade(address[] _reporters)`
- `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount)`
- `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`
- `reportTx(bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)`
- `getXTransferAmount(uint256 _xTransferId, address _for)`
- `getCurrentLockLimit()`
- `getCurrentReleaseLimit()`

#### Events:
- `TokensLock(address _from, uint256 _amount)`
- `TokensRelease(address _to, uint256 _amount)`
- `XTransfer(address _from, bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`
- `TxReport(address _reporter, bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)`
- `XTransferComplete(address _to, uint256 _id)`

---

#### Function `constructor(uint256 _maxLockLimit, uint256 _maxReleaseLimit, uint256 _minLimit, uint256 _limitIncPerBlock, uint256 _minRequiredReports, address _registry)`
constructor

###### Parameters:
- `_maxLockLimit`:          maximum amount of BNT that can be locked in one transaction

- `_maxReleaseLimit`:       maximum amount of BNT that can be released in one transaction

- `_minLimit`:              minimum amount of BNT that can be transferred in one transaction

- `_limitIncPerBlock`:      how much the limit increases per block

- `_minRequiredReports`:    minimum number of reporters to report transaction before tokens can be released

- `_registry`:              address of contract registry
#### Function `setMaxLockLimit(uint256 _maxLockLimit)`
setter

###### Parameters:
- `_maxLockLimit`:    new maxLockLimit
#### Function `setMaxReleaseLimit(uint256 _maxReleaseLimit)`
setter

###### Parameters:
- `_maxReleaseLimit`:    new maxReleaseLimit
#### Function `setMinLimit(uint256 _minLimit)`
setter

###### Parameters:
- `_minLimit`:    new minLimit
#### Function `setLimitIncPerBlock(uint256 _limitIncPerBlock)`
setter

###### Parameters:
- `_limitIncPerBlock`:    new limitIncPerBlock
#### Function `setMinRequiredReports(uint256 _minRequiredReports)`
setter

###### Parameters:
- `_minRequiredReports`:    new minRequiredReports
#### Function `setReporter(address _reporter, bool _active)`
allows the owner to set/remove reporters

###### Parameters:
- `_reporter`:    reporter whos status is to be set

- `_active`:      true if the reporter is approved, false otherwise
#### Function `enableXTransfers(bool _enable)`
allows the owner enable/disable the xTransfer method

###### Parameters:
- `_enable`:     true to enable, false to disable
#### Function `enableReporting(bool _enable)`
allows the owner enable/disable the reportTransaction method

###### Parameters:
- `_enable`:     true to enable, false to disable
#### Function `disableRegistryUpdate(bool _disable)`
disables the registry update functionality
this is a safety mechanism in case of a emergency
can only be called by the manager or owner

###### Parameters:
- `_disable`:    true to disable registry updates, false to re-enable them
#### Function `setBNTConverterAddress()`
allows the owner to set the BNT converters address to wherever the
contract registry currently points to
#### Function `updateRegistry()`
sets the contract registry to whichever address the current registry is pointing to
#### Function `restoreRegistry()`
security mechanism allowing the converter owner to revert to the previous registry,
to be used in emergency scenario
#### Function `upgrade(address[] _reporters)`
upgrades the contract to the latest version
can only be called by the owner
note that the owner needs to call acceptOwnership on the new contract after the upgrade

###### Parameters:
- `_reporters`:    new list of reporters
#### Function `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount)`
claims BNT from msg.sender to be converted to BNT on another blockchain

###### Parameters:
- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address to send the BNT to

- `_amount`:          the amount to transfer
#### Function `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`
claims BNT from msg.sender to be converted to BNT on another blockchain

###### Parameters:
- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address to send the BNT to

- `_amount`:          the amount to transfer

- `_id`:              pre-determined unique (if non zero) id which refers to this transaction 
#### Function `reportTx(bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)`
allows reporter to report transaction which occured on another blockchain

###### Parameters:
- `_fromBlockchain`:  blockchain BNT was destroyed in

- `_txId`:            transactionId of transaction thats being reported

- `_to`:              address to receive BNT

- `_amount`:          amount of BNT destroyed on another blockchain

- `_xTransferId`:     unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been mined)
#### Function `getXTransferAmount(uint256 _xTransferId, address _for) → uint256`
gets x transfer amount by xTransferId (not txId)

###### Parameters:
- `_xTransferId`:    unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been broadcasted)

- `_for`:            address corresponding to xTransferId

#### Function `getCurrentLockLimit() → uint256`
method for calculating current lock limit

#### Function `getCurrentReleaseLimit() → uint256`
method for calculating current release limit


#### Event `TokensLock(address _from, uint256 _amount)`
No description
#### Event `TokensRelease(address _to, uint256 _amount)`
No description
#### Event `XTransfer(address _from, bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`
No description
#### Event `TxReport(address _reporter, bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)`
No description
#### Event `XTransferComplete(address _to, uint256 _id)`
No description


# Contract `XTransferRerouter`



#### Functions:
- `constructor(bool _reroutingEnabled)`
- `enableRerouting(bool _enable)`
- `rerouteTx(uint256 _txId, bytes32 _blockchain, bytes32 _to)`

#### Events:
- `TxReroute(uint256 _txId, bytes32 _toBlockchain, bytes32 _to)`

---

#### Function `constructor(bool _reroutingEnabled)`
constructor

###### Parameters:
- `_reroutingEnabled`:    intializes transactions routing to enabled/disabled   
#### Function `enableRerouting(bool _enable)`
allows the owner to disable/enable rerouting

###### Parameters:
- `_enable`:     true to enable, false to disable
#### Function `rerouteTx(uint256 _txId, bytes32 _blockchain, bytes32 _to)`
   allows a user to reroute a transaction to a new blockchain/target address

###### Parameters:
- `_txId`:        the original transaction id

- `_blockchain`:  the new blockchain name

- `_to`:          the new target address/account

#### Event `TxReroute(uint256 _txId, bytes32 _toBlockchain, bytes32 _to)`
No description


# Contract `IBancorX`



#### Functions:
- `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`
- `getXTransferAmount(uint256 _xTransferId, address _for)`


---

#### Function `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`
No description
#### Function `getXTransferAmount(uint256 _xTransferId, address _for) → uint256`
No description



# Contract `IBancorXUpgrader`



#### Functions:
- `upgrade(uint16 _version, address[] _reporters)`


---

#### Function `upgrade(uint16 _version, address[] _reporters)`
No description



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


# Contract `IBancorConverterExtended`



#### Functions:
- `token()`
- `maxConversionFee()`
- `conversionFee()`
- `connectorTokenCount()`
- `reserveTokenCount()`
- `connectorTokens(uint256 _index)`
- `reserveTokens(uint256 _index)`
- `setConversionWhitelist(contract IWhitelist _whitelist)`
- `transferTokenOwnership(address _newOwner)`
- `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
- `acceptTokenOwnership()`
- `transferManagement(address _newManager)`
- `acceptManagement()`
- `setConversionFee(uint32 _conversionFee)`
- `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`
- `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`
- `getConnectorBalance(contract IERC20Token _connectorToken)`
- `getReserveBalance(contract IERC20Token _reserveToken)`
- `reserves(address _address)`


---

#### Function `token() → contract ISmartToken`
No description
#### Function `maxConversionFee() → uint32`
No description
#### Function `conversionFee() → uint32`
No description
#### Function `connectorTokenCount() → uint16`
No description
#### Function `reserveTokenCount() → uint16`
No description
#### Function `connectorTokens(uint256 _index) → contract IERC20Token`
No description
#### Function `reserveTokens(uint256 _index) → contract IERC20Token`
No description
#### Function `setConversionWhitelist(contract IWhitelist _whitelist)`
No description
#### Function `transferTokenOwnership(address _newOwner)`
No description
#### Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
No description
#### Function `acceptTokenOwnership()`
No description
#### Function `transferManagement(address _newManager)`
No description
#### Function `acceptManagement()`
No description
#### Function `setConversionFee(uint32 _conversionFee)`
No description
#### Function `addConnector(contract IERC20Token _token, uint32 _weight, bool _enableVirtualBalance)`
No description
#### Function `updateConnector(contract IERC20Token _connectorToken, uint32 _weight, bool _enableVirtualBalance, uint256 _virtualBalance)`
No description
#### Function `getConnectorBalance(contract IERC20Token _connectorToken) → uint256`
No description
#### Function `getReserveBalance(contract IERC20Token _reserveToken) → uint256`
No description
#### Function `reserves(address _address) → uint256 virtualBalance, uint32 weight, bool isVirtualBalanceEnabled, bool isSaleEnabled, bool isSet`
No description



# Contract `BancorConverterUpgrader`



#### Functions:
- `constructor(contract IContractRegistry _registry)`
- `setRegistry(contract IContractRegistry _registry)`
- `upgrade(bytes32 _version)`
- `upgrade(uint16 _version)`
- `upgradeOld(contract IBancorConverter _converter, bytes32 _version)`

#### Events:
- `ConverterOwned(address _converter, address _owner)`
- `ConverterUpgrade(address _oldConverter, address _newConverter)`

---

#### Function `constructor(contract IContractRegistry _registry)`
constructor
#### Function `setRegistry(contract IContractRegistry _registry)`
No description
#### Function `upgrade(bytes32 _version)`
upgrades an old converter to the latest version
will throw if ownership wasn&#x27;t transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.
can only be called by a converter

###### Parameters:
- `_version`: old converter version
#### Function `upgrade(uint16 _version)`
upgrades an old converter to the latest version
will throw if ownership wasn&#x27;t transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.
can only be called by a converter

###### Parameters:
- `_version`: old converter version
#### Function `upgradeOld(contract IBancorConverter _converter, bytes32 _version)`
upgrades an old converter to the latest version
will throw if ownership wasn&#x27;t transferred to the upgrader before calling this function.
ownership of the new converter will be transferred back to the original owner.
fires the ConverterUpgrade event upon success.

###### Parameters:
- `_converter`:   old converter contract address

- `_version`:     old converter version

#### Event `ConverterOwned(address _converter, address _owner)`
No description
#### Event `ConverterUpgrade(address _oldConverter, address _newConverter)`
No description


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



# Contract `BancorGasPriceLimit`



#### Functions:
- `constructor(uint256 _gasPrice)`
- `setGasPrice(uint256 _gasPrice)`
- `validateGasPrice(uint256 _gasPrice)`


---

#### Function `constructor(uint256 _gasPrice)`
constructor

###### Parameters:
- `_gasPrice`:    gas price limit
#### Function `setGasPrice(uint256 _gasPrice)`
No description
#### Function `validateGasPrice(uint256 _gasPrice)`
No description



# Contract `IBancorConverter`



#### Functions:
- `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount)`
- `convert(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`
- `conversionWhitelist()`
- `conversionFee()`
- `connectors(address _address)`
- `getConnectorBalance(contract IERC20Token _connectorToken)`
- `claimTokens(address _from, uint256 _amount)`
- `change(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn)`


---

#### Function `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount) → uint256, uint256`
No description
#### Function `convert(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256`
No description
#### Function `conversionWhitelist() → contract IWhitelist`
No description
#### Function `conversionFee() → uint32`
No description
#### Function `connectors(address _address) → uint256, uint32, bool, bool, bool`
No description
#### Function `getConnectorBalance(contract IERC20Token _connectorToken) → uint256`
No description
#### Function `claimTokens(address _from, uint256 _amount)`
No description
#### Function `change(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount, uint256 _minReturn) → uint256`
No description



# Contract `IBancorConverterFactory`



#### Functions:
- `createConverter(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight)`


---

#### Function `createConverter(contract ISmartToken _token, contract IContractRegistry _registry, uint32 _maxConversionFee, contract IERC20Token _connectorToken, uint32 _connectorWeight) → address`
No description



# Contract `IBancorConverterUpgrader`



#### Functions:
- `upgrade(bytes32 _version)`
- `upgrade(uint16 _version)`


---

#### Function `upgrade(bytes32 _version)`
No description
#### Function `upgrade(uint16 _version)`
No description



# Contract `IBancorFormula`



#### Functions:
- `calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount)`
- `calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount)`
- `calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount)`


---

#### Function `calculatePurchaseReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _depositAmount) → uint256`
No description
#### Function `calculateSaleReturn(uint256 _supply, uint256 _connectorBalance, uint32 _connectorWeight, uint256 _sellAmount) → uint256`
No description
#### Function `calculateCrossConnectorReturn(uint256 _fromConnectorBalance, uint32 _fromConnectorWeight, uint256 _toConnectorBalance, uint32 _toConnectorWeight, uint256 _amount) → uint256`
No description



# Contract `IBancorGasPriceLimit`



#### Functions:
- `gasPrice()`
- `validateGasPrice(uint256)`


---

#### Function `gasPrice() → uint256`
No description
#### Function `validateGasPrice(uint256)`
No description



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


# Contract `Migrations`



#### Functions:
- `constructor()`
- `setCompleted(uint256 completed)`
- `upgrade(address new_address)`


---

#### Function `constructor()`
No description
#### Function `setCompleted(uint256 completed)`
No description
#### Function `upgrade(address new_address)`
No description



# Contract `NonStandardERC20Token`



#### Functions:
- `constructor(string _name, string _symbol, uint8 _decimals)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`
- `approve(address _spender, uint256 _value)`

#### Events:
- `Transfer(address _from, address _to, uint256 _value)`
- `Approval(address _owner, address _spender, uint256 _value)`

---

#### Function `constructor(string _name, string _symbol, uint8 _decimals)`
constructor

###### Parameters:
- `_name`:        token name

- `_symbol`:      token symbol

- `_decimals`:    decimal points, for display purposes
#### Function `transfer(address _to, uint256 _value)`
send coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_to`:      target address

- `_value`:   transfer amount

#### Function `transferFrom(address _from, address _to, uint256 _value)`
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount

#### Function `approve(address _spender, uint256 _value)`
allow another account/contract to spend some tokens on your behalf
throws on any error rather then return a false flag to minimize user errors
also, to minimize the risk of the approve/transferFrom attack vector
(see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/), approve has to be called twice
in 2 separate transactions - once to change the allowance to 0 and secondly to change it to the new allowance value

###### Parameters:
- `_spender`: approved address

- `_value`:   allowance amount


#### Event `Transfer(address _from, address _to, uint256 _value)`
No description
#### Event `Approval(address _owner, address _spender, uint256 _value)`
No description


# Contract `NonStandardSmartToken`



#### Functions:
- `constructor(string _name, string _symbol, uint8 _decimals)`
- `disableTransfers(bool _disable)`
- `issue(address _to, uint256 _amount)`
- `destroy(address _from, uint256 _amount)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`

#### Events:
- `NewSmartToken(address _token)`
- `Issuance(uint256 _amount)`
- `Destruction(uint256 _amount)`

---

#### Function `constructor(string _name, string _symbol, uint8 _decimals)`
constructor

###### Parameters:
- `_name`:       token name

- `_symbol`:     token short symbol, minimum 1 character

- `_decimals`:   for display purposes only
#### Function `disableTransfers(bool _disable)`
disables/enables transfers
can only be called by the contract owner

###### Parameters:
- `_disable`:    true to disable transfers, false to enable them
#### Function `issue(address _to, uint256 _amount)`
increases the token supply and sends the new tokens to an account
can only be called by the contract owner

###### Parameters:
- `_to`:         account to receive the new amount

- `_amount`:     amount to increase the supply by
#### Function `destroy(address _from, uint256 _amount)`
removes tokens from an account and decreases the token supply
can be called by the contract owner to destroy tokens from any account or by any holder to destroy tokens from his/her own account

###### Parameters:
- `_from`:       account to remove the amount from

- `_amount`:     amount to decrease the supply by
#### Function `transfer(address _to, uint256 _value)`
send coins
throws on any error rather then return a false flag to minimize user errors
in addition to the standard checks, the function throws if transfers are disabled

###### Parameters:
- `_to`:      target address

- `_value`:   transfer amount
#### Function `transferFrom(address _from, address _to, uint256 _value)`
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors
in addition to the standard checks, the function throws if transfers are disabled

###### Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount

#### Event `NewSmartToken(address _token)`
No description
#### Event `Issuance(uint256 _amount)`
No description
#### Event `Destruction(uint256 _amount)`
No description


# Contract `TestBancorFormula`



#### Functions:
- `constructor()`
- `powerTest(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD)`
- `generalLogTest(uint256 x)`
- `floorLog2Test(uint256 _n)`
- `findPositionInMaxExpArrayTest(uint256 _x)`
- `generalExpTest(uint256 _x, uint8 _precision)`
- `optimalLogTest(uint256 x)`
- `optimalExpTest(uint256 x)`


---

#### Function `constructor()`
No description
#### Function `powerTest(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) → uint256, uint8`
No description
#### Function `generalLogTest(uint256 x) → uint256`
No description
#### Function `floorLog2Test(uint256 _n) → uint8`
No description
#### Function `findPositionInMaxExpArrayTest(uint256 _x) → uint8`
No description
#### Function `generalExpTest(uint256 _x, uint8 _precision) → uint256`
No description
#### Function `optimalLogTest(uint256 x) → uint256`
No description
#### Function `optimalExpTest(uint256 x) → uint256`
No description



# Contract `OldBancorConverter`



#### Functions:
- `constructor(uint256 _amount)`
- `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount)`


---

#### Function `constructor(uint256 _amount)`
No description
#### Function `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount) → uint256`
No description



# Contract `NewBancorConverter`



#### Functions:
- `constructor(uint256 _amount, uint256 _fee)`
- `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount)`


---

#### Function `constructor(uint256 _amount, uint256 _fee)`
No description
#### Function `getReturn(contract IERC20Token _fromToken, contract IERC20Token _toToken, uint256 _amount) → uint256, uint256`
No description



# Contract `TestBancorNetwork`



#### Functions:
- `constructor(uint256 _amount, uint256 _fee)`
- `getReturnOld()`
- `getReturnNew()`


---

#### Function `constructor(uint256 _amount, uint256 _fee)`
No description
#### Function `getReturnOld() → uint256, uint256`
No description
#### Function `getReturnNew() → uint256, uint256`
No description



# Contract `TestCrowdsaleController`



#### Functions:
- `constructor(contract ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash, uint256 _startTimeOverride)`


---

#### Function `constructor(contract ISmartToken _token, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash, uint256 _startTimeOverride)`
No description



# Contract `TestERC20Token`



#### Functions:
- `constructor(string _name, string _symbol, uint256 _supply)`


---

#### Function `constructor(string _name, string _symbol, uint256 _supply)`
No description



# Contract `TestFeatures`



#### Functions:
- `constructor(contract IContractFeatures _features)`
- `enableFeatures(uint256 _features, bool _enable)`


---

#### Function `constructor(contract IContractFeatures _features)`
No description
#### Function `enableFeatures(uint256 _features, bool _enable)`
No description



# Contract `TestNonStandardERC20Token`



#### Functions:
- `constructor(string _name, string _symbol, uint256 _supply)`


---

#### Function `constructor(string _name, string _symbol, uint256 _supply)`
No description



# Contract `TestSafeMath`



#### Functions:
- `constructor()`
- `testSafeAdd(uint256 _x, uint256 _y)`
- `testSafeSub(uint256 _x, uint256 _y)`
- `testSafeMul(uint256 _x, uint256 _y)`


---

#### Function `constructor()`
No description
#### Function `testSafeAdd(uint256 _x, uint256 _y) → uint256`
No description
#### Function `testSafeSub(uint256 _x, uint256 _y) → uint256`
No description
#### Function `testSafeMul(uint256 _x, uint256 _y) → uint256`
No description



# Contract `INonStandardSmartToken`



#### Functions:
- `disableTransfers(bool _disable)`
- `issue(address _to, uint256 _amount)`
- `destroy(address _from, uint256 _amount)`


---

#### Function `disableTransfers(bool _disable)`
No description
#### Function `issue(address _to, uint256 _amount)`
No description
#### Function `destroy(address _from, uint256 _amount)`
No description



# Contract `BancorPriceFloor`



#### Functions:
- `constructor(contract ISmartToken _token)`
- `sell()`
- `withdraw(uint256 _amount)`
- `fallback()`


---

#### Function `constructor(contract ISmartToken _token)`
constructor

###### Parameters:
- `_token`:   smart token the contract allows selling
#### Function `sell() → uint256 amount`
sells the smart token for ETH
note that the function will sell the full allowance amount

#### Function `withdraw(uint256 _amount)`
withdraws ETH from the contract

###### Parameters:
- `_amount`:  amount of ETH to withdraw
#### Function `fallback()`
deposits ETH in the contract



# Contract `ERC20Token`



#### Functions:
- `constructor(string _name, string _symbol, uint8 _decimals)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`
- `approve(address _spender, uint256 _value)`

#### Events:
- `Transfer(address _from, address _to, uint256 _value)`
- `Approval(address _owner, address _spender, uint256 _value)`

---

#### Function `constructor(string _name, string _symbol, uint8 _decimals)`
constructor

###### Parameters:
- `_name`:        token name

- `_symbol`:      token symbol

- `_decimals`:    decimal points, for display purposes
#### Function `transfer(address _to, uint256 _value) → bool success`
send coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_to`:      target address

- `_value`:   transfer amount

#### Function `transferFrom(address _from, address _to, uint256 _value) → bool success`
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount

#### Function `approve(address _spender, uint256 _value) → bool success`
allow another account/contract to spend some tokens on your behalf
throws on any error rather then return a false flag to minimize user errors
also, to minimize the risk of the approve/transferFrom attack vector
(see https://docs.google.com/document/d/1YLPtQxZu1UAvO9cZ1O2RPXBbT0mooh4DYKjA_jp-RLM/), approve has to be called twice
in 2 separate transactions - once to change the allowance to 0 and secondly to change it to the new allowance value

###### Parameters:
- `_spender`: approved address

- `_value`:   allowance amount


#### Event `Transfer(address _from, address _to, uint256 _value)`
No description
#### Event `Approval(address _owner, address _spender, uint256 _value)`
No description


# Contract `EtherToken`



#### Functions:
- `constructor()`
- `deposit()`
- `withdraw(uint256 _amount)`
- `withdrawTo(address _to, uint256 _amount)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`
- `fallback()`

#### Events:
- `Issuance(uint256 _amount)`
- `Destruction(uint256 _amount)`

---

#### Function `constructor()`
constructor
#### Function `deposit()`
deposit ether in the account
#### Function `withdraw(uint256 _amount)`
withdraw ether from the account

###### Parameters:
- `_amount`:  amount of ether to withdraw
#### Function `withdrawTo(address _to, uint256 _amount)`
withdraw ether from the account to a target account

###### Parameters:
- `_to`:      account to receive the ether

- `_amount`:  amount of ether to withdraw
#### Function `transfer(address _to, uint256 _value) → bool success`
send coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_to`:      target address

- `_value`:   transfer amount

#### Function `transferFrom(address _from, address _to, uint256 _value) → bool success`
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors

###### Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount

#### Function `fallback()`
deposit ether in the account

#### Event `Issuance(uint256 _amount)`
No description
#### Event `Destruction(uint256 _amount)`
No description


# Contract `SmartToken`



#### Functions:
- `constructor(string _name, string _symbol, uint8 _decimals)`
- `disableTransfers(bool _disable)`
- `issue(address _to, uint256 _amount)`
- `destroy(address _from, uint256 _amount)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`

#### Events:
- `NewSmartToken(address _token)`
- `Issuance(uint256 _amount)`
- `Destruction(uint256 _amount)`

---

#### Function `constructor(string _name, string _symbol, uint8 _decimals)`
constructor

###### Parameters:
- `_name`:       token name

- `_symbol`:     token short symbol, minimum 1 character

- `_decimals`:   for display purposes only
#### Function `disableTransfers(bool _disable)`
disables/enables transfers
can only be called by the contract owner

###### Parameters:
- `_disable`:    true to disable transfers, false to enable them
#### Function `issue(address _to, uint256 _amount)`
increases the token supply and sends the new tokens to an account
can only be called by the contract owner

###### Parameters:
- `_to`:         account to receive the new amount

- `_amount`:     amount to increase the supply by
#### Function `destroy(address _from, uint256 _amount)`
removes tokens from an account and decreases the token supply
can be called by the contract owner to destroy tokens from any account or by any holder to destroy tokens from his/her own account

###### Parameters:
- `_from`:       account to remove the amount from

- `_amount`:     amount to decrease the supply by
#### Function `transfer(address _to, uint256 _value) → bool success`
send coins
throws on any error rather then return a false flag to minimize user errors
in addition to the standard checks, the function throws if transfers are disabled

###### Parameters:
- `_to`:      target address

- `_value`:   transfer amount

#### Function `transferFrom(address _from, address _to, uint256 _value) → bool success`
an account/contract attempts to get the coins
throws on any error rather then return a false flag to minimize user errors
in addition to the standard checks, the function throws if transfers are disabled

###### Parameters:
- `_from`:    source address

- `_to`:      target address

- `_value`:   transfer amount


#### Event `NewSmartToken(address _token)`
No description
#### Event `Issuance(uint256 _amount)`
No description
#### Event `Destruction(uint256 _amount)`
No description


# Contract `SmartTokenController`



#### Functions:
- `constructor(contract ISmartToken _token)`
- `transferTokenOwnership(address _newOwner)`
- `acceptTokenOwnership()`
- `disableTokenTransfers(bool _disable)`
- `withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)`


---

#### Function `constructor(contract ISmartToken _token)`
constructor
#### Function `transferTokenOwnership(address _newOwner)`
allows transferring the token ownership
the new owner needs to accept the transfer
can only be called by the contract owner

###### Parameters:
- `_newOwner`:    new token owner
#### Function `acceptTokenOwnership()`
used by a new owner to accept a token ownership transfer
can only be called by the contract owner
#### Function `disableTokenTransfers(bool _disable)`
disables/enables token transfers
can only be called by the contract owner

###### Parameters:
- `_disable`:    true to disable transfers, false to enable them
#### Function `withdrawFromToken(contract IERC20Token _token, address _to, uint256 _amount)`
withdraws tokens held by the controller and sends them to an account
can only be called by the owner

###### Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw



# Contract `IERC20Token`



#### Functions:
- `name()`
- `symbol()`
- `decimals()`
- `totalSupply()`
- `balanceOf(address _owner)`
- `allowance(address _owner, address _spender)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`
- `approve(address _spender, uint256 _value)`


---

#### Function `name() → string`
No description
#### Function `symbol() → string`
No description
#### Function `decimals() → uint8`
No description
#### Function `totalSupply() → uint256`
No description
#### Function `balanceOf(address _owner) → uint256`
No description
#### Function `allowance(address _owner, address _spender) → uint256`
No description
#### Function `transfer(address _to, uint256 _value) → bool success`
No description
#### Function `transferFrom(address _from, address _to, uint256 _value) → bool success`
No description
#### Function `approve(address _spender, uint256 _value) → bool success`
No description



# Contract `IEtherToken`



#### Functions:
- `deposit()`
- `withdraw(uint256 _amount)`
- `withdrawTo(address _to, uint256 _amount)`


---

#### Function `deposit()`
No description
#### Function `withdraw(uint256 _amount)`
No description
#### Function `withdrawTo(address _to, uint256 _amount)`
No description



# Contract `INonStandardERC20`



#### Functions:
- `name()`
- `symbol()`
- `decimals()`
- `totalSupply()`
- `balanceOf(address _owner)`
- `allowance(address _owner, address _spender)`
- `transfer(address _to, uint256 _value)`
- `transferFrom(address _from, address _to, uint256 _value)`
- `approve(address _spender, uint256 _value)`


---

#### Function `name() → string`
No description
#### Function `symbol() → string`
No description
#### Function `decimals() → uint8`
No description
#### Function `totalSupply() → uint256`
No description
#### Function `balanceOf(address _owner) → uint256`
No description
#### Function `allowance(address _owner, address _spender) → uint256`
No description
#### Function `transfer(address _to, uint256 _value)`
No description
#### Function `transferFrom(address _from, address _to, uint256 _value)`
No description
#### Function `approve(address _spender, uint256 _value)`
No description



# Contract `ISmartToken`



#### Functions:
- `disableTransfers(bool _disable)`
- `issue(address _to, uint256 _amount)`
- `destroy(address _from, uint256 _amount)`


---

#### Function `disableTransfers(bool _disable)`
No description
#### Function `issue(address _to, uint256 _amount)`
No description
#### Function `destroy(address _from, uint256 _amount)`
No description



# Contract `ContractFeatures`



#### Functions:
- `constructor()`
- `isSupported(address _contract, uint256 _features)`
- `enableFeatures(uint256 _features, bool _enable)`

#### Events:
- `FeaturesAddition(address _address, uint256 _features)`
- `FeaturesRemoval(address _address, uint256 _features)`

---

#### Function `constructor()`
constructor
#### Function `isSupported(address _contract, uint256 _features) → bool`
returns true if a given contract supports the given feature(s), false if not

###### Parameters:
- `_contract`:    contract address to check support for

- `_features`:    feature(s) to check for

#### Function `enableFeatures(uint256 _features, bool _enable)`
allows a contract to enable/disable certain feature(s)

###### Parameters:
- `_features`:    feature(s) to enable/disable

- `_enable`:      true to enable the feature(s), false to disabled them

#### Event `FeaturesAddition(address _address, uint256 _features)`
No description
#### Event `FeaturesRemoval(address _address, uint256 _features)`
No description


# Contract `ContractRegistry`



#### Functions:
- `constructor()`
- `itemCount()`
- `addressOf(bytes32 _contractName)`
- `registerAddress(bytes32 _contractName, address _contractAddress)`
- `unregisterAddress(bytes32 _contractName)`
- `getAddress(bytes32 _contractName)`

#### Events:
- `AddressUpdate(bytes32 _contractName, address _contractAddress)`

---

#### Function `constructor()`
constructor
#### Function `itemCount() → uint256`
returns the number of items in the registry

#### Function `addressOf(bytes32 _contractName) → address`
returns the address associated with the given contract name

###### Parameters:
- `_contractName`:    contract name

#### Function `registerAddress(bytes32 _contractName, address _contractAddress)`
registers a new address for the contract name in the registry

###### Parameters:
- `_contractName`:     contract name

- `_contractAddress`:  contract address
#### Function `unregisterAddress(bytes32 _contractName)`
removes an existing contract address from the registry

###### Parameters:
- `_contractName`: contract name
#### Function `getAddress(bytes32 _contractName) → address`
No description

#### Event `AddressUpdate(bytes32 _contractName, address _contractAddress)`
No description


# Contract `Managed`



#### Functions:
- `constructor()`
- `transferManagement(address _newManager)`
- `acceptManagement()`

#### Events:
- `ManagerUpdate(address _prevManager, address _newManager)`

---

#### Function `constructor()`
constructor
#### Function `transferManagement(address _newManager)`
allows transferring the contract management
the new manager still needs to accept the transfer
can only be called by the contract manager

###### Parameters:
- `_newManager`:    new contract manager
#### Function `acceptManagement()`
used by a new manager to accept a management transfer

#### Event `ManagerUpdate(address _prevManager, address _newManager)`
No description


# Contract `NonStandardTokenRegistry`



#### Functions:
- `constructor()`
- `setAddress(address token, bool register)`


---

#### Function `constructor()`
constructor
#### Function `setAddress(address token, bool register)`
No description



# Contract `Owned`



#### Functions:
- `constructor()`
- `transferOwnership(address _newOwner)`
- `acceptOwnership()`

#### Events:
- `OwnerUpdate(address _prevOwner, address _newOwner)`

---

#### Function `constructor()`
constructor
#### Function `transferOwnership(address _newOwner)`
allows transferring the contract ownership
the new owner still needs to accept the transfer
can only be called by the contract owner

###### Parameters:
- `_newOwner`:    new contract owner
#### Function `acceptOwnership()`
used by a new owner to accept an ownership transfer

#### Event `OwnerUpdate(address _prevOwner, address _newOwner)`
No description


# Contract `SafeMath`



#### Functions:
- `add(uint256 _x, uint256 _y)`
- `sub(uint256 _x, uint256 _y)`
- `mul(uint256 _x, uint256 _y)`
- `div(uint256 _x, uint256 _y)`


---

#### Function `add(uint256 _x, uint256 _y) → uint256`
returns the sum of _x and _y, reverts if the calculation overflows

###### Parameters:
- `_x`:   value 1

- `_y`:   value 2

#### Function `sub(uint256 _x, uint256 _y) → uint256`
returns the difference of _x minus _y, reverts if the calculation underflows

###### Parameters:
- `_x`:   minuend

- `_y`:   subtrahend

#### Function `mul(uint256 _x, uint256 _y) → uint256`
returns the product of multiplying _x by _y, reverts if the calculation overflows

###### Parameters:
- `_x`:   factor 1

- `_y`:   factor 2

#### Function `div(uint256 _x, uint256 _y) → uint256`
Integer division of two numbers truncating the quotient, reverts on division by zero.

###### Parameters:
- `_x`:   dividend

- `_y`:   divisor




# Contract `TokenHolder`



#### Functions:
- `constructor()`
- `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`


---

#### Function `constructor()`
constructor
#### Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
withdraws tokens held by the contract and sends them to an account
can only be called by the owner

###### Parameters:
- `_token`:   ERC20 token contract address

- `_to`:      account to receive the new amount

- `_amount`:  amount to withdraw



# Contract `Utils`



#### Functions:
- `constructor()`


---

#### Function `constructor()`
No description



# Contract `Whitelist`



#### Functions:
- `constructor()`
- `isWhitelisted(address _address)`
- `addAddress(address _address)`
- `addAddresses(address[] _addresses)`
- `removeAddress(address _address)`
- `removeAddresses(address[] _addresses)`

#### Events:
- `AddressAddition(address _address)`
- `AddressRemoval(address _address)`

---

#### Function `constructor()`
constructor
#### Function `isWhitelisted(address _address) → bool`
returns true if a given address is whitelisted, false if not

###### Parameters:
- `_address`: address to check

#### Function `addAddress(address _address)`
adds a given address to the whitelist

###### Parameters:
- `_address`: address to add
#### Function `addAddresses(address[] _addresses)`
adds a list of addresses to the whitelist

###### Parameters:
- `_addresses`: addresses to add
#### Function `removeAddress(address _address)`
removes a given address from the whitelist

###### Parameters:
- `_address`: address to remove
#### Function `removeAddresses(address[] _addresses)`
removes a list of addresses from the whitelist

###### Parameters:
- `_addresses`: addresses to remove

#### Event `AddressAddition(address _address)`
No description
#### Event `AddressRemoval(address _address)`
No description


# Contract `IAddressList`





---




# Contract `IContractFeatures`



#### Functions:
- `isSupported(address _contract, uint256 _features)`
- `enableFeatures(uint256 _features, bool _enable)`


---

#### Function `isSupported(address _contract, uint256 _features) → bool`
No description
#### Function `enableFeatures(uint256 _features, bool _enable)`
No description



# Contract `IContractRegistry`



#### Functions:
- `addressOf(bytes32 _contractName)`
- `getAddress(bytes32 _contractName)`


---

#### Function `addressOf(bytes32 _contractName) → address`
No description
#### Function `getAddress(bytes32 _contractName) → address`
No description



# Contract `IOwned`



#### Functions:
- `owner()`
- `transferOwnership(address _newOwner)`
- `acceptOwnership()`


---

#### Function `owner() → address`
No description
#### Function `transferOwnership(address _newOwner)`
No description
#### Function `acceptOwnership()`
No description



# Contract `ITokenHolder`



#### Functions:
- `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`


---

#### Function `withdrawTokens(contract IERC20Token _token, address _to, uint256 _amount)`
No description



# Contract `IWhitelist`



#### Functions:
- `isWhitelisted(address _address)`


---

#### Function `isWhitelisted(address _address) → bool`
No description


