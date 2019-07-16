

# Functions:
- [`constructor(bool _reroutingEnabled)`](#XTransferRerouter-constructor-bool-)
- [`enableRerouting(bool _enable)`](#XTransferRerouter-enableRerouting-bool-)
- [`rerouteTx(uint256 _txId, bytes32 _blockchain, bytes32 _to)`](#XTransferRerouter-rerouteTx-uint256-bytes32-bytes32-)

# Events:
- [`TxReroute(uint256 _txId, bytes32 _toBlockchain, bytes32 _to)`](#XTransferRerouter-TxReroute-uint256-bytes32-bytes32-)

# Function `constructor(bool _reroutingEnabled)` {#XTransferRerouter-constructor-bool-}
constructor

## Parameters:
- `_reroutingEnabled`:    intializes transactions routing to enabled/disabled   
# Function `enableRerouting(bool _enable)` {#XTransferRerouter-enableRerouting-bool-}
allows the owner to disable/enable rerouting

## Parameters:
- `_enable`:     true to enable, false to disable
# Function `rerouteTx(uint256 _txId, bytes32 _blockchain, bytes32 _to)` {#XTransferRerouter-rerouteTx-uint256-bytes32-bytes32-}
   allows a user to reroute a transaction to a new blockchain/target address

## Parameters:
- `_txId`:        the original transaction id

- `_blockchain`:  the new blockchain name

- `_to`:          the new target address/account

# Event `TxReroute(uint256 _txId, bytes32 _toBlockchain, bytes32 _to)` {#XTransferRerouter-TxReroute-uint256-bytes32-bytes32-}
No description
