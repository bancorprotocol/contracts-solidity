// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../utility/MathEx.sol";

contract TestMathEx {
    using MathEx for *;

    function floorSqrtTest(uint256 num) external pure returns (uint256) {
        return MathEx.floorSqrt(num);
    }

    function ceilSqrtTest(uint256 num) external pure returns (uint256) {
        return MathEx.ceilSqrt(num);
    }

    function productRatioTest(
        uint256 xn,
        uint256 yn,
        uint256 xd,
        uint256 yd
    ) external pure returns (uint256, uint256) {
        return MathEx.productRatio(xn, yn, xd, yd);
    }

    function reducedRatioTest(
        uint256 n,
        uint256 d,
        uint256 max
    ) external pure returns (uint256, uint256) {
        return MathEx.reducedRatio(n, d, max);
    }

    function normalizedRatioTest(
        uint256 a,
        uint256 b,
        uint256 scale
    ) external pure returns (uint256, uint256) {
        return MathEx.normalizedRatio(a, b, scale);
    }

    function accurateRatioTest(
        uint256 a,
        uint256 b,
        uint256 scale
    ) external pure returns (uint256, uint256) {
        return MathEx.accurateRatio(a, b, scale);
    }

    function roundDivTest(uint256 n, uint256 d) external pure returns (uint256) {
        return MathEx.roundDiv(n, d);
    }

    function geometricMeanTest(uint256[] calldata values) external pure returns (uint256) {
        return MathEx.geometricMean(values);
    }

    function decimalLengthTest(uint256 x) external pure returns (uint256) {
        return MathEx.decimalLength(x);
    }

    function roundDivUnsafeTest(uint256 n, uint256 d) external pure returns (uint256) {
        return MathEx.roundDivUnsafe(n, d);
    }

    function mulDivF(
        uint256 x,
        uint256 y,
        uint256 z
    ) external pure returns (uint256) {
        return MathEx.mulDivF(x, y, z);
    }

    function mulDivC(
        uint256 x,
        uint256 y,
        uint256 z
    ) external pure returns (uint256) {
        return MathEx.mulDivC(x, y, z);
    }
}
