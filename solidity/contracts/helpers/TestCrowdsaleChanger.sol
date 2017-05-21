pragma solidity ^0.4.10;
import '../CrowdsaleChanger.sol';

/*
    Test crowdsale token with start time < now < end time
*/
contract TestCrowdsaleChanger is CrowdsaleChanger {
    function TestCrowdsaleChanger(ISmartToken _token, IEtherToken _etherToken, uint256 _startTime, address _beneficiary, address _btcs, bytes32 _realEtherCapHash)
        CrowdsaleChanger(_token, _etherToken, _startTime, _beneficiary, _btcs, _realEtherCapHash)
    {
        startTime = now - 3600;
        endTime = startTime + DURATION;
    }
}
