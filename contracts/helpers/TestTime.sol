// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/Time.sol";

contract TestTime is Time {
    uint256 private _currentTime = 1;

    function _time() internal view virtual override returns (uint256) {
        return _currentTime;
    }

    function setTime(uint256 newCurrentTime) public {
        _currentTime = newCurrentTime;
    }

    function currentTime() external view returns (uint256) {
        return _currentTime;
    }
}
