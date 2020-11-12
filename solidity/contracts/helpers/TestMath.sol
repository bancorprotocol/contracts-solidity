// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../utility/Math.sol";

contract TestMath {
    using Math for *;

    function floorSqrtTest(uint256 _num) external pure returns (uint256) {
        return Math.floorSqrt(_num);
    }

    function ceilSqrtTest(uint256 _num) external pure returns (uint256) {
        return Math.ceilSqrt(_num);
    }

    function reducedRatioTest(
        uint256 _n,
        uint256 _d,
        uint256 _max
    ) external pure returns (uint256, uint256) {
        return Math.reducedRatio(_n, _d, _max);
    }

    function normalizedRatioTest(
        uint256 _a,
        uint256 _b,
        uint256 _scale
    ) external pure returns (uint256, uint256) {
        return Math.normalizedRatio(_a, _b, _scale);
    }

    function accurateRatioTest(
        uint256 _a,
        uint256 _b,
        uint256 _scale
    ) external pure returns (uint256, uint256) {
        return Math.accurateRatio(_a, _b, _scale);
    }

    function roundDivTest(uint256 _n, uint256 _d) external pure returns (uint256) {
        return Math.roundDiv(_n, _d);
    }

    function geometricMeanTest(uint256[] memory _values) external pure returns (uint256) {
        return Math.geometricMean(_values);
    }

    function decimalLengthTest(uint256 _x) external pure returns (uint256) {
        return Math.decimalLength(_x);
    }

    function roundDivUnsafeTest(uint256 _n, uint256 _d) external pure returns (uint256) {
        return Math.roundDivUnsafe(_n, _d);
    }
}
