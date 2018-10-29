pragma solidity ^0.4.18;
import '../utility/interfaces/IOwned.sol';

/*
    Financie Ticket Store contract interface
*/
contract IFinancieTicketStore is IOwned{
    function depositTickets(address _ticket, address _card, uint256 _amount, uint256 _price, uint256 _start_at, uint256 _end_at) public;
    function buyTicket(address _ticket) public;
}
