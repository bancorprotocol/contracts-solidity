// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/TokenTimeWeightedAverage.sol";
import "./TestTime.sol";

contract TestTokenTimeWeightedAverage is TokenTimeWeightedAverage, TestTime {
    function timeWeightedAverageEx(
        IERC20Token _token,
        uint256 _startTime,
        uint256 _endTime
    ) external view returns (uint256, uint256) {
        return this.timeWeightedAverage(_token, _startTime, _endTime);
    }

    function time() public view virtual override(Time, TestTime) returns (uint256) {
        return TestTime.time();
    }
}
