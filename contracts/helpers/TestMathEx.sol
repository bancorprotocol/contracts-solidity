// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/MathEx.sol";

contract TestMathEx {
    using MathEx for *;

    function floorSqrtTest(uint256 _num) external pure returns (uint256) {
        return MathEx.floorSqrt(_num);
    }

    function ceilSqrtTest(uint256 _num) external pure returns (uint256) {
        return MathEx.ceilSqrt(_num);
    }

    function poweredRatioTest(
        uint256 _n,
        uint256 _d,
        uint256 _exp
    ) external pure returns (uint256, uint256) {
        return MathEx.poweredRatio(_n, _d, _exp);
    }

    function reducedRatioTest(
        uint256 _n,
        uint256 _d,
        uint256 _max
    ) external pure returns (uint256, uint256) {
        return MathEx.reducedRatio(_n, _d, _max);
    }

    function normalizedRatioTest(
        uint256 _a,
        uint256 _b,
        uint256 _scale
    ) external pure returns (uint256, uint256) {
        return MathEx.normalizedRatio(_a, _b, _scale);
    }

    function accurateRatioTest(
        uint256 _a,
        uint256 _b,
        uint256 _scale
    ) external pure returns (uint256, uint256) {
        return MathEx.accurateRatio(_a, _b, _scale);
    }

    function roundDivTest(uint256 _n, uint256 _d) external pure returns (uint256) {
        return MathEx.roundDiv(_n, _d);
    }

    function geometricMeanTest(uint256[] memory _values) external pure returns (uint256) {
        return MathEx.geometricMean(_values);
    }

    function decimalLengthTest(uint256 _x) external pure returns (uint256) {
        return MathEx.decimalLength(_x);
    }

    function roundDivUnsafeTest(uint256 _n, uint256 _d) external pure returns (uint256) {
        return MathEx.roundDivUnsafe(_n, _d);
    }
}
