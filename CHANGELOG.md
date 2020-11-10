### 0.6.23
LiquidityProtection
* Improved accuracy of the return/fee calculations

General
* Many other minor changes and cleanups


### 0.6.22
LiquidityProtection
* Fixed an issue that prevented users from adding single sided liquidity in some cases


### 0.6.21
LiquidityPoolV1Converter
* Fixed an issue that caused recentAverageRate to return 0/0 for new converters

LiquidityProtection
* Fixed an issue in removeLiquidityReturn that returned the wrong amount
* Added support for max rate deviation


### 0.6.20
General
* Added the liquidity protection mechanism


### 0.6.19
General
* Moved more generic math functions into Math

ReentrancyGuard
* Gas optimization

LiquidityPoolV1Converter
* Recent average rate is now calculated before the conversion


### 0.6.18
General
* Added Math contract with various math utilities

ERC20Token
* Removed the approve frontrunning protection

SmartToken
* Renamed to DSToken
* Removed the owner's ability to disable transfers
* Removed the owner's ability to withdraw other tokens from the contract


### 0.6.17
LiquidityPoolV1Converter
* Added the ability to query the recent average rate
* Added the ability to query the return amount for adding/removing liquidity


### 0.6.16
General
* Removed binaries from the repo

ConverterRegistry
* Fixed an issue that prevented creating a new pool if an old pool had one of the new pool's reserves


### 0.6.15
General
* Updated all "contract interfaces" to real interfaces
* Cleaned up conventions

LiquidityPoolV2Converter
* Updated the fee structure to standard fee / oracle deviation fee


### 0.6.14
General
* Upgraded contracts/solidity compiler to v0.6.12


### 0.6.13
LiquidityPoolV2Converter
* Allow the owner to update the amplification factor


### 0.6.12
LiquidityPoolV2Converter
* Allow the owner to update the external rate propagation time

PriceOracle
* Fixed `lastUpdateTime` to return the latest time between the oracles


### 0.6.11
LiquidityPoolV2Converter
* Updated weights/fees logic

LiquidTokenConverter
* Initial purchase/supply now takes the reserve weight into account


### 0.6.10
LiquidityPoolV2Converter
* Fixed an issue in the upgrade process


### 0.6.9
LiquidityPoolV2Converter
* Upgraded dynamic fee mechanism


### 0.6.8
Converters
* Updated version number


### 0.6.7
General
* Added LiquidityPoolV2Converter
* Added a Chainlink price oracle proxy contract
* Moved converter types into dedicated folders
* Many other minor changes and cleanups

Converters
* Added the converter type to the `Activation` event

Converter Factory
* Added support for custom factory for converter types
* Added the converter type to the `NewConverter` event


### 0.6.6
General
* Updated truffle to 5.1.32
* Updated web3.js to 1.2.9
* Switched to ganache-core
* Updated to the newest solidity-coverage and run it as a plugin
* Added solhint and added npm scripts
* Added eslint
* Upgraded tests to expect and chai, use BN instead of BigNumber and avoid state sharing via before() callbacks
* Various tests updates and improvements


### 0.6.5
General
* Renamed `rate` related functions to `targetAmount` for clarity

LiquidityPoolV1Converter
* Fixed an issue when adding liquidity that only added a fraction of the requested amount


### 0.6.4
TokenHandler
* Fixed a security vulnerability that allowed any wallet to invoke the transfer functions


### 0.6.3
BancorNetwork
* Fixed an issue in the backward compatibility layer for older converters

ConverterUpgrader
* Fixed an issue in the backward compatibility layer for older converters


### 0.6.2
BancorNetwork
* Added backward compatibility to `rateByPath`


### 0.6.1
ConverterRegistry
* Fixed a bug that prevented removal of older converters from the registry


### 0.6.0
General
* Major upgrade, many improvements and design changes (new backward compatibility layer still supports most of older interfaces)
* Major gas optimization on conversions
* New design to allow different converter types
* Removed EtherToken functionality in favor of using ETH directly (the contract is still used for backward compatibility)
* Added revert error messages
* Improved support for non standard token transfer/transferFrom functions
* Many other minor changes, bug fixes and cleanups

BancorNetwork
* Added a new `conversionPath` function
* `getReturnByPath` is now replaced by `rateByPath`
* all conversion functions are now replaced by `convertByPath`

BancorConverter
* Converters are now broken into different contracts with `ConverterBase` as the base contract
* New entity introduced - Converter Anchor. The anchor rerpresents the converter id and is the non upgradable component of the converter
* New `converterType` function to allow identifying the converter
* There are now two major converter types - Liquid Token Converter & Liquidity Pool Converter
* Add/Remove liquidity functions moved to the new liquidity pool converter
* New add/remove liquidity functions - `addLiquidity` now accepts the reserve amounts instead of the pool token amount
* It's now possible to add liquidity to empty liquidity pools
* It's no longer possible to convert into pool tokens (these can only be acquired by adding liquidity)
* Conversions cannot be executed directly against converters anymore - all conversions should be executed through the BancorNetwork contract
* New `TokenRateUpdate` event that gets emitted for rate changes between any two tokens (reserve/reserve, pool/reserve etc.)
* `PriceDataEvent` is now deprecated in favor of the new `TokenRateUpdate` event

ConverterRegistry
* Added `newConverter` factory function to simplify converter creation process
* Converters cannot be added to the registry directly anymore, instead use the new factory function
* Converters are now accessible by their anchors instead of by their smart tokens
* Smart token functions/events are now replaced with anchor functions/events

BancorX
* Removed support for smart tokens for security reasons. Allowance should be used instead


### 0.5.19
BancorConverter
* Added re-entrancy protection


### 0.5.18
BancorConverterRegistry
* Reverted the signature change of `getLiquidityPoolByReserveConfig` (logic is still intact)


### 0.5.16
BancorConverter
* Removed `Manager` permission/code
* `totalReserveRatio` is now public

BancorConverterRegistry
* Fixed a bug with identifying converters with similar configurations


### 0.5.15
EtherToken
* Name & symbol are now constructor args


### 0.5.14
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


### 0.5.13
BancorNetwork
* Added a new Conversion event that gets emitted for any conversion in the network

BancorConverter
* Owners cannot disable conversions anymore
* Owners cannot disable conversions from specific reserves anymore
* Removed the virtual balance mechanism


### 0.5.12
General
* Better handling for non standard ERC20 tokens's transfer function (removed NonStandardTokenRegistry contract, gas optimization)

BancorConverterRegistry
* Fixed an issue that allowed adding duplicate pools to the registry in certain situations


### 0.5.11
General
* Added the BancorNetworkPathFinder contract, now compatible with the new converter registry contract

BancorConverter
* Added a dedicated getReserveRatio function

BancorConverterRegistry
* Now enforces only a single liquidity pool for each reserve configuration
* Disabled converters are now considered invalid (can be removed by anyone)
* Added a utility function that returns a list of converters for a given list of smart tokens


### 0.5.8-10
General
* Minor cleanups


### 0.5.7
General:
* Added ContractRegistryClient contract for common contract registry behavior and cleaner access, and updated all registry clients

BancorConverterRegistry:
* Full redesign - it now allows iterating over different primitives in the network and does not
require re-adding converters after a converter upgrade

BancorConverter:
* Added support for fund/liquidate in non 50%/50% reserves converters

BancorFormula:
* Added calculations for fund/liquidate in non 50%/50% reserves


### 0.5.6
BancorConverter:
* Updated the virtual balances mechanism - it now scales all reserve balances by the same factor
and is only relevant to cross reserve conversions


### 0.5.5
BancorNetwork:
* Added affiliate fee support in xConvert & xConvertPrioritized

SmartTokenController:
* Removed the disableTokenTransfers function


### 0.5.4
General:
* Added a testnet/private chain deployment script/migration
* Updated the readme file with more tutorials on the various scripts

ERC20Token:
* Cleaned up construction, added the total supply as a constructor arg


### 0.5.3
General:
* Cleaned up all compilation warnings

BancorConverter:
* Added a protection against activation with no token supply


### 0.5.2
BancorConverterRegistry
* Added events when adding/removing tokens
* Removing the last converter of a token will now also remove the token from the list of tokens


### 0.5.1
General:
* Added the BancorNetworkPathFinder contract

BancorConverterFactory
* Added utility function `latestConverterAddress` to return the latest converter for a given token
* Removing the last converter for a token will now also remove the token from the list of tokens


### 0.5.0
General:
* Terminology changes (Connector -> Reserve, Weight -> Ratio)
* Compiler upgraded to 0.4.26
* Truffle upgraded to 4.1.16


### 0.4.12
General:
* Fixed line breaks in documentation


### 0.4.11
BancorNetwork:
* Added support for affilate fee

BancorConverter:
* Minor cleanups / bug fixes


### 0.4.10
BancorX:
* Added support for any ERC20/Smart token (was previously BNT specific)


### 0.4.9
Converters:
* Fixed a rounding error in the `fund` function


### 0.4.8
General:
* Added support for auto generation of documentation
* Updated contract documentation
* Cleaned up tests

Network:
* Fixed an issue that caused getReturnByPath to fail if the path contained old converters


### 0.4.7
* added the ConverterRegistry contract


### 0.4.6
General:
* Added support for non standard ERC-20 tokens
* Added NonStandardTokenRegistry contract to support non standard ERC-20 tokens

Network:
* Removed `convertForMultiple`


### 0.4.5
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


### 0.4.4
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


### 0.4.3
General:
* Upgraded compiler version to 0.4.23
* Updated all contracts to make use of the new `constructor` keyword
* Removed more local contract dependencies and replaced them with querying the registry

Utilities:
* ContractRegistry - added support for querying the number of items/contract names in the registry


### 0.4.2
General:
* Added more predefined contract ids

Bug fixes:
* Fixed a crash in BancorConverterUpgrader when trying to upgrade converters with virtual connector balance


### 0.4.1
Bug fixes:
* Fixed BancorNetwork contract backward compatibility with older converters


### 0.4.0
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
