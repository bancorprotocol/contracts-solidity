pragma solidity ^0.4.8;

contract Owned {
    address public owner;

    event NewOwner(address indexed _prevOwner, address indexed _newOwner);

    function Owned() {
        owner = msg.sender;
    }

    modifier onlyOwner {
        if (msg.sender != owner)
            throw;
        _;
    }

    function setOwner(address _newOwner) public onlyOwner {
        if (owner == _newOwner)
            throw;

        address prevOwner = owner;
        owner = _newOwner;
        NewOwner(prevOwner, owner);
    }
}
