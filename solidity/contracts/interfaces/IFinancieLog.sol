pragma solidity ^0.4.18;
import './IOwned.sol';

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
        BurnCards
    }

    enum CurrencyType {
        None,
        PlatformCoin,
        Ethereum
    }

    function recordLog(address _sender,
        EventType _eventType,
        CurrencyType _currencyType,
        address _target,
        uint256 _paidAmount,
        uint256 _receivedAmount)
        public;
    function getTargetLogs(address _target) public view returns(uint[], EventType[], CurrencyType[], address[], uint256[], uint256[]);
    function getUserLogs(address _sender) public view returns(uint[], EventType[], CurrencyType[], address[], uint256[], uint256[]);
}
