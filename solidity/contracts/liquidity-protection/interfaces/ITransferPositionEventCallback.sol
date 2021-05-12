// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Transfer position event callback interface
 */
interface ITransferPositionEventCallback {
    function onTransferPosition(uint256 newId, address provider) external;
}
