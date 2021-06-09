// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/ICheckpointStore.sol";

import "../utility/Utils.sol";
import "../utility/Time.sol";

/**
 * @dev Time store contract
 */
contract CheckpointStore is ICheckpointStore, AccessControl, Utils, Time {
    mapping(address => uint256) private data;

    // the owner role is used to add values to the store, but it can't update them
    bytes32 public constant ROLE_OWNER = keccak256("ROLE_OWNER");

    // the seeder roles is used to seed the store with past values
    bytes32 public constant ROLE_SEEDER = keccak256("ROLE_SEEDER");

    /**
     * @dev triggered when a new data point is being added
     */
    event CheckpointUpdated(address indexed target, uint256 timestamp);

    constructor() public {
        // set up administrative roles.
        _setRoleAdmin(ROLE_OWNER, ROLE_OWNER);
        _setRoleAdmin(ROLE_SEEDER, ROLE_OWNER);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_OWNER, msg.sender);
    }

    /**
     * @dev adds a new data point to the store
     *
     * Requirements:
     *
     * - the caller must have the ROLE_OWNER role
     */
    function addCheckpoint(address target) external override validAddress(target) {
        require(hasRole(ROLE_OWNER, msg.sender), "ERR_ACCESS_DENIED");

        _addCheckpoint(target, _time());
    }

    /**
     * @dev adds a past checkpoint to the store
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function addPastCheckpoint(address target, uint256 timestamp) external override validAddress(target) {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");
        require(timestamp < _time(), "ERR_INVALID_TIME");

        _addCheckpoint(target, timestamp);
    }

    /**
     * @dev adds past checkpoints to the store
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function addPastCheckpoints(address[] calldata targets, uint256[] calldata timestamps) external override {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");

        uint256 length = targets.length;
        require(length == timestamps.length, "ERR_INVALID_LENGTH");

        for (uint256 i = 0; i < length; i++) {
            address addr = targets[i];
            uint256 t = timestamps[i];

            _validAddress(addr);
            require(t < _time(), "ERR_INVALID_TIME");

            _addCheckpoint(addr, t);
        }
    }

    /**
     * @dev returns the store value for a specific address
     */
    function checkpoint(address target) external view override returns (uint256) {
        return data[target];
    }

    /**
     * @dev adds a new checkpoint
     *
     * Requirements:
     *
     * - the caller must have the ROLE_SEEDER role
     */
    function _addCheckpoint(address target, uint256 timestamp) private {
        require(data[target] <= timestamp, "ERR_WRONG_ORDER");

        data[target] = timestamp;

        emit CheckpointUpdated(target, timestamp);
    }
}
