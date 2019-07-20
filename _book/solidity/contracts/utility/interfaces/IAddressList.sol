pragma solidity ^0.4.24;

/*
    Address list interface
*/
contract IAddressList {
    mapping (address => bool) public listedAddresses;
}
