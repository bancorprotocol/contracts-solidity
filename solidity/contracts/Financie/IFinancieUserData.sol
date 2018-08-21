pragma solidity ^0.4.18;

/*
    Financie User Data contract interface
*/
contract IFinancieUserData {
    function activateUser(uint32 _userId) public;

    function addOwnedCardList(address _sender, address _address) public;
    function addOwnedTicketList(address _sender, address _ticket) public;
    function addPaidTicketList(address _sender, address _ticket, uint256 _amount) public;

    function checkUserActivation(address _sender, uint32 _userId) public returns(bool);
    function getCardList(address _sender) public returns(address[]);
    function getTicketList(address _sender) public returns(address[]);
    function getPaidTicketCounts(address _sender, address _ticket) public returns(uint256);
}
