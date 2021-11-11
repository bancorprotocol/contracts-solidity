// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Checkpoint store contract interface
 */
interface ICheckpointStore {
    function addCheckpoint(address target) external;

    function addPastCheckpoint(address target, uint256 timestamp) external;

    function addPastCheckpoints(address[] calldata targets, uint256[] calldata timestamps) external;

    function checkpoint(address target) external view returns (uint256);
}
