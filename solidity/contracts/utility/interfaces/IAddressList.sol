pragma solidity 0.4.26;

/*
    Address list interface
*/
contract IAddressList {
    mapping (address => bool) public listedAddresses;
}
