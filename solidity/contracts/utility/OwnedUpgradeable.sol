// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import "./interfaces/IOwned.sol";

/**
 * @dev This contract provides support and utilities for contract ownership.
 */
contract OwnedUpgradeable is Initializable, IOwned {
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
     * @dev initializes a new OwnedUpgradeable instance
     */
    function __OwnedUpgradeable_init() internal initializer {
        __OwnedUpgradeable_init_unchained();
    }

    function __OwnedUpgradeable_init_unchained() internal initializer {
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

    // https://docs.openzeppelin.com/contracts/3.x/upgradeable#storage_gaps
    uint256[49] private __gap;
}
