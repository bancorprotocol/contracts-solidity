// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "./SafeMath.sol";

/**
  * @dev Library for complex math operations
*/
library Math {
    using SafeMath for uint256;

    /**
      * @dev returns the largest integer smaller than or equal to the square root of a positive integer
      *
      * @param _num a positive integer
      *
      * @return the largest integer smaller than or equal to the square root of the positive integer
    */
    function floorSqrt(uint256 _num) internal pure returns (uint256) {
        uint256 x = _num / 2 + 1;
        uint256 y = (x + _num / x) / 2;
        while (x > y) {
            x = y;
            y = (x + _num / x) / 2;
        }
        return x;
    }

    /**
      * @dev computes a reduced-scalar ratio
      *
      * @param _n   ratio numerator
      * @param _d   ratio denominator
      * @param _max maximum desired scalar
      *
      * @return ratio's numerator and denominator
    */
    function reducedRatio(uint256 _n, uint256 _d, uint256 _max) internal pure returns (uint256, uint256) {
        if (_n > _max || _d > _max)
            return normalizedRatio(_n, _d, _max);
        return (_n, _d);
    }

    /**
      * @dev computes "scale * a / (a + b)" and "scale * b / (a + b)".
    */
    function normalizedRatio(uint256 _a, uint256 _b, uint256 _scale) internal pure returns (uint256, uint256) {
        if (_a == _b)
            return (_scale / 2, _scale / 2);
        if (_a < _b)
            return accurateRatio(_a, _b, _scale);
        (uint256 y, uint256 x) = accurateRatio(_b, _a, _scale);
        return (x, y);
    }

    /**
      * @dev computes "scale * a / (a + b)" and "scale * b / (a + b)", assuming that "a < b".
    */
    function accurateRatio(uint256 _a, uint256 _b, uint256 _scale) internal pure returns (uint256, uint256) {
        uint256 maxVal = uint256(-1) / _scale;
        if (_a > maxVal) {
            uint256 c = _a / (maxVal + 1) + 1;
            _a /= c;
            _b /= c;
        }
        uint256 x = roundDiv(_a * _scale, _a.add(_b));
        uint256 y = _scale - x;
        return (x, y);
    }

    /**
      * @dev computes the nearest integer to a given quotient without overflowing or underflowing.
    */
    function roundDiv(uint256 _n, uint256 _d) internal pure returns (uint256) {
        return _n / _d + _n % _d / (_d - _d / 2);
    }
}
