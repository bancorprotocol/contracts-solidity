pragma solidity ^0.4.23;
import '../crowdsale/CrowdsaleController.sol';

/*
    Test crowdsale controller with start time < now < end time
*/
contract TestCrowdsaleController is CrowdsaleController {
    uint256 public constant BTCS_ETHER_CAP_SMALL = 2 ether; // maximum bitcoin suisse ether contribution

    constructor(
        ISmartToken _token,
        uint256 _startTime,
        address _beneficiary,
        address _btcs,
        bytes32 _realEtherCapHash,
        uint256 _startTimeOverride)
        public
        CrowdsaleController(_token, _startTime, _beneficiary, _btcs, _realEtherCapHash)
    {
        startTime = _startTimeOverride;
        endTime = startTime + DURATION;
    }

    modifier btcsEtherCapNotReached(uint256 _ethContribution) {
        assert(safeAdd(totalEtherContributed, _ethContribution) <= BTCS_ETHER_CAP_SMALL);
        _;
    }
}
