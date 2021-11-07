// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../staking-rewards/StakingRewards.sol";

import "./TestStakingRewardsStore.sol";

import "./TestTime.sol";

contract TestStakingRewards is StakingRewards, TestTime {
    constructor(
        TestStakingRewardsStore store,
        ITokenGovernance networkTokenGovernance,
        ICheckpointStore lastRemoveTimes,
        IContractRegistry registry
    ) public StakingRewards(store, networkTokenGovernance, lastRemoveTimes, registry) {}

    function _time() internal view override(Time, TestTime) returns (uint256) {
        return TestTime._time();
    }

    function setStoreTime(uint256 currentTime) public {
        TestStakingRewardsStore(address(this.store())).setTime(currentTime);
    }
}
