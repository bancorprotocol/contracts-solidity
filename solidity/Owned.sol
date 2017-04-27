pragma solidity ^0.4.10;

contract Owned {
    address public owner;

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
        can only be called by the contract owner
    */
    function setOwner(address _newOwner) public ownerOnly {
        require(_newOwner != owner);
        address prevOwner = owner;
        owner = _newOwner;
        OwnerUpdate(prevOwner, owner);
    }
}
