

# Functions:
- [`constructor(uint256 _maxLockLimit, uint256 _maxReleaseLimit, uint256 _minLimit, uint256 _limitIncPerBlock, uint256 _minRequiredReports, address _registry)`](#BancorX-constructor-uint256-uint256-uint256-uint256-uint256-address-)
- [`setMaxLockLimit(uint256 _maxLockLimit)`](#BancorX-setMaxLockLimit-uint256-)
- [`setMaxReleaseLimit(uint256 _maxReleaseLimit)`](#BancorX-setMaxReleaseLimit-uint256-)
- [`setMinLimit(uint256 _minLimit)`](#BancorX-setMinLimit-uint256-)
- [`setLimitIncPerBlock(uint256 _limitIncPerBlock)`](#BancorX-setLimitIncPerBlock-uint256-)
- [`setMinRequiredReports(uint256 _minRequiredReports)`](#BancorX-setMinRequiredReports-uint256-)
- [`setReporter(address _reporter, bool _active)`](#BancorX-setReporter-address-bool-)
- [`enableXTransfers(bool _enable)`](#BancorX-enableXTransfers-bool-)
- [`enableReporting(bool _enable)`](#BancorX-enableReporting-bool-)
- [`disableRegistryUpdate(bool _disable)`](#BancorX-disableRegistryUpdate-bool-)
- [`setBNTConverterAddress()`](#BancorX-setBNTConverterAddress--)
- [`updateRegistry()`](#BancorX-updateRegistry--)
- [`restoreRegistry()`](#BancorX-restoreRegistry--)
- [`upgrade(address[] _reporters)`](#BancorX-upgrade-address---)
- [`xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount)`](#BancorX-xTransfer-bytes32-bytes32-uint256-)
- [`xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`](#BancorX-xTransfer-bytes32-bytes32-uint256-uint256-)
- [`reportTx(bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)`](#BancorX-reportTx-bytes32-uint256-address-uint256-uint256-)
- [`getXTransferAmount(uint256 _xTransferId, address _for)`](#BancorX-getXTransferAmount-uint256-address-)
- [`getCurrentLockLimit()`](#BancorX-getCurrentLockLimit--)
- [`getCurrentReleaseLimit()`](#BancorX-getCurrentReleaseLimit--)

# Events:
- [`TokensLock(address _from, uint256 _amount)`](#BancorX-TokensLock-address-uint256-)
- [`TokensRelease(address _to, uint256 _amount)`](#BancorX-TokensRelease-address-uint256-)
- [`XTransfer(address _from, bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)`](#BancorX-XTransfer-address-bytes32-bytes32-uint256-uint256-)
- [`TxReport(address _reporter, bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)`](#BancorX-TxReport-address-bytes32-uint256-address-uint256-uint256-)
- [`XTransferComplete(address _to, uint256 _id)`](#BancorX-XTransferComplete-address-uint256-)

# Function `constructor(uint256 _maxLockLimit, uint256 _maxReleaseLimit, uint256 _minLimit, uint256 _limitIncPerBlock, uint256 _minRequiredReports, address _registry)` {#BancorX-constructor-uint256-uint256-uint256-uint256-uint256-address-}
constructor

## Parameters:
- `_maxLockLimit`:          maximum amount of BNT that can be locked in one transaction

- `_maxReleaseLimit`:       maximum amount of BNT that can be released in one transaction

- `_minLimit`:              minimum amount of BNT that can be transferred in one transaction

- `_limitIncPerBlock`:      how much the limit increases per block

- `_minRequiredReports`:    minimum number of reporters to report transaction before tokens can be released

- `_registry`:              address of contract registry
# Function `setMaxLockLimit(uint256 _maxLockLimit)` {#BancorX-setMaxLockLimit-uint256-}
setter

## Parameters:
- `_maxLockLimit`:    new maxLockLimit
# Function `setMaxReleaseLimit(uint256 _maxReleaseLimit)` {#BancorX-setMaxReleaseLimit-uint256-}
setter

## Parameters:
- `_maxReleaseLimit`:    new maxReleaseLimit
# Function `setMinLimit(uint256 _minLimit)` {#BancorX-setMinLimit-uint256-}
setter

## Parameters:
- `_minLimit`:    new minLimit
# Function `setLimitIncPerBlock(uint256 _limitIncPerBlock)` {#BancorX-setLimitIncPerBlock-uint256-}
setter

## Parameters:
- `_limitIncPerBlock`:    new limitIncPerBlock
# Function `setMinRequiredReports(uint256 _minRequiredReports)` {#BancorX-setMinRequiredReports-uint256-}
setter

## Parameters:
- `_minRequiredReports`:    new minRequiredReports
# Function `setReporter(address _reporter, bool _active)` {#BancorX-setReporter-address-bool-}
allows the owner to set/remove reporters

## Parameters:
- `_reporter`:    reporter whos status is to be set

- `_active`:      true if the reporter is approved, false otherwise
# Function `enableXTransfers(bool _enable)` {#BancorX-enableXTransfers-bool-}
allows the owner enable/disable the xTransfer method

## Parameters:
- `_enable`:     true to enable, false to disable
# Function `enableReporting(bool _enable)` {#BancorX-enableReporting-bool-}
allows the owner enable/disable the reportTransaction method

## Parameters:
- `_enable`:     true to enable, false to disable
# Function `disableRegistryUpdate(bool _disable)` {#BancorX-disableRegistryUpdate-bool-}
disables the registry update functionality
this is a safety mechanism in case of a emergency
can only be called by the manager or owner

## Parameters:
- `_disable`:    true to disable registry updates, false to re-enable them
# Function `setBNTConverterAddress()` {#BancorX-setBNTConverterAddress--}
allows the owner to set the BNT converters address to wherever the
contract registry currently points to
# Function `updateRegistry()` {#BancorX-updateRegistry--}
sets the contract registry to whichever address the current registry is pointing to
# Function `restoreRegistry()` {#BancorX-restoreRegistry--}
security mechanism allowing the converter owner to revert to the previous registry,
to be used in emergency scenario
# Function `upgrade(address[] _reporters)` {#BancorX-upgrade-address---}
upgrades the contract to the latest version
can only be called by the owner
note that the owner needs to call acceptOwnership on the new contract after the upgrade

## Parameters:
- `_reporters`:    new list of reporters
# Function `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount)` {#BancorX-xTransfer-bytes32-bytes32-uint256-}
claims BNT from msg.sender to be converted to BNT on another blockchain

## Parameters:
- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address to send the BNT to

- `_amount`:          the amount to transfer
# Function `xTransfer(bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)` {#BancorX-xTransfer-bytes32-bytes32-uint256-uint256-}
claims BNT from msg.sender to be converted to BNT on another blockchain

## Parameters:
- `_toBlockchain`:    blockchain BNT will be issued on

- `_to`:              address to send the BNT to

- `_amount`:          the amount to transfer

- `_id`:              pre-determined unique (if non zero) id which refers to this transaction 
# Function `reportTx(bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)` {#BancorX-reportTx-bytes32-uint256-address-uint256-uint256-}
allows reporter to report transaction which occured on another blockchain

## Parameters:
- `_fromBlockchain`:  blockchain BNT was destroyed in

- `_txId`:            transactionId of transaction thats being reported

- `_to`:              address to receive BNT

- `_amount`:          amount of BNT destroyed on another blockchain

- `_xTransferId`:     unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been mined)
# Function `getXTransferAmount(uint256 _xTransferId, address _for) → uint256` {#BancorX-getXTransferAmount-uint256-address-}
gets x transfer amount by xTransferId (not txId)

## Parameters:
- `_xTransferId`:    unique (if non zero) pre-determined id (unlike _txId which is determined after the transactions been broadcasted)

- `_for`:            address corresponding to xTransferId

# Function `getCurrentLockLimit() → uint256` {#BancorX-getCurrentLockLimit--}
method for calculating current lock limit

# Function `getCurrentReleaseLimit() → uint256` {#BancorX-getCurrentReleaseLimit--}
method for calculating current release limit


# Event `TokensLock(address _from, uint256 _amount)` {#BancorX-TokensLock-address-uint256-}
No description
# Event `TokensRelease(address _to, uint256 _amount)` {#BancorX-TokensRelease-address-uint256-}
No description
# Event `XTransfer(address _from, bytes32 _toBlockchain, bytes32 _to, uint256 _amount, uint256 _id)` {#BancorX-XTransfer-address-bytes32-bytes32-uint256-uint256-}
No description
# Event `TxReport(address _reporter, bytes32 _fromBlockchain, uint256 _txId, address _to, uint256 _amount, uint256 _xTransferId)` {#BancorX-TxReport-address-bytes32-uint256-address-uint256-uint256-}
No description
# Event `XTransferComplete(address _to, uint256 _id)` {#BancorX-XTransferComplete-address-uint256-}
No description
