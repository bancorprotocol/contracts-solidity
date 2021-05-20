// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev This library provides a set of complex math operations.
 */
library MathEx {
    uint256 private constant MAX_EXP_BIT_LEN = 4;
    uint256 private constant MAX_EXP = 2**MAX_EXP_BIT_LEN - 1;
    uint256 private constant MAX_UINT128 = 2**128 - 1;

    /**
     * @dev returns the largest integer smaller than or equal to the square root of a positive integer
     *
     * @param num a positive integer
     *
     * @return the largest integer smaller than or equal to the square root of the positive integer
     */
    function floorSqrt(uint256 num) internal pure returns (uint256) {
        uint256 x = num / 2 + 1;
        uint256 y = (x + num / x) / 2;
        while (x > y) {
            x = y;
            y = (x + num / x) / 2;
        }
        return x;
    }

    /**
     * @dev returns the smallest integer larger than or equal to the square root of a positive integer
     *
     * @param num a positive integer
     *
     * @return the smallest integer larger than or equal to the square root of the positive integer
     */
    function ceilSqrt(uint256 num) internal pure returns (uint256) {
        uint256 x = floorSqrt(num);

        return x * x == num ? x : x + 1;
    }

    /**
     * @dev computes a powered ratio
     *
     * @param n ratio numerator
     * @param d ratio denominator
     * @param exp ratio exponent
     *
     * @return powered ratio's numerator and denominator
     */
    function poweredRatio(
        uint256 n,
        uint256 d,
        uint256 exp
    ) internal pure returns (uint256, uint256) {
        require(exp <= MAX_EXP, "ERR_EXP_TOO_LARGE");

        uint256[MAX_EXP_BIT_LEN] memory ns;
        uint256[MAX_EXP_BIT_LEN] memory ds;

        (ns[0], ds[0]) = reducedRatio(n, d, MAX_UINT128);
        for (uint256 i = 0; (exp >> i) > 1; ++i) {
            (ns[i + 1], ds[i + 1]) = reducedRatio(ns[i]**2, ds[i]**2, MAX_UINT128);
        }

        uint256 newN = 1;
        uint256 newD = 1;

        for (uint256 i = 0; (exp >> i) > 0; ++i) {
            if (((exp >> i) & 1) > 0) {
                (newN, newD) = reducedRatio(newN * ns[i], newD * ds[i], MAX_UINT128);
            }
        }

        return (newN, newD);
    }

    /**
     * @dev computes a reduced-scalar ratio
     *
     * @param n ratio numerator
     * @param d ratio denominator
     * @param max maximum desired scalar
     *
     * @return ratio's numerator and denominator
     */
    function reducedRatio(
        uint256 n,
        uint256 d,
        uint256 max
    ) internal pure returns (uint256, uint256) {
        (uint256 newN, uint256 newD) = (n, d);
        if (newN > max || newD > max) {
            (newN, newD) = normalizedRatio(newN, newD, max);
        }
        if (newN != newD) {
            return (newN, newD);
        }
        return (1, 1);
    }

    /**
     * @dev computes "scale * a / (a + b)" and "scale * b / (a + b)".
     */
    function normalizedRatio(
        uint256 a,
        uint256 b,
        uint256 scale
    ) internal pure returns (uint256, uint256) {
        if (a <= b) {
            return accurateRatio(a, b, scale);
        }
        (uint256 y, uint256 x) = accurateRatio(b, a, scale);
        return (x, y);
    }

    /**
     * @dev computes "scale * a / (a + b)" and "scale * b / (a + b)", assuming that "a <= b".
     */
    function accurateRatio(
        uint256 a,
        uint256 b,
        uint256 scale
    ) internal pure returns (uint256, uint256) {
        uint256 maxVal = uint256(-1) / scale;
        if (a > maxVal) {
            uint256 c = a / (maxVal + 1) + 1;
            a /= c; // we can now safely compute `a * scale`
            b /= c;
        }
        if (a != b) {
            uint256 newN = a * scale;
            uint256 newD = a + b; // can overflow
            if (newD >= a) {
                // no overflow in `a + b`
                uint256 x = roundDiv(newN, newD); // we can now safely compute `scale - x`
                uint256 y = scale - x;
                return (x, y);
            }
            if (newN < b - (b - a) / 2) {
                return (0, scale); // `a * scale < (a + b) / 2 < MAX_UINT256 < a + b`
            }
            return (1, scale - 1); // `(a + b) / 2 < a * scale < MAX_UINT256 < a + b`
        }
        return (scale / 2, scale / 2); // allow reduction to `(1, 1)` in the calling function
    }

    /**
     * @dev computes the nearest integer to a given quotient without overflowing or underflowing.
     */
    function roundDiv(uint256 n, uint256 d) internal pure returns (uint256) {
        return n / d + (n % d) / (d - d / 2);
    }

    /**
     * @dev returns the average number of decimal digits in a given list of positive integers
     *
     * @param values list of positive integers
     *
     * @return the average number of decimal digits in the given list of positive integers
     */
    function geometricMean(uint256[] memory values) internal pure returns (uint256) {
        uint256 numOfDigits = 0;
        uint256 length = values.length;
        for (uint256 i = 0; i < length; ++i) {
            numOfDigits += decimalLength(values[i]);
        }
        return uint256(10)**(roundDivUnsafe(numOfDigits, length) - 1);
    }

    /**
     * @dev returns the number of decimal digits in a given positive integer
     *
     * @param x positive integer
     *
     * @return the number of decimal digits in the given positive integer
     */
    function decimalLength(uint256 x) internal pure returns (uint256) {
        uint256 y = 0;
        for (uint256 tmpX = x; tmpX > 0; tmpX /= 10) {
            ++y;
        }
        return y;
    }

    /**
     * @dev returns the nearest integer to a given quotient
     * the computation is overflow-safe assuming that the input is sufficiently small
     *
     * @param n quotient numerator
     * @param d quotient denominator
     *
     * @return the nearest integer to the given quotient
     */
    function roundDivUnsafe(uint256 n, uint256 d) internal pure returns (uint256) {
        return (n + d / 2) / d;
    }
}
