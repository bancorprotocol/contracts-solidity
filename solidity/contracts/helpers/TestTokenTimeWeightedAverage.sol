// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/TokenTimeWeightedAverage.sol";

contract TestTokenTimeWeightedAverage is TokenTimeWeightedAverage {
    uint256 public currentTime = 1;

    constructor() public TokenTimeWeightedAverage() {}

    function time() internal view override returns (uint256) {
        return currentTime;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }
}
