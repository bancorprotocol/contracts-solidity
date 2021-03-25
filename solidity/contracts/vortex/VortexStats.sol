// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IVortexStats.sol";

import "../utility/Owned.sol";

contract VortexStats is IVortexStats, Owned {
    using SafeMath for uint256;

    uint256 private _totalBurnedAmount;
    uint256 private _lastVortexTime;

    function totalBurnedAmount() external view override returns (uint256) {
        return _totalBurnedAmount;
    }

    function incTotalBurnedAmount(uint256 amount) external override ownerOnly {
        _totalBurnedAmount = _totalBurnedAmount.add(amount);
    }

    function lastVortexTime() external view override returns (uint256) {
        return _lastVortexTime;
    }

    function setLastVortexTime(uint256 time) external override ownerOnly {
        _lastVortexTime = time;
    }
}
