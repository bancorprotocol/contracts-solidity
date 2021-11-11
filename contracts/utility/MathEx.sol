// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
 * @dev This library provides a set of complex math operations.
 */
library MathEx {
    uint256 private constant MAX_EXP_BIT_LEN = 4;
    uint256 private constant MAX_EXP = 2**MAX_EXP_BIT_LEN - 1;
    uint256 private constant MAX_UINT256 = uint256(-1);

    /**
     * @dev returns the largest integer smaller than or equal to the square root of a positive integer
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
     */
    function ceilSqrt(uint256 num) internal pure returns (uint256) {
        uint256 x = floorSqrt(num);

        return x * x == num ? x : x + 1;
    }

    /**
     * @dev computes the product of two given ratios
     */
    function productRatio(
        uint256 xn,
        uint256 yn,
        uint256 xd,
        uint256 yd
    ) internal pure returns (uint256, uint256) {
        uint256 n = mulDivC(xn, yn, MAX_UINT256);
        uint256 d = mulDivC(xd, yd, MAX_UINT256);
        uint256 z = n > d ? n : d;
        if (z > 1) {
            return (mulDivC(xn, yn, z), mulDivC(xd, yd, z));
        }
        return (xn * yn, xd * yd);
    }

    /**
     * @dev computes a reduced-scalar ratio
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
        uint256 maxVal = MAX_UINT256 / scale;
        if (a > maxVal) {
            uint256 c = a / (maxVal + 1) + 1;
            a /= c; // we can now safely compute `a * scale`
            b /= c;
        }
        if (a != b) {
            uint256 newN = a * scale;
            uint256 newD = unsafeAdd(a, b); // can overflow
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
     *
     * note the computation is overflow-safe assuming that the input is sufficiently small
     */
    function roundDivUnsafe(uint256 n, uint256 d) internal pure returns (uint256) {
        return (n + d / 2) / d;
    }

    /**
     * @dev returns the largest integer smaller than or equal to `x * y / z`
     */
    function mulDivF(
        uint256 x,
        uint256 y,
        uint256 z
    ) internal pure returns (uint256) {
        (uint256 xyh, uint256 xyl) = mul512(x, y);

        // if `x * y < 2 ^ 256`
        if (xyh == 0) {
            return xyl / z;
        }

        // assert `x * y / z < 2 ^ 256`
        require(xyh < z, "ERR_OVERFLOW");

        uint256 m = mulMod(x, y, z); // `m = x * y % z`
        (uint256 nh, uint256 nl) = sub512(xyh, xyl, m); // `n = x * y - m` hence `n / z = floor(x * y / z)`

        // if `n < 2 ^ 256`
        if (nh == 0) {
            return nl / z;
        }

        uint256 p = unsafeSub(0, z) & z; // `p` is the largest power of 2 which `z` is divisible by
        uint256 q = div512(nh, nl, p); // `n` is divisible by `p` because `n` is divisible by `z` and `z` is divisible by `p`
        uint256 r = inv256(z / p); // `z / p = 1 mod 2` hence `inverse(z / p) = 1 mod 2 ^ 256`
        return unsafeMul(q, r); // `q * r = (n / p) * inverse(z / p) = n / z`
    }

    /**
     * @dev returns the smallest integer larger than or equal to `x * y / z`
     */
    function mulDivC(
        uint256 x,
        uint256 y,
        uint256 z
    ) internal pure returns (uint256) {
        uint256 w = mulDivF(x, y, z);
        if (mulMod(x, y, z) > 0) {
            require(w < MAX_UINT256, "ERR_OVERFLOW");
            return w + 1;
        }
        return w;
    }

    /**
     * @dev returns the value of `x * y` as a pair of 256-bit values
     */
    function mul512(uint256 x, uint256 y) private pure returns (uint256, uint256) {
        uint256 p = mulModMax(x, y);
        uint256 q = unsafeMul(x, y);
        if (p >= q) {
            return (p - q, q);
        }
        return (unsafeSub(p, q) - 1, q);
    }

    /**
     * @dev returns the value of `2 ^ 256 * xh + xl - y`, where `2 ^ 256 * xh + xl >= y`
     */
    function sub512(
        uint256 xh,
        uint256 xl,
        uint256 y
    ) private pure returns (uint256, uint256) {
        if (xl >= y) {
            return (xh, xl - y);
        }
        return (xh - 1, unsafeSub(xl, y));
    }

    /**
     * @dev returns the value of `(2 ^ 256 * xh + xl) / pow2n`, where `xl` is divisible by `pow2n`
     */
    function div512(
        uint256 xh,
        uint256 xl,
        uint256 pow2n
    ) private pure returns (uint256) {
        uint256 pow2nInv = unsafeAdd(unsafeSub(0, pow2n) / pow2n, 1); // `1 << (256 - n)`
        return unsafeMul(xh, pow2nInv) | (xl / pow2n); // `(xh << (256 - n)) | (xl >> n)`
    }

    /**
     * @dev returns the inverse of `d` modulo `2 ^ 256`, where `d` is congruent to `1` modulo `2`
     */
    function inv256(uint256 d) private pure returns (uint256) {
        // approximate the root of `f(x) = 1 / x - d` using the newton–raphson convergence method
        uint256 x = 1;
        for (uint256 i = 0; i < 8; ++i) {
            x = unsafeMul(x, unsafeSub(2, unsafeMul(x, d))); // `x = x * (2 - x * d) mod 2 ^ 256`
        }
        return x;
    }

    /**
     * @dev returns `(x + y) % 2 ^ 256`
     */
    function unsafeAdd(uint256 x, uint256 y) private pure returns (uint256) {
        return x + y;
    }

    /**
     * @dev returns `(x - y) % 2 ^ 256`
     */
    function unsafeSub(uint256 x, uint256 y) private pure returns (uint256) {
        return x - y;
    }

    /**
     * @dev returns `(x * y) % 2 ^ 256`
     */
    function unsafeMul(uint256 x, uint256 y) private pure returns (uint256) {
        return x * y;
    }

    /**
     * @dev returns `x * y % (2 ^ 256 - 1)`
     */
    function mulModMax(uint256 x, uint256 y) private pure returns (uint256) {
        return mulmod(x, y, MAX_UINT256);
    }

    /**
     * @dev returns `x * y % z`
     */
    function mulMod(
        uint256 x,
        uint256 y,
        uint256 z
    ) private pure returns (uint256) {
        return mulmod(x, y, z);
    }
}
