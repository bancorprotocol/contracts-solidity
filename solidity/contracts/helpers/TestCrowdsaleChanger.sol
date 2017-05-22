pragma solidity ^0.4.11;
import '../CrowdsaleChanger.sol';

/*
    Test crowdsale token with start time < now < end time
*/
contract TestCrowdsaleChanger is CrowdsaleChanger {
    function TestCrowdsaleChanger(
        ISmartToken _token,
        IEtherToken _etherToken,
        uint256 _startTime,
        address _beneficiary,
        address _btcs,
        bytes32 _realEtherCapHash,
        uint256 _startTimeOverride)
        CrowdsaleChanger(_token, _etherToken, _startTime, _beneficiary, _btcs, _realEtherCapHash)
    {
        startTime = _startTimeOverride;
        endTime = startTime + DURATION;
    }
}
