pragma solidity ^0.4.18;
import '../interfaces/IFinancieLog.sol';
import '../Owned.sol';

contract FinancieLog is Owned, IFinancieLog {

    struct UserLogs {
        bool isSet;
        EventType[] eventType;
        CurrencyType[] currencyType;
        address[] target;
        uint256[] amountFrom;
        uint256[] amountTo;
    }

    struct TargetLogs {
        bool isSet;
        EventType[] eventType;
        CurrencyType[] currencyType;
        address[] sender;
        uint256[] amountFrom;
        uint256[] amountTo;
    }

    mapping (address => UserLogs) userLogs;
    mapping (address => TargetLogs) targetLogs;

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
        if ( !userLogs[_sender].isSet ) {
            userLogs[_sender] = UserLogs(
                true,
                new EventType[](0),
                new CurrencyType[](0),
                new address[](0),
                new uint256[](0),
                new uint256[](0)
            );
        }
        if ( !targetLogs[_target].isSet ) {
            targetLogs[_target] = TargetLogs(
                true,
                new EventType[](0),
                new CurrencyType[](0),
                new address[](0),
                new uint256[](0),
                new uint256[](0)
            );
        }

        // Record user log
        userLogs[_sender].eventType.push(_eventType);
        userLogs[_sender].currencyType.push(_currencyType);
        userLogs[_sender].target.push(_target);
        userLogs[_sender].amountFrom.push(_paidAmount);
        userLogs[_sender].amountTo.push(_receivedAmount);

        // Record target log
        targetLogs[_target].eventType.push(_eventType);
        targetLogs[_target].currencyType.push(_currencyType);
        targetLogs[_target].sender.push(_sender);
        targetLogs[_target].amountFrom.push(_paidAmount);
        targetLogs[_target].amountTo.push(_receivedAmount);
    }

    function getTargetLogs(address _target)
        public view returns(EventType[], CurrencyType[], address[], uint256[], uint256[])
    {
        return (
            targetLogs[_target].eventType,
            targetLogs[_target].currencyType,
            targetLogs[_target].sender,
            targetLogs[_target].amountFrom,
            targetLogs[_target].amountTo
        );
    }

    function getUserLogs(address _sender)
        public view returns(EventType[], CurrencyType[], address[], uint256[], uint256[])
    {
        return (
            userLogs[_sender].eventType,
            userLogs[_sender].currencyType,
            userLogs[_sender].target,
            userLogs[_sender].amountFrom,
            userLogs[_sender].amountTo
        );
    }

}
