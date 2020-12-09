// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/CheckpointStore.sol";
import "./TestTime.sol";

contract TestCheckpointStore is CheckpointStore, TestTime {
    function time() internal view virtual override(Time, TestTime) returns (uint256) {
        return TestTime.time();
    }
}
