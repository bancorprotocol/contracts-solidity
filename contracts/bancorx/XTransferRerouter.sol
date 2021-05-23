// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/Owned.sol";

contract XTransferRerouter is Owned {
    bool private _reroutingEnabled;

    // triggered when a rerouteTx is called
    event TxReroute(uint256 indexed txId, bytes32 toBlockchain, bytes32 to);

    /**
     * @dev initializes a new XTransferRerouter instance
     *
     * @param initialReroutingEnabled initializes transactions routing to enabled/disabled
     */
    constructor(bool initialReroutingEnabled) public {
        _reroutingEnabled = initialReroutingEnabled;
    }

    // allows execution only when rerouting enabled
    modifier reroutingAllowed {
        _reroutingAllowed();

        _;
    }

    // error message binary size optimization
    function _reroutingAllowed() internal view {
        require(_reroutingEnabled, "ERR_DISABLED");
    }

    /**
     * @dev allows the owner to disable/enable rerouting
     *
     * @param enable true to enable, false to disable
     */
    function enableRerouting(bool enable) external ownerOnly {
        _reroutingEnabled = enable;
    }

    /**
     * @dev returns whether the rerouting is enabled
     *
     * @return whether the rerouting is enabled
     */
    function reroutingEnabled() external view returns (bool) {
        return _reroutingEnabled;
    }

    /**
     * @dev allows a user to reroute a transaction to a new blockchain/target address
     *
     * @param txId the original transaction id
     * @param blockchain  the new blockchain name
     * @param to the new target address/account
     */
    function rerouteTx(
        uint256 txId,
        bytes32 blockchain,
        bytes32 to
    ) public reroutingAllowed {
        emit TxReroute(txId, blockchain, to);
    }
}
