pragma solidity ^0.4.18;
import './interfaces/IFinancieLog.sol';
import './Owned.sol';

contract FinancieLog is Owned, IFinancieLog {

    struct Logs {
        EventType[] eventType;
        CurrencyType[] currencyType;
        address[] target;
        uint256[] amountFrom;
        uint256[] amountTo;
    }

    mapping (address => Logs) allLogs;

    function FinancieLog() public {
    
    }

    function() payable public {
        revert();
    }

    function recordLog(address _sender,
        EventType _eventType,
        CurrencyType _currencyType,
        address _target,
        uint256 _paidAmount,
        uint256 _receivedAmount)
        public
        ownerOnly
    {

    }

    function getLogs(address _sender)
        public returns(EventType[], CurrencyType[], address[], uint256[], uint256[])
    {
        return (allLogs[_sender].eventType,
          allLogs[_sender].currencyType,
          allLogs[_sender].target,
          allLogs[_sender].amountFrom,
          allLogs[_sender].amountTo);
    }

}
