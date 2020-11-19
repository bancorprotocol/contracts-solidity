// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/TokenTimeWeightedAverage.sol";
import "./TestTime.sol";

contract TestTokenTimeWeightedAverage is TokenTimeWeightedAverage, TestTime {
    function time() public view virtual override(Time, TestTime) returns (uint256) {
        return TestTime.time();
    }
}
