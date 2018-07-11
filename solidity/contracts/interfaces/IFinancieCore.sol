pragma solidity ^0.4.18;

/*
    Financie Core contract interface
*/
contract IFinancieCore {
    function activateUser(uint32 _userId) public;
    function activateTargetContract(address _contract, bool _enabled) public;

    function notifyConvertCards(address _sender, address _from, address _to, uint256 _amountFrom, uint256 _amountTo) public;
    function notifyBidCards(address _sender, address _to, uint256 _amount) public;
    function notifyWithdrawalCards(address _sender, address _to, uint256 _amount) public;
    function notifyBurnCards(address _sender, address _card, uint256 _amount) public;
    function notifyBurnTickets(address _sender, address _ticket, uint256 _amount) public;

    function depositTickets(address _ticket, address _card, uint256 _amount, uint256 _price) public;
    function buyTicket(address _ticket) public;

    function getCardList(address _sender) public returns(address[]);
    function getTicketList(address _sender) public returns(address[]);
    function getPaidTicketCounts(address _sender, address _ticket) public returns(uint256);
}
