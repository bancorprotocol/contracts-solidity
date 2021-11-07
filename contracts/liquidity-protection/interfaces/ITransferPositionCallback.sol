// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Transfer position event callback interface
 */
interface ITransferPositionCallback {
    function onTransferPosition(
        uint256 newId,
        address provider,
        bytes calldata data
    ) external;
}
