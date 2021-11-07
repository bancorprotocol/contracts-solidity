// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../staking-rewards/StakingRewardsStore.sol";

import "./TestTime.sol";

contract TestStakingRewardsStore is StakingRewardsStore, TestTime {
    function _time() internal view override(Time, TestTime) returns (uint256) {
        return TestTime._time();
    }
}
