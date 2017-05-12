pragma solidity ^0.4.10;

/*
    Provides support and utilities for contract ownership
*/
contract Owned {
    address public owner;
    address public newOwner;

    event OwnerUpdate(address _prevOwner, address _newOwner);

    function Owned() {
        owner = msg.sender;
    }

    // allows execution by the owner only
    modifier ownerOnly {
        assert(msg.sender == owner);
        _;
    }

    /*
        allows transferring the contract ownership
        the new owner still need to accept the transfer
        can only be called by the contract owner
    */
    function setOwner(address _newOwner) public ownerOnly {
        require(_newOwner != owner);
        newOwner = _newOwner;
    }

    /*
        used by a new owner to accept an ownership transfer
    */
    function acceptOwnership() public {
        require(msg.sender == newOwner);
        address prevOwner = owner;
        owner = newOwner;
        newOwner = 0x0;
        OwnerUpdate(prevOwner, owner);
    }
}
