### 0.5.18 (2020-03-05)
BancorConverterRegistry
* Reverted the signature change of `getLiquidityPoolByReserveConfig` (logic is still intact)


### 0.5.16 (2020-03-05)
BancorConverter
* Removed `Manager` permission/code
* `totalReserveRatio` is now public

BancorConverterRegistry
* Fixed a bug with identifying converters with similar configurations


### 0.5.15 (2020-01-23)
EtherToken
* Name & symbol are now constructor args


### 0.5.14 (2020-01-21)
BancorNetwork
* Removed signature/gas price limit logic

BancorConverter
* Removed the `converterType` variable

BancorConverterUpgrader
* Removed legacy converter (0.4) support

BancorFormula
* Increased liquidation cost precision

EtherToken
* Added `depositTo` function for direct depositing to another account for gas optimization


### 0.5.13 (2020-01-09)
BancorNetwork
* Added a new Conversion event that gets emitted for any conversion in the network

BancorConverter
* Owners cannot disable conversions anymore
* Owners cannot disable conversions from specific reserves anymore
* Removed the virtual balance mechanism


### 0.5.12 (2019-12-19)
General
* Better handling for non standard ERC20 tokens's transfer function (removed NonStandardTokenRegistry contract, gas optimization)

BancorConverterRegistry
* Fixed an issue that allowed adding duplicate pools to the registry in certain situations


### 0.5.11 (2019-12-17)
General
* Added the BancorNetworkPathFinder contract, now compatible with the new converter registry contract

BancorConverter
* Added a dedicated getReserveRatio function

BancorConverterRegistry
* Now enforces only a single liquidity pool for each reserve configuration
* Disabled converters are now considered invalid (can be removed by anyone)
* Added a utility function that returns a list of converters for a given list of smart tokens


### 0.5.8-10 (2019-12-12)
General
* Minor cleanups


### 0.5.7 (2019-12-12)
General:
* Added ContractRegistryClient contract for common contract registry behavior and cleaner access, and updated all registry clients

BancorConverterRegistry:
* Full redesign - it now allows iterating over different primitives in the network and does not
require re-adding converters after a converter upgrade

BancorConverter:
* Added support for fund/liquidate in non 50%/50% reserves converters

BancorFormula:
* Added calculations for fund/liquidate in non 50%/50% reserves


### 0.5.6 (2019-11-18)
BancorConverter:
* Updated the virtual balances mechanism - it now scales all reserve balances by the same factor
and is only relevant to cross reserve conversions


### 0.5.5 (2019-11-05)
BancorNetwork:
* Added affiliate fee support in xConvert & xConvertPrioritized

SmartTokenController:
* Removed the disableTokenTransfers function


### 0.5.4 (2019-11-03)
General:
* Added a testnet/private chain deployment script/migration
* Updated the readme file with more tutorials on the various scripts

ERC20Token:
* Cleaned up construction, added the total supply as a constructor arg


### 0.5.3 (2019-10-22)
General:
* Cleaned up all compilation warnings

BancorConverter:
* Added a protection against activation with no token supply


### 0.5.2 (2019-10-07)
BancorConverterRegistry
* Added events when adding/removing tokens
* Removing the last converter of a token will now also remove the token from the list of tokens


### 0.5.1 (2019-10-07)
General:
* Added the BancorNetworkPathFinder contract

BancorConverterFactory
* Added utility function `latestConverterAddress` to return the latest converter for a given token
* Removing the last converter for a token will now also remove the token from the list of tokens


### 0.5.0 (2019-09-25)
General:
* Terminology changes (Connector -> Reserve, Weight -> Ratio)
* Compiler upgraded to 0.4.26
* Truffle upgraded to 4.1.16


### 0.4.12 (2019-09-01)
General:
* Fixed line breaks in documentation


### 0.4.11 (2019-08-29)
BancorNetwork:
* Added support for affilate fee

BancorConverter:
* Minor cleanups / bug fixes


### 0.4.10 (2019-08-21)
BancorX:
* Added support for any ERC20/Smart token (was previously BNT specific)


### 0.4.9 (2019-08-18)
Converters:
* Fixed a rounding error in the `fund` function


### 0.4.8 (2019-07-20)
General:
* Added support for auto generation of documentation
* Updated contract documentation
* Cleaned up tests

Network:
* Fixed an issue that caused getReturnByPath to fail if the path contained old converters


### 0.4.7 (2019-05-11)
* added the ConverterRegistry contract


### 0.4.6 (2019-01-29)
General:
* Added support for non standard ERC-20 tokens
* Added NonStandardTokenRegistry contract to support non standard ERC-20 tokens

Network:
* Removed `convertForMultiple`


### 0.4.5 (2019-01-23)
General:
* Minor cleanups / bug fixes
* Moved to SafeMath

Converters:
* Added `completeXConversion` function to convert from BNT to another token by providing an id rather than amount
* Changed the version from bytes32 to uint16
* `quickConvert` and `quickConvertPrioritized` now call `convertForPrioritized3` in the BancorNetwork contract
* Renamed `isPurchaseEnabled` to `isSaleEnabled` in connector token struct, and validated that sales are enabled for the `fromConnector` rather than the `toConnector` in the conversion functions

Network:
* `verifyTrustedSender` function argument `amount` renamed to `customVal`
* Added `xConvert` and `xConvertPrioritized` functions which converts any token to BNT and transfers the result to BancorX
* Added `validateXConversion` function to get around the 16 variable function limit in the `xConvert` function
* Added `convertForPrioritized3` with backwards compatibility to now receive a custom value along with the amount for verifying trusted senders


### 0.4.4 (2018-06-23)
General:
* Minor cleanups / bug fixes
* Upgraded compiler version to 0.4.24

Converters:
* Replaced the `setRegistry` function with `updateRegistry` function
* Removed quickBuyPath from converter
* getReturn now returns the fee as a separate return value
* Converter owner can no longer withdraw connector tokens while the converter is active
* Converter owner can no longer transfer the token ownership once the converter is active
* Added a dedicated `upgrade` function for easier upgrades
* Added a `fund` function for increasing liquidity atomically
* Added a `liquidate` function for decreasing liquidity atomically even when conversions are disabled

Registry:
* Fixed item removal


### 0.4.3 (2018-06-23)
General:
* Upgraded compiler version to 0.4.23
* Updated all contracts to make use of the new `constructor` keyword
* Removed more local contract dependencies and replaced them with querying the registry

Utilities:
* ContractRegistry - added support for querying the number of items/contract names in the registry


### 0.4.2 (2018-06-10)
General:
* Added more predefined contract ids

Bug fixes:
* Fixed a crash in BancorConverterUpgrader when trying to upgrade converters with virtual connector balance


### 0.4.1 (2018-06-07)
Bug fixes:
* Fixed BancorNetwork contract backward compatibility with older converters


### 0.4.0 (2018-06-06)
General:
 * Restructured contract folders
 * Upgraded compiler version to 0.4.21
 * Replaced from testrpc with ganache
 * Other minor cleanups
 
Converters:
 * Gas cost optimizations when converting between 2 connectors, now uses an optimized dedicated
 formula calculation
 * Conversions now trigger 2 separate events - Conversion & PriceDataUpdate
 * Added support for multiple conversions in a single atomic transaction
 * Added support for conversion whitelist
 * Removed the BancorConverterExtensions contract and replaced it with the new ContractRegistry contract
 * Added the ability for the owner to also set the manager
 * Renamed BancorQuickConverter to BancorNetwork to more accurately reflect its place as the entry point
 for bancor related functionality
  * Removed EIP228 related functionality and deprecated the EIP

Utilities:
 * Added support for contract registry to minimize dependencies between contracts
 * Added support for a "feature flags" contract that allows contracts to dynamically query
 other contracts for supported features
