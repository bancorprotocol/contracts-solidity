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
     *
     * @param _address the address we're collecting the data for
     * @param _time the checkpoint
     */
    event CheckpointUpdated(address indexed _address, uint256 _time);

    constructor() public {
        // set up administrative roles.
        _setRoleAdmin(ROLE_OWNER, ROLE_OWNER);
        _setRoleAdmin(ROLE_SEEDER, ROLE_OWNER);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_OWNER, msg.sender);
    }

    /**
     * @dev adds a new data point to the store
     * can only be called by an owner
     *
     * @param _address the address we're collecting the data for
     */
    function addCheckpoint(address _address) external override validAddress(_address) {
        require(hasRole(ROLE_OWNER, msg.sender), "ERR_ACCESS_DENIED");

        addCheckpoint(_address, time());
    }

    /**
     * @dev adds a past checkpoint to the store
     * can only be called by a seeder
     *
     * @param _address the address we're collecting the data for
     * @param _time the checkpoint
     */
    function addPastCheckpoint(address _address, uint256 _time) external override validAddress(_address) {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");
        require(_time < time(), "ERR_INVALID_TIME");

        addCheckpoint(_address, _time);
    }

    /**
     * @dev adds past checkpoints to the store
     * can only be called by a seeder
     *
     * @param _addresses the addresses we're collecting the data for
     * @param _times the checkpoints
     */
    function addPastCheckpoints(address[] calldata _addresses, uint256[] calldata _times) external override {
        require(hasRole(ROLE_SEEDER, msg.sender), "ERR_ACCESS_DENIED");

        uint256 length = _addresses.length;
        require(length == _times.length, "ERR_INVALID_LENGTH");

        for (uint256 i = 0; i < length; i++) {
            address addr = _addresses[i];
            uint256 t = _times[i];

            _validAddress(addr);
            require(t < time(), "ERR_INVALID_TIME");

            addCheckpoint(addr, t);
        }
    }

    /**
     * @dev returns the store value for a specific address
     *
     * @param _address the address we're collecting the data for
     *
     * @return the checkpoint
     */
    function checkpoint(address _address) external view override returns (uint256) {
        return data[_address];
    }

    /**
     * @dev adds a new checkpoint
     * can only be called by a seeder
     *
     * @param _address the address we're collecting the data for
     * @param _time the checkpoint
     */
    function addCheckpoint(address _address, uint256 _time) private {
        require(data[_address] <= _time, "ERR_WRONG_ORDER");

        data[_address] = _time;

        emit CheckpointUpdated(_address, _time);
    }
}
