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
