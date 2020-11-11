// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./interfaces/IOwned.sol";

/**
 * @dev This contract provides support and utilities for contract ownership.
 */
contract Owned is IOwned {
    address public override owner;
    address public newOwner;

    /**
     * @dev triggered when the owner is updated
     *
     * @param _prevOwner previous owner
     * @param _newOwner  new owner
     */
    event OwnerUpdate(address indexed _prevOwner, address indexed _newOwner);

    /**
     * @dev initializes a new Owned instance
     */
    constructor() public {
        owner = msg.sender;
    }

    // allows execution by the owner only
    modifier ownerOnly {
        _ownerOnly();
        _;
    }

    // error message binary size optimization
    function _ownerOnly() internal view {
        require(msg.sender == owner, "ERR_ACCESS_DENIED");
    }

    /**
     * @dev allows transferring the contract ownership
     * the new owner still needs to accept the transfer
     * can only be called by the contract owner
     *
     * @param _newOwner    new contract owner
     */
    function transferOwnership(address _newOwner) public override ownerOnly {
        require(_newOwner != owner, "ERR_SAME_OWNER");
        newOwner = _newOwner;
    }

    /**
     * @dev used by a new owner to accept an ownership transfer
     */
    function acceptOwnership() public override {
        require(msg.sender == newOwner, "ERR_ACCESS_DENIED");
        emit OwnerUpdate(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}
