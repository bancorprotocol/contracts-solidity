// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev Checkpoint store contract interface
 */
interface ICheckpointStore {
    function addCheckpoint(address _address) external;

    function addPastCheckpoint(address _address, uint256 _time) external;

    function addPastCheckpoints(address[] calldata _addresses, uint256[] calldata _times) external;

    function checkpoint(address _address) external view returns (uint256);
}
