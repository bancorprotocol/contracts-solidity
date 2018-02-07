pragma solidity ^0.4.18;

/*
    Provides support and utilities for contract management
*/
contract Managed {
    address public manager;
    address public newManager;

    event ManagerUpdate(address indexed _prevManager, address indexed _newManager);

    /**
        @dev constructor
    */
    function Managed() public {
        manager = msg.sender;
    }

    // allows execution by the manager only
    modifier managerOnly {
        assert(msg.sender == manager);
        _;
    }

    /**
        @dev allows transferring the contract management
        the new manager still needs to accept the transfer
        can only be called by the contract manager

        @param _newManager    new contract manager
    */
    function transferManagement(address _newManager) public managerOnly {
        require(_newManager != manager);
        newManager = _newManager;
    }

    /**
        @dev used by a new manager to accept a management transfer
    */
    function acceptManagement() public {
        require(msg.sender == newManager);
        ManagerUpdate(manager, newManager);
        manager = newManager;
        newManager = address(0);
    }
}
