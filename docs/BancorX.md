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


