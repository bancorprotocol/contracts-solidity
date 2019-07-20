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


