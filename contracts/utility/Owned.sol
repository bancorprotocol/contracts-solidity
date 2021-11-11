// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./interfaces/IOwned.sol";

/**
 * @dev This contract provides support and utilities for contract ownership.
 */
contract Owned is IOwned {
    address private _owner;
    address private _newOwner;

    /**
     * @dev triggered when the owner is updated
     */
    event OwnerUpdate(address indexed prevOwner, address indexed newOwner);

    /**
     * @dev initializes a new Owned instance
     */
    constructor() public {
        _owner = msg.sender;
    }

    // allows execution by the owner only
    modifier ownerOnly {
        _ownerOnly();

        _;
    }

    // error message binary size optimization
    function _ownerOnly() private view {
        require(msg.sender == _owner, "ERR_ACCESS_DENIED");
    }

    /**
     * @dev allows transferring the contract ownership
     *
     * Requirements:
     *
     * - the caller must be the owner of the contract
     *
     * note the new owner still needs to accept the transfer
     */
    function transferOwnership(address newOwner) public override ownerOnly {
        require(newOwner != _owner, "ERR_SAME_OWNER");

        _newOwner = newOwner;
    }

    /**
     * @dev used by a new owner to accept an ownership transfer
     */
    function acceptOwnership() public override {
        require(msg.sender == _newOwner, "ERR_ACCESS_DENIED");

        emit OwnerUpdate(_owner, _newOwner);

        _owner = _newOwner;
        _newOwner = address(0);
    }

    /**
     * @dev returns the address of the current owner
     */
    function owner() public view override returns (address) {
        return _owner;
    }

    /**
     * @dev returns the address of the new owner candidate
     */
    function newOwner() external view returns (address) {
        return _newOwner;
    }
}
