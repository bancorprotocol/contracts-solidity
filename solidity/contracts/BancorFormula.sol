pragma solidity ^0.4.11;
import './Utils.sol';
import './interfaces/IBancorFormula.sol';

contract BancorFormula is IBancorFormula, Utils {

    string public version = '0.2';

    uint256 constant ONE = 1;
    uint256 constant TWO = 2;

    uint8 constant MIN_PRECISION = 32;
    uint8 constant MAX_PRECISION = 127;

    /**
        The values below depend on MIN_PRECISION. If you choose to change it:
        Apply the same change in file 'PrintExpScalingFactors.py', run it and paste the printed results below.
    */
    uint256 constant SCALED_EXP_0P5 = 0x1a61298e1;
    uint256 constant SCALED_VAL_0P5 = 0x80000000;
    uint256 constant SCALED_EXP_1P0 = 0x2b7e15162;
    uint256 constant SCALED_VAL_1P0 = 0x100000000;
    uint256 constant SCALED_EXP_2P0 = 0x763992e35;
    uint256 constant SCALED_VAL_2P0 = 0x200000000;
    uint256 constant SCALED_EXP_3P0 = 0x1415e5bf6f;
    uint256 constant SCALED_VAL_3P0 = 0x300000000;

    /**
        The values below depend on MIN_PRECISION and MAX_PRECISION. If you choose to change either one of them:
        Apply the same change in file 'PrintLn2ScalingFactors.py', run it and paste the printed results below.
    */
    uint256 constant CEILING_LN2_MANTISSA = 0xb17217f8;
    uint256 constant FLOOR_LN2_MANTISSA   = 0x2c5c85fdf473de6af278ece600fcbda;
    uint8   constant FLOOR_LN2_EXPONENT   = 122;

    /**
        The values below depend on MIN_PRECISION and MAX_PRECISION. If you choose to change either one of them:
        Apply the same change in file 'PrintFunctionBancorFormula.py', run it and paste the printed results below.
    */
    uint256[128] maxExpArray;
    function BancorFormula() {
    //  maxExpArray[  0] = 0xc1;
    //  maxExpArray[  1] = 0x17a;
    //  maxExpArray[  2] = 0x2e5;
    //  maxExpArray[  3] = 0x5ab;
    //  maxExpArray[  4] = 0xb1b;
    //  maxExpArray[  5] = 0x15bf;
    //  maxExpArray[  6] = 0x2a0c;
    //  maxExpArray[  7] = 0x50a2;
    //  maxExpArray[  8] = 0x9aa2;
    //  maxExpArray[  9] = 0x1288c;
    //  maxExpArray[ 10] = 0x238b2;
    //  maxExpArray[ 11] = 0x4429a;
    //  maxExpArray[ 12] = 0x82b78;
    //  maxExpArray[ 13] = 0xfaadc;
    //  maxExpArray[ 14] = 0x1e0bb8;
    //  maxExpArray[ 15] = 0x399e96;
    //  maxExpArray[ 16] = 0x6e7f88;
    //  maxExpArray[ 17] = 0xd3e7a3;
    //  maxExpArray[ 18] = 0x1965fea;
    //  maxExpArray[ 19] = 0x30b5057;
    //  maxExpArray[ 20] = 0x5d681f3;
    //  maxExpArray[ 21] = 0xb320d03;
    //  maxExpArray[ 22] = 0x15784a40;
    //  maxExpArray[ 23] = 0x292c5bdd;
    //  maxExpArray[ 24] = 0x4ef57b9b;
    //  maxExpArray[ 25] = 0x976bd995;
    //  maxExpArray[ 26] = 0x122624e32;
    //  maxExpArray[ 27] = 0x22ce03cd5;
    //  maxExpArray[ 28] = 0x42beef808;
    //  maxExpArray[ 29] = 0x7ffffffff;
    //  maxExpArray[ 30] = 0xf577eded5;
    //  maxExpArray[ 31] = 0x1d6bd8b2eb;
        maxExpArray[ 32] = 0x386bfdba29;
        maxExpArray[ 33] = 0x6c3390ecc8;
        maxExpArray[ 34] = 0xcf8014760f;
        maxExpArray[ 35] = 0x18ded91f0e7;
        maxExpArray[ 36] = 0x2fb1d8fe082;
        maxExpArray[ 37] = 0x5b771955b36;
        maxExpArray[ 38] = 0xaf67a93bb50;
        maxExpArray[ 39] = 0x15060c256cb2;
        maxExpArray[ 40] = 0x285145f31ae5;
        maxExpArray[ 41] = 0x4d5156639708;
        maxExpArray[ 42] = 0x944620b0e70e;
        maxExpArray[ 43] = 0x11c592761c666;
        maxExpArray[ 44] = 0x2214d10d014ea;
        maxExpArray[ 45] = 0x415bc6d6fb7dd;
        maxExpArray[ 46] = 0x7d56e76777fc5;
        maxExpArray[ 47] = 0xf05dc6b27edad;
        maxExpArray[ 48] = 0x1ccf4b44bb4820;
        maxExpArray[ 49] = 0x373fc456c53bb7;
        maxExpArray[ 50] = 0x69f3d1c921891c;
        maxExpArray[ 51] = 0xcb2ff529eb71e4;
        maxExpArray[ 52] = 0x185a82b87b72e95;
        maxExpArray[ 53] = 0x2eb40f9f620fda6;
        maxExpArray[ 54] = 0x5990681d961a1ea;
        maxExpArray[ 55] = 0xabc25204e02828d;
        maxExpArray[ 56] = 0x14962dee9dc97640;
        maxExpArray[ 57] = 0x277abdcdab07d5a7;
        maxExpArray[ 58] = 0x4bb5ecca963d54ab;
        maxExpArray[ 59] = 0x9131271922eaa606;
        maxExpArray[ 60] = 0x116701e6ab0cd188d;
        maxExpArray[ 61] = 0x215f77c045fbe8856;
        maxExpArray[ 62] = 0x3ffffffffffffffff;
        maxExpArray[ 63] = 0x7abbf6f6abb9d087f;
        maxExpArray[ 64] = 0xeb5ec597592befbf4;
        maxExpArray[ 65] = 0x1c35fedd14b861eb04;
        maxExpArray[ 66] = 0x3619c87664579bc94a;
        maxExpArray[ 67] = 0x67c00a3b07ffc01fd6;
        maxExpArray[ 68] = 0xc6f6c8f8739773a7a4;
        maxExpArray[ 69] = 0x17d8ec7f04136f4e561;
        maxExpArray[ 70] = 0x2dbb8caad9b7097b91a;
        maxExpArray[ 71] = 0x57b3d49dda84556d6f6;
        maxExpArray[ 72] = 0xa830612b6591d9d9e61;
        maxExpArray[ 73] = 0x1428a2f98d728ae223dd;
        maxExpArray[ 74] = 0x26a8ab31cb8464ed99e1;
        maxExpArray[ 75] = 0x4a23105873875bd52dfd;
        maxExpArray[ 76] = 0x8e2c93b0e33355320ead;
        maxExpArray[ 77] = 0x110a688680a7530515f3e;
        maxExpArray[ 78] = 0x20ade36b7dbeeb8d79659;
        maxExpArray[ 79] = 0x3eab73b3bbfe282243ce1;
        maxExpArray[ 80] = 0x782ee3593f6d69831c453;
        maxExpArray[ 81] = 0xe67a5a25da41063de1495;
        maxExpArray[ 82] = 0x1b9fe22b629ddbbcdf8754;
        maxExpArray[ 83] = 0x34f9e8e490c48e67e6ab8b;
        maxExpArray[ 84] = 0x6597fa94f5b8f20ac16666;
        maxExpArray[ 85] = 0xc2d415c3db974ab32a5184;
        maxExpArray[ 86] = 0x175a07cfb107ed35ab61430;
        maxExpArray[ 87] = 0x2cc8340ecb0d0f520a6af58;
        maxExpArray[ 88] = 0x55e129027014146b9e37405;
        maxExpArray[ 89] = 0xa4b16f74ee4bb2040a1ec6c;
        maxExpArray[ 90] = 0x13bd5ee6d583ead3bd636b5c;
        maxExpArray[ 91] = 0x25daf6654b1eaa55fd64df5e;
        maxExpArray[ 92] = 0x4898938c9175530325b9d116;
        maxExpArray[ 93] = 0x8b380f3558668c46c91c49a2;
        maxExpArray[ 94] = 0x10afbbe022fdf442b2a522507;
        maxExpArray[ 95] = 0x1ffffffffffffffffffffffff;
        maxExpArray[ 96] = 0x3d5dfb7b55dce843f89a7dbcb;
        maxExpArray[ 97] = 0x75af62cbac95f7dfa3295ec26;
        maxExpArray[ 98] = 0xe1aff6e8a5c30f58221fbf899;
        maxExpArray[ 99] = 0x1b0ce43b322bcde4a56e8ada5a;
        maxExpArray[100] = 0x33e0051d83ffe00feb432b473b;
        maxExpArray[101] = 0x637b647c39cbb9d3d26c56e949;
        maxExpArray[102] = 0xbec763f8209b7a72b0afea0d31;
        maxExpArray[103] = 0x16ddc6556cdb84bdc8d12d22e6f;
        maxExpArray[104] = 0x2bd9ea4eed422ab6b7b072b029e;
        maxExpArray[105] = 0x54183095b2c8ececf30dd533d03;
        maxExpArray[106] = 0xa14517cc6b9457111eed5b8adf1;
        maxExpArray[107] = 0x13545598e5c23276ccf0ede68034;
        maxExpArray[108] = 0x2511882c39c3adea96fec2102329;
        maxExpArray[109] = 0x471649d87199aa990756806903c5;
        maxExpArray[110] = 0x88534434053a9828af9f37367ee6;
        maxExpArray[111] = 0x1056f1b5bedf75c6bcb2ce8aed428;
        maxExpArray[112] = 0x1f55b9d9ddff141121e70ebe0104e;
        maxExpArray[113] = 0x3c1771ac9fb6b4c18e229803dae82;
        maxExpArray[114] = 0x733d2d12ed20831ef0a4aead8c66d;
        maxExpArray[115] = 0xdcff115b14eedde6fc3aa5353f2e4;
        maxExpArray[116] = 0x1a7cf47248624733f355c5c1f0d1f1;
        maxExpArray[117] = 0x32cbfd4a7adc790560b3335687b89b;
        maxExpArray[118] = 0x616a0ae1edcba5599528c20605b3f6;
        maxExpArray[119] = 0xbad03e7d883f69ad5b0a186184e06b;
        maxExpArray[120] = 0x16641a07658687a905357ac0ebe198b;
        maxExpArray[121] = 0x2af09481380a0a35cf1ba02f36c6a56;
        maxExpArray[122] = 0x5258b7ba7725d902050f6360afddf96;
        maxExpArray[123] = 0x9deaf736ac1f569deb1b5ae3f36c130;
        maxExpArray[124] = 0x12ed7b32a58f552afeb26faf21deca06;
        maxExpArray[125] = 0x244c49c648baa98192dce88b42f53caf;
        maxExpArray[126] = 0x459c079aac334623648e24d17c74b3dc;
        maxExpArray[127] = 0x6ae67b5f2f528d5f3189036ee0f27453;
    }

    /**
        @dev given a token supply, reserve, CRR and a deposit amount (in the reserve token), calculates the return for a given change (in the main token)

        Formula:
        Return = _supply * ((1 + _depositAmount / _reserveBalance) ^ (_reserveRatio / 100) - 1)

        @param _supply             token total supply
        @param _reserveBalance     total reserve
        @param _reserveRatio       constant reserve ratio, 1-100
        @param _depositAmount      deposit amount, in reserve token

        @return purchase return amount
    */
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint8 _reserveRatio, uint256 _depositAmount) public constant returns (uint256) {
        // validate input
        require(_supply != 0 && _reserveBalance != 0 && _reserveRatio > 0 && _reserveRatio <= 100);

        // special case for 0 deposit amount
        if (_depositAmount == 0)
            return 0;

        uint256 baseN = safeAdd(_depositAmount, _reserveBalance);
        uint256 temp;

        // special case if the CRR = 100
        if (_reserveRatio == 100) {
            temp = safeMul(_supply, baseN) / _reserveBalance;
            return safeSub(temp, _supply);
        }

        uint8 precision = calculateBestPrecision(baseN, _reserveBalance, _reserveRatio, 100);
        uint256 resN = power(baseN, _reserveBalance, _reserveRatio, 100, precision);
        temp = safeMul(_supply, resN) >> precision;
        return safeSub(temp, _supply);
     }

    /**
        @dev given a token supply, reserve, CRR and a sell amount (in the main token), calculates the return for a given change (in the reserve token)

        Formula:
        Return = _reserveBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_reserveRatio / 100)))

        @param _supply             token total supply
        @param _reserveBalance     total reserve
        @param _reserveRatio       constant reserve ratio, 1-100
        @param _sellAmount         sell amount, in the token itself

        @return sale return amount
    */
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint8 _reserveRatio, uint256 _sellAmount) public constant returns (uint256) {
        // validate input
        require(_supply != 0 && _reserveBalance != 0 && _reserveRatio > 0 && _reserveRatio <= 100 && _sellAmount <= _supply);

        // special case for 0 sell amount
        if (_sellAmount == 0)
            return 0;

        uint256 baseD = safeSub(_supply, _sellAmount);
        uint256 temp1;
        uint256 temp2;

        // special case if the CRR = 100
        if (_reserveRatio == 100) {
            temp1 = safeMul(_reserveBalance, _supply);
            temp2 = safeMul(_reserveBalance, baseD);
            return safeSub(temp1, temp2) / _supply;
        }

        // special case for selling the entire supply
        if (_sellAmount == _supply)
            return _reserveBalance;

        uint8 precision = calculateBestPrecision(_supply, baseD, 100, _reserveRatio);
        uint256 resN = power(_supply, baseD, 100, _reserveRatio, precision);
        temp1 = safeMul(_reserveBalance, resN);
        temp2 = safeMul(_reserveBalance, ONE << precision);
        return safeSub(temp1, temp2) / resN;
    }

    /**
        Predicts the highest precision which can be used in order to compute "base ^ exp" without exceeding 256 bits in any of the intermediate computations.
        Instead of calculating "base ^ exp", we calculate "e ^ (ln(base) * exp)".
        The value of "ln(base)" is represented with an integer slightly smaller than "ln(base) * 2 ^ precision".
        The larger "precision" is, the more accurately this value represents the real value.
        However, the larger "precision" is, the more bits are required in order to store this value.
        And the exponentiation function, which takes "x" and calculates "e ^ x", is limited to a maximum exponent (maximum value of "x").
        This maximum exponent depends on the precision used ("maxExpArray" maps each precision between 0 and 127 to its maximum exponent).
        Hence before calling the exponentiation function, we need to determine the highest precision which can be used.
        We do this by estimating an upper-bound for "ln(base) * exp", and then choosing the highest precision which this value is permitted for.
        Of course, we should later assert that the actual value representing "ln(base) * exp" is indeed not larger than the maximum exponent of the chosen precision.
        We can bring accuracy to a maximum by replacing "lnUpperBound(_baseN, _baseD)" with "ln(_baseN, _baseD, MIN_PRECISION) + 1".
        This, however, will impact performance, so we will need to establish a more efficient (less accurate) implementation of "ln".
        Note that the outcome of this function only affects the accuracy of the computation of "base ^ exp".
        Therefore, we do not need to assert that no intermediate result exceeds 256 bits (nor in this function, neither in any of the functions down the calling tree).
    */
    function calculateBestPrecision(uint256 _baseN, uint256 _baseD, uint256 _expN, uint256 _expD) internal constant returns (uint8) {
        uint256 maxVal = lnUpperBound(_baseN, _baseD) * _expN;
        uint8 lo = MIN_PRECISION;
        uint8 hi = MAX_PRECISION;
        while (lo + 1 < hi) {
            uint8 mid = (lo + hi) / 2;
            if ((maxVal << (mid - MIN_PRECISION)) / _expD <= maxExpArray[mid])
                lo = mid;
            else
                hi = mid;
        }
        if ((maxVal << (hi - MIN_PRECISION)) / _expD <= maxExpArray[hi])
            return hi;
        else
            return lo;
    }

    /**
        Calculates an integer approximation of "(_baseN / _baseD) ^ (_expN / _expD) * 2 ^ _precision".
        This method is overflow-safe.
    */
    function power(uint256 _baseN, uint256 _baseD, uint256 _expN, uint256 _expD, uint8 _precision) internal constant returns (uint256) {
        uint256 logbase = ln(_baseN, _baseD, _precision);
        return fixedExp(safeMul(logbase, _expN) / _expD, _precision);
    }

    /**
        Returns floor(ln(numerator / denominator) * 2 ^ precision)

        Ranges:
            precision   between MIN_PRECISION and MAX_PRECISION
            numerator   between 1             and 2 ^ (256 - MIN_PRECISION) - 1
            denominator between 1             and 2 ^ (256 - MIN_PRECISION) - 1
            output      between 0             and floor(ln(2 ^ (256 - MAX_PRECISION) - 1) * 2 ^ MAX_PRECISION)

        This function asserts "0 < denominator <= numerator < 2 ^ (256 - precision)".
    */
    function ln(uint256 _numerator, uint256 _denominator, uint8 _precision) internal constant returns (uint256) {
        assert(0 < _denominator && _denominator <= _numerator && _numerator < (ONE << (256 - _precision)));
        return fixedLoge( (_numerator << _precision) / _denominator, _precision);
    }

    /**
        Takes a rational number "numerator / denominator" as input.
        Returns an integer upper-bound of the natural logarithm of the input scaled by "2 ^ MIN_PRECISION".
        We do this by calculating "Ceiling(log2(numerator / denominator)) * Ceiling(ln(2) * 2 ^ MIN_PRECISION)".
        For small values of "numerator / denominator", this sometimes yields a bad upper-bound approximation.
        We therefore cover these cases (and a few more) manually.
        This function assumes "0 < denominator < numerator < 2 ^ (256 - MIN_PRECISION)".
    */
    function lnUpperBound(uint256 _numerator, uint256 _denominator) internal constant returns (uint256) {
        uint256 scaledNumerator = _numerator << MIN_PRECISION;

        if (scaledNumerator <= _denominator * SCALED_EXP_0P5) // _numerator / _denominator < e^0.5
            return SCALED_VAL_0P5;
        if (scaledNumerator <= _denominator * SCALED_EXP_1P0) // _numerator / _denominator < e^1.0
            return SCALED_VAL_1P0;
        if (scaledNumerator <= _denominator * SCALED_EXP_2P0) // _numerator / _denominator < e^2.0
            return SCALED_VAL_2P0;
        if (scaledNumerator <= _denominator * SCALED_EXP_3P0) // _numerator / _denominator < e^3.0
            return SCALED_VAL_3P0;

        return ceilLog2(_numerator, _denominator) * CEILING_LN2_MANTISSA;
    }

    /**
        Returns floor(ln(x / 2 ^ precision) * 2 ^ precision)
        Assumes x >= 2 ^ precision
    */
    function fixedLoge(uint256 _x, uint8 _precision) internal constant returns (uint256) {
        uint256 res = fixedLog2(_x, _precision);
        return (res * FLOOR_LN2_MANTISSA) >> FLOOR_LN2_EXPONENT;
    }

    /**
        Returns floor(log2(x / 2 ^ precision) * 2 ^ precision)
        Assumes x >= 2 ^ precision

        Ranges:
            precision between MIN_PRECISION     and MAX_PRECISION
            x         between 2 ^ MIN_PRECISION and (2 ^ (256 - MIN_PRECISION) - 1) * (2 ^ MIN_PRECISION)
            output    between 0                 and floor(log2(2 ^ (256 - MAX_PRECISION) - 1) * 2 ^ MAX_PRECISION)
    */
    function fixedLog2(uint256 _x, uint8 _precision) internal constant returns (uint256) {
        uint256 hi = 0;
        uint256 fixedOne = ONE << _precision;
        uint256 fixedTwo = TWO << _precision;

        // Here we compute the integer part of log2(x).
        // If x >= 2, then the integer part of log2(x) > 0.
        // We assume that x is not much greater than 2, and perform a simple bit-count.
        // If this is not the case, then we need to use floorLog2 for better performance.
        while (_x >= fixedTwo) {
            _x >>= 1;
            hi += fixedOne;
        }

        // At this point, knowing that 1 <= x < 2, we compute the fraction part of log2(x).
        for (uint8 i = 0; i < _precision; ++i) {
            _x = (_x * _x) / fixedOne; // now 1 <= x < 4
            if (_x >= fixedTwo) {
                _x >>= 1; // now 1 <= x < 2
                hi += ONE << (_precision - 1 - i);
            }
        }

        return hi;
    }

    /**
        Takes a rational number "numerator / denominator" as input.
        Returns the smallest integer larger than or equal to the binary logarithm of the input.
    */
    function ceilLog2(uint256 _numerator, uint256 _denominator) internal constant returns (uint256) {
        return floorLog2((_numerator - 1) / _denominator) + 1;
    }

    /**
        Takes a natural number "n" as input.
        Returns the largest integer smaller than or equal to the binary logarithm of the input.
    */
    function floorLog2(uint256 _n) internal constant returns (uint256) {
        uint8 t = 0;
        for (uint8 s = 128; s > 0; s >>= 1) {
            if (_n >= (ONE << s)) {
                _n >>= s;
                t |= s;
            }
        }

        return t;
    }

    /**
        fixedExp is a 'protected' version of fixedExpUnsafe, which asserts instead of overflows.
        The maximum value which can be passed to fixedExpUnsafe depends on the precision used.
        The global maxExpArray maps each precision between 0 and 127 to the maximum value permitted.
    */
    function fixedExp(uint256 _x, uint8 _precision) internal constant returns (uint256) {
        assert(_x <= maxExpArray[_precision]);
        return fixedExpUnsafe(_x, _precision);
    }

    /**
        This function can be auto-generated by the script 'PrintFunctionFixedExpUnsafe.py'.
        It approximates "e ^ x" via maclauren summation: "(x^0)/0! + (x^1)/1! + ... + (x^n)/n!".
        It returns "e ^ (x >> precision) << precision", that is, the result is upshifted for accuracy.
        The maximum permitted value for _x depends on the value of _precision (see maxExpArray).
    */
    function fixedExpUnsafe(uint256 _x, uint8 _precision) internal constant returns (uint256) {
        uint256 xi = _x;
        uint256 res = uint256(0xde1bc4d19efcac82445da75b00000000) << _precision;

        res += xi * 0xde1bc4d19efcac82445da75b00000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x6f0de268cf7e5641222ed3ad80000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x2504a0cd9a7f7215b60f9be480000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x9412833669fdc856d83e6f920000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x1d9d4d714865f4de2b3fafea0000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x4ef8ce836bba8cfb1dff2a70000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0xb481d807d1aa66d04490610000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x16903b00fa354cda08920c2000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x281cdaac677b334ab9e732000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x402e2aad725eb8778fd85000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x5d5a6c9f31fe2396a2af000000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x7c7890d442a82f73839400000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x9931ed54034526b58e400000;
        xi = (xi * _x) >> _precision;
        res += xi * 0xaf147cf24ce150cf7e00000;
        xi = (xi * _x) >> _precision;
        res += xi * 0xbac08546b867cdaa200000;
        xi = (xi * _x) >> _precision;
        res += xi * 0xbac08546b867cdaa20000;
        xi = (xi * _x) >> _precision;
        res += xi * 0xafc441338061b2820000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x9c3cabbc0056d790000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x839168328705c30000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x694120286c049c000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x50319e98b3d2c000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x3a52a1e36b82000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x289286e0fce000;
        xi = (xi * _x) >> _precision;
        res += xi * 0x1b0c59eb53400;
        xi = (xi * _x) >> _precision;
        res += xi * 0x114f95b55400;
        xi = (xi * _x) >> _precision;
        res += xi * 0xaa7210d200;
        xi = (xi * _x) >> _precision;
        res += xi * 0x650139600;
        xi = (xi * _x) >> _precision;
        res += xi * 0x39b78e80;
        xi = (xi * _x) >> _precision;
        res += xi * 0x1fd8080;
        xi = (xi * _x) >> _precision;
        res += xi * 0x10fbc0;
        xi = (xi * _x) >> _precision;
        res += xi * 0x8c40;
        xi = (xi * _x) >> _precision;
        res += xi * 0x462;
        xi = (xi * _x) >> _precision;
        res += xi * 0x22;

        return res / 0xde1bc4d19efcac82445da75b00000000;
    }
}
