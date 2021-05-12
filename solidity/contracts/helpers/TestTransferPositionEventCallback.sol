// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/interfaces/ITransferPositionEventCallback.sol";

contract TestTransferPositionEventCallback is ITransferPositionEventCallback {
    struct TransferPositionEvent {
        uint256 newId;
        address provider;
        bytes data;
    }

    TransferPositionEvent private _transferEvent;

    function onTransferPosition(
        uint256 newId,
        address provider,
        bytes calldata data
    ) external override {
        _transferEvent = TransferPositionEvent({ newId: newId, provider: provider, data: data });
    }

    function transferEvent()
        external
        view
        returns (
            uint256,
            address,
            bytes memory
        )
    {
        return (_transferEvent.newId, _transferEvent.provider, _transferEvent.data);
    }
}
