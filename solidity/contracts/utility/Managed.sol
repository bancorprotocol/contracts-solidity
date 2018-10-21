pragma solidity ^0.4.24;
import './Owned.sol';

/*
    Provides support and utilities for contract management
    Note that a managed contract must also have an owner
*/
contract Managed is Owned {
    address public manager;
    address public newManager;

    event ManagerUpdate(address indexed _prevManager, address indexed _newManager);

    /**
        @dev constructor
    */
    constructor() public {
        manager = msg.sender;
    }

    // allows execution by the manager only
    modifier managerOnly {
        assert(msg.sender == manager);
        _;
    }

    // allows execution by either the owner or the manager only
    modifier ownerOrManagerOnly {
        require(msg.sender == owner || msg.sender == manager);
        _;
    }

    /**
        @dev allows transferring the contract management
        the new manager still needs to accept the transfer
        can only be called by the contract manager

        @param _newManager    new contract manager
    */
    function transferManagement(address _newManager) public ownerOrManagerOnly {
        require(_newManager != manager);
        newManager = _newManager;
    }

    /**
        @dev used by a new manager to accept a management transfer
    */
    function acceptManagement() public {
        require(msg.sender == newManager);
        emit ManagerUpdate(manager, newManager);
        manager = newManager;
        newManager = address(0);
    }
}
