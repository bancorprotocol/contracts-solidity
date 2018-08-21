pragma solidity ^0.4.18;
import './IFinancieLog.sol';
import '../Owned.sol';

contract FinancieLog is Owned, IFinancieLog {

    struct Log {
        bool isSet;
        uint[] timestamp;
        address[] sender;
        address[] target;
        EventType[] eventType;
        address[] from;
        address[] to;
        uint256[] amountFrom;
        uint256[] amountTo;
    }

    mapping (address => Log) senderLogs;
    mapping (address => Log) targetLogs;
    mapping (address => Log) fromLogs;
    mapping (address => Log) toLogs;

    function FinancieLog() public {

    }

    function() payable public {
        revert();
    }

    function recordLog(
        address _sender,
        address _target,
        EventType _eventType,
        address _from,
        address _to,
        uint256 _paidAmount,
        uint256 _receivedAmount)
        public
        ownerDelegatedOnly
    {
        if ( !senderLogs[_sender].isSet ) {
            senderLogs[_sender] = Log(
                true,
                new uint[](0),
                new address[](0),
                new address[](0),
                new EventType[](0),
                new address[](0),
                new address[](0),
                new uint256[](0),
                new uint256[](0)
            );
        }
        if ( !targetLogs[_target].isSet ) {
            targetLogs[_target] = Log(
                true,
                new uint[](0),
                new address[](0),
                new address[](0),
                new EventType[](0),
                new address[](0),
                new address[](0),
                new uint256[](0),
                new uint256[](0)
            );
        }
        if ( !fromLogs[_from].isSet ) {
            fromLogs[_from] = Log(
                true,
                new uint[](0),
                new address[](0),
                new address[](0),
                new EventType[](0),
                new address[](0),
                new address[](0),
                new uint256[](0),
                new uint256[](0)
            );
        }
        if ( !toLogs[_to].isSet ) {
            toLogs[_to] = Log(
                true,
                new uint[](0),
                new address[](0),
                new address[](0),
                new EventType[](0),
                new address[](0),
                new address[](0),
                new uint256[](0),
                new uint256[](0)
            );
        }

        // Record sender log
        senderLogs[_sender].timestamp.push(now);
        //senderLogs[_sender].sender.push(_sender);
        senderLogs[_sender].target.push(_target);
        senderLogs[_sender].eventType.push(_eventType);
        senderLogs[_sender].from.push(_from);
        senderLogs[_sender].to.push(_to);
        senderLogs[_sender].amountFrom.push(_paidAmount);
        senderLogs[_sender].amountTo.push(_receivedAmount);

        // Record target log
        targetLogs[_target].timestamp.push(now);
        targetLogs[_target].sender.push(_sender);
        //targetLogs[_target].target.push(_target);
        targetLogs[_target].eventType.push(_eventType);
        targetLogs[_target].from.push(_from);
        targetLogs[_target].to.push(_to);
        targetLogs[_target].amountFrom.push(_paidAmount);
        targetLogs[_target].amountTo.push(_receivedAmount);

        // Record from log
        fromLogs[_from].timestamp.push(now);
        fromLogs[_from].sender.push(_sender);
        fromLogs[_from].target.push(_target);
        fromLogs[_from].eventType.push(_eventType);
        //fromLogs[_from].from.push(_from);
        fromLogs[_from].to.push(_to);
        fromLogs[_from].amountFrom.push(_paidAmount);
        fromLogs[_from].amountTo.push(_receivedAmount);

        // Record to log
        toLogs[_to].timestamp.push(now);
        toLogs[_to].sender.push(_sender);
        toLogs[_to].target.push(_target);
        toLogs[_to].eventType.push(_eventType);
        toLogs[_to].from.push(_from);
        //toLogs[_to].to.push(_to);
        toLogs[_to].amountFrom.push(_paidAmount);
        toLogs[_to].amountTo.push(_receivedAmount);
    }

    function getTargetLogs(address _target)
        public view returns(uint[], address[], EventType[], address[], address[], uint256[], uint256[])
    {
        return (
            targetLogs[_target].timestamp,
            targetLogs[_target].sender,
            targetLogs[_target].eventType,
            targetLogs[_target].from,
            targetLogs[_target].to,
            targetLogs[_target].amountFrom,
            targetLogs[_target].amountTo
        );
    }

    function getSenderLogs(address _sender)
        public view returns(uint[], address[], EventType[], address[], address[], uint256[], uint256[])
    {
        return (
            senderLogs[_sender].timestamp,
            senderLogs[_sender].target,
            senderLogs[_sender].eventType,
            senderLogs[_sender].from,
            senderLogs[_sender].to,
            senderLogs[_sender].amountFrom,
            senderLogs[_sender].amountTo
        );
    }

    function getFromLogs(address _from)
        public view returns(uint[], address[], address[], EventType[], address[], uint256[], uint256[])
    {
        return (
            fromLogs[_from].timestamp,
            fromLogs[_from].sender,
            fromLogs[_from].target,
            fromLogs[_from].eventType,
            fromLogs[_from].to,
            fromLogs[_from].amountFrom,
            fromLogs[_from].amountTo
        );
    }

    function getToLogs(address _to)
        public view returns(uint[], address[], address[], EventType[], address[], uint256[], uint256[])
    {
        return (
            toLogs[_to].timestamp,
            toLogs[_to].sender,
            toLogs[_to].target,
            toLogs[_to].eventType,
            toLogs[_to].from,
            toLogs[_to].amountFrom,
            toLogs[_to].amountTo
        );
    }


}
