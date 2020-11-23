// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/Time.sol";

contract TestTime is Time {
    uint256 public currentTime = 1;

    function time() public view virtual override returns (uint256) {
        return currentTime;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }
}
