// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./interfaces/IVortexStats.sol";

import "../utility/Owned.sol";

/**
 * @dev This contract aggregates the statistics of the vortex mechanism.
 */
contract VortexStats is IVortexStats, Owned {
    using SafeMath for uint256;

    // stores the total amount of the burned governance tokens
    uint256 private _totalBurnedAmount;

    // stores the time of the last vortex
    uint256 private _lastVortexTime;

    /**
     * @dev returns the total amount of the burned governance tokens
     *
     * @return total amount of the burned governance tokens
     */
    function totalBurnedAmount() external view override returns (uint256) {
        return _totalBurnedAmount;
    }

    /**
     * @dev increases total amount of the burned governance tokens
     *
     * @param amount the newly burned amount
     */
    function incTotalBurnedAmount(uint256 amount) external override ownerOnly {
        _totalBurnedAmount = _totalBurnedAmount.add(amount);
    }

    /**
     * @dev returns the time of the last vortex
     *
     * @return time of the last vortex
     */
    function lastVortexTime() external view override returns (uint256) {
        return _lastVortexTime;
    }

    /**
     * @dev sets the time of the last vortex
     *
     * @param time the time of the last vortex
     */
    function setLastVortexTime(uint256 time) external override ownerOnly {
        _lastVortexTime = time;
    }
}
