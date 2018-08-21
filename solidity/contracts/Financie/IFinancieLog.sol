pragma solidity ^0.4.18;
import '../interfaces/IOwned.sol';

/*
    Financie Log contract interface
*/
contract IFinancieLog is IOwned {
    /*
     * Enums
     */
    enum EventType {
        BidCards,
        WithdrawCards,
        SellCards,
        BuyCards,
        BurnCards,
        BuyTicket,
        BurnTicket
    }

    function recordLog(
        address _sender,
        address _target,
        EventType _eventType,
        address _from,
        address _to,
        uint256 _paidAmount,
        uint256 _receivedAmount)
        public;
    function getSenderLogs(address _sender) public view returns(uint[], address[], EventType[], address[], address[], uint256[], uint256[]);
    function getTargetLogs(address _target) public view returns(uint[], address[], EventType[], address[], address[], uint256[], uint256[]);
    function getFromLogs(address _from) public view returns(uint[], address[], address[], EventType[], address[], uint256[], uint256[]);
    function getToLogs(address _to) public view returns(uint[], address[], address[], EventType[], address[], uint256[], uint256[]);
}
