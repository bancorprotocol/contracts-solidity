ONE = 1;

MIN_PRECISION = 32;
MAX_PRECISION = 127;

'''
    The values below depend on MAX_PRECISION. If you choose to change it:
    Apply the same change in file 'PrintIntScalingFactors.py', run it and paste the results below.
'''
FIXED_1 = 0x080000000000000000000000000000000;
FIXED_2 = 0x100000000000000000000000000000000;
MAX_NUM = 0x1ffffffffffffffffffffffffffffffff;

'''
    The values below depend on MAX_PRECISION. If you choose to change it:
    Apply the same change in file 'PrintLn2ScalingFactors.py', run it and paste the results below.
'''
LN2_MANTISSA = 0x2c5c85fdf473de6af278ece600fcbda;
LN2_EXPONENT = 122;

'''
    The values below depend on MIN_PRECISION and MAX_PRECISION. If you choose to change either one of them:
    Apply the same change in file 'PrintFunctionBancorFormula.py', run it and paste the results below.
'''
maxExpArray = [0] * 128;
def BancorFormula():
#   maxExpArray[  0] = 0x6080000000000000000000000000000000;
#   maxExpArray[  1] = 0x5e80000000000000000000000000000000;
#   maxExpArray[  2] = 0x5ca0000000000000000000000000000000;
#   maxExpArray[  3] = 0x5ab0000000000000000000000000000000;
#   maxExpArray[  4] = 0x58d8000000000000000000000000000000;
#   maxExpArray[  5] = 0x56fc000000000000000000000000000000;
#   maxExpArray[  6] = 0x5418000000000000000000000000000000;
#   maxExpArray[  7] = 0x50a2000000000000000000000000000000;
#   maxExpArray[  8] = 0x4d51000000000000000000000000000000;
#   maxExpArray[  9] = 0x4a23000000000000000000000000000000;
#   maxExpArray[ 10] = 0x4716400000000000000000000000000000;
#   maxExpArray[ 11] = 0x4429a00000000000000000000000000000;
#   maxExpArray[ 12] = 0x415bc00000000000000000000000000000;
#   maxExpArray[ 13] = 0x3eab700000000000000000000000000000;
#   maxExpArray[ 14] = 0x3c17700000000000000000000000000000;
#   maxExpArray[ 15] = 0x399e960000000000000000000000000000;
#   maxExpArray[ 16] = 0x373fc40000000000000000000000000000;
#   maxExpArray[ 17] = 0x34f9e8c000000000000000000000000000;
#   maxExpArray[ 18] = 0x32cbfd4000000000000000000000000000;
#   maxExpArray[ 19] = 0x30b5057000000000000000000000000000;
#   maxExpArray[ 20] = 0x2eb40f9800000000000000000000000000;
#   maxExpArray[ 21] = 0x2cc8340c00000000000000000000000000;
#   maxExpArray[ 22] = 0x2af0948000000000000000000000000000;
#   maxExpArray[ 23] = 0x292c5bdd00000000000000000000000000;
#   maxExpArray[ 24] = 0x277abdcd80000000000000000000000000;
#   maxExpArray[ 25] = 0x25daf66540000000000000000000000000;
#   maxExpArray[ 26] = 0x244c49c640000000000000000000000000;
#   maxExpArray[ 27] = 0x22ce03cd50000000000000000000000000;
#   maxExpArray[ 28] = 0x215f77c040000000000000000000000000;
#   maxExpArray[ 29] = 0x1ffffffffc000000000000000000000000;
#   maxExpArray[ 30] = 0x1eaefdbdaa000000000000000000000000;
#   maxExpArray[ 31] = 0x1d6bd8b2eb000000000000000000000000;
    maxExpArray[ 32] = 0x1c35fedd14800000000000000000000000;
    maxExpArray[ 33] = 0x1b0ce43b32000000000000000000000000;
    maxExpArray[ 34] = 0x19f0028ec1e00000000000000000000000;
    maxExpArray[ 35] = 0x18ded91f0e700000000000000000000000;
    maxExpArray[ 36] = 0x17d8ec7f04100000000000000000000000;
    maxExpArray[ 37] = 0x16ddc6556cd80000000000000000000000;
    maxExpArray[ 38] = 0x15ecf52776a00000000000000000000000;
    maxExpArray[ 39] = 0x15060c256cb20000000000000000000000;
    maxExpArray[ 40] = 0x1428a2f98d728000000000000000000000;
    maxExpArray[ 41] = 0x13545598e5c20000000000000000000000;
    maxExpArray[ 42] = 0x1288c4161ce1c000000000000000000000;
    maxExpArray[ 43] = 0x11c592761c666000000000000000000000;
    maxExpArray[ 44] = 0x110a688680a75000000000000000000000;
    maxExpArray[ 45] = 0x1056f1b5bedf7400000000000000000000;
    maxExpArray[ 46] = 0x0faadceceeff8a00000000000000000000;
    maxExpArray[ 47] = 0x0f05dc6b27edad00000000000000000000;
    maxExpArray[ 48] = 0x0e67a5a25da41000000000000000000000;
    maxExpArray[ 49] = 0x0dcff115b14eedc0000000000000000000;
    maxExpArray[ 50] = 0x0d3e7a3924312380000000000000000000;
    maxExpArray[ 51] = 0x0cb2ff529eb71e40000000000000000000;
    maxExpArray[ 52] = 0x0c2d415c3db974a8000000000000000000;
    maxExpArray[ 53] = 0x0bad03e7d883f698000000000000000000;
    maxExpArray[ 54] = 0x0b320d03b2c343d4000000000000000000;
    maxExpArray[ 55] = 0x0abc25204e02828d000000000000000000;
    maxExpArray[ 56] = 0x0a4b16f74ee4bb20000000000000000000;
    maxExpArray[ 57] = 0x09deaf736ac1f569c00000000000000000;
    maxExpArray[ 58] = 0x0976bd9952c7aa95600000000000000000;
    maxExpArray[ 59] = 0x09131271922eaa60600000000000000000;
    maxExpArray[ 60] = 0x08b380f3558668c4680000000000000000;
    maxExpArray[ 61] = 0x0857ddf0117efa21580000000000000000;
    maxExpArray[ 62] = 0x07fffffffffffffffe0000000000000000;
    maxExpArray[ 63] = 0x07abbf6f6abb9d087f0000000000000000;
    maxExpArray[ 64] = 0x075af62cbac95f7dfa0000000000000000;
    maxExpArray[ 65] = 0x070d7fb7452e187ac10000000000000000;
    maxExpArray[ 66] = 0x06c3390ecc8af379294000000000000000;
    maxExpArray[ 67] = 0x067c00a3b07ffc01fd6000000000000000;
    maxExpArray[ 68] = 0x0637b647c39cbb9d3d2000000000000000;
    maxExpArray[ 69] = 0x05f63b1fc104dbd3958400000000000000;
    maxExpArray[ 70] = 0x05b771955b36e12f723400000000000000;
    maxExpArray[ 71] = 0x057b3d49dda84556d6f600000000000000;
    maxExpArray[ 72] = 0x054183095b2c8ececf3080000000000000;
    maxExpArray[ 73] = 0x050a28be635ca2b888f740000000000000;
    maxExpArray[ 74] = 0x04d5156639708c9db33c20000000000000;
    maxExpArray[ 75] = 0x04a23105873875bd52dfd0000000000000;
    maxExpArray[ 76] = 0x0471649d87199aa9907568000000000000;
    maxExpArray[ 77] = 0x04429a21a029d4c1457cf8000000000000;
    maxExpArray[ 78] = 0x0415bc6d6fb7dd71af2cb2000000000000;
    maxExpArray[ 79] = 0x03eab73b3bbfe282243ce1000000000000;
    maxExpArray[ 80] = 0x03c1771ac9fb6b4c18e229800000000000;
    maxExpArray[ 81] = 0x0399e96897690418f78525400000000000;
    maxExpArray[ 82] = 0x0373fc456c53bb779bf0ea800000000000;
    maxExpArray[ 83] = 0x034f9e8e490c48e67e6ab8b00000000000;
    maxExpArray[ 84] = 0x032cbfd4a7adc790560b33300000000000;
    maxExpArray[ 85] = 0x030b50570f6e5d2acca946100000000000;
    maxExpArray[ 86] = 0x02eb40f9f620fda6b56c28600000000000;
    maxExpArray[ 87] = 0x02cc8340ecb0d0f520a6af580000000000;
    maxExpArray[ 88] = 0x02af09481380a0a35cf1ba028000000000;
    maxExpArray[ 89] = 0x0292c5bdd3b92ec810287b1b0000000000;
    maxExpArray[ 90] = 0x0277abdcdab07d5a77ac6d6b8000000000;
    maxExpArray[ 91] = 0x025daf6654b1eaa55fd64df5e000000000;
    maxExpArray[ 92] = 0x0244c49c648baa98192dce88b000000000;
    maxExpArray[ 93] = 0x022ce03cd5619a311b2471268800000000;
    maxExpArray[ 94] = 0x0215f77c045fbe885654a44a0e00000000;
    maxExpArray[ 95] = 0x01ffffffffffffffffffffffff00000000;
    maxExpArray[ 96] = 0x01eaefdbdaaee7421fc4d3ede580000000;
    maxExpArray[ 97] = 0x01d6bd8b2eb257df7e8ca57b0980000000;
    maxExpArray[ 98] = 0x01c35fedd14b861eb0443f7f1320000000;
    maxExpArray[ 99] = 0x01b0ce43b322bcde4a56e8ada5a0000000;
    maxExpArray[100] = 0x019f0028ec1fff007f5a195a39d8000000;
    maxExpArray[101] = 0x018ded91f0e72ee74f49b15ba524000000;
    maxExpArray[102] = 0x017d8ec7f04136f4e5615fd41a62000000;
    maxExpArray[103] = 0x016ddc6556cdb84bdc8d12d22e6f000000;
    maxExpArray[104] = 0x015ecf52776a1155b5bd8395814f000000;
    maxExpArray[105] = 0x015060c256cb23b3b3cc3754cf40c00000;
    maxExpArray[106] = 0x01428a2f98d728ae223ddab715be200000;
    maxExpArray[107] = 0x013545598e5c23276ccf0ede6803400000;
    maxExpArray[108] = 0x01288c4161ce1d6f54b7f6108119480000;
    maxExpArray[109] = 0x011c592761c666aa641d5a01a40f140000;
    maxExpArray[110] = 0x0110a688680a7530515f3e6e6cfdcc0000;
    maxExpArray[111] = 0x01056f1b5bedf75c6bcb2ce8aed4280000;
    maxExpArray[112] = 0x00faadceceeff8a0890f3875f008270000;
    maxExpArray[113] = 0x00f05dc6b27edad306388a600f6ba08000;
    maxExpArray[114] = 0x00e67a5a25da41063de1495d5b18cda000;
    maxExpArray[115] = 0x00dcff115b14eedde6fc3aa5353f2e4000;
    maxExpArray[116] = 0x00d3e7a3924312399f9aae2e0f868f8800;
    maxExpArray[117] = 0x00cb2ff529eb71e41582cccd5a1ee26c00;
    maxExpArray[118] = 0x00c2d415c3db974ab32a51840c0b67ec00;
    maxExpArray[119] = 0x00bad03e7d883f69ad5b0a186184e06b00;
    maxExpArray[120] = 0x00b320d03b2c343d4829abd6075f0cc580;
    maxExpArray[121] = 0x00abc25204e02828d73c6e80bcdb1a9580;
    maxExpArray[122] = 0x00a4b16f74ee4bb2040a1ec6c15fbbf2c0;
    maxExpArray[123] = 0x009deaf736ac1f569deb1b5ae3f36c1300;
    maxExpArray[124] = 0x00976bd9952c7aa957f5937d790ef65030;
    maxExpArray[125] = 0x009131271922eaa6064b73a22d0bd4f2bc;
    maxExpArray[126] = 0x008b380f3558668c46c91c49a2f8e967b8;
    maxExpArray[127] = 0x006ae67b5f2f528d5f3189036ee0f27453;

'''
    @dev given a token supply, reserve, CRR and a deposit amount (in the reserve token), calculates the return for a given change (in the main token)

    Formula:
    Return = _supply * ((1 + _depositAmount / _reserveBalance) ^ (_reserveRatio / 100) - 1)

    @param _supply             token total supply
    @param _reserveBalance     total reserve
    @param _reserveRatio       constant reserve ratio, 1-100
    @param _depositAmount      deposit amount, in reserve token

    @return purchase return amount
'''
def calculatePurchaseReturn(_supply, _reserveBalance, _reserveRatio, _depositAmount):
    # validate input
    assert(_supply != 0 and _reserveBalance != 0 and _reserveRatio > 0 and _reserveRatio <= 100);

    # special case for 0 deposit amount
    if (_depositAmount == 0):
        return 0;

    baseN = safeAdd(_depositAmount, _reserveBalance);

    # special case if the CRR = 100
    if (_reserveRatio == 100):
        temp = safeMul(_supply, baseN) / _reserveBalance;
        return safeSub(temp, _supply);

    (result, precision) = power(baseN, _reserveBalance, _reserveRatio, 100);
    temp = safeMul(_supply, result) >> precision;
    return safeSub(temp, _supply);

'''
    @dev given a token supply, reserve, CRR and a sell amount (in the main token), calculates the return for a given change (in the reserve token)

    Formula:
    Return = _reserveBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_reserveRatio / 100)))

    @param _supply             token total supply
    @param _reserveBalance     total reserve
    @param _reserveRatio       constant reserve ratio, 1-100
    @param _sellAmount         sell amount, in the token itself

    @return sale return amount
'''
def calculateSaleReturn(_supply, _reserveBalance, _reserveRatio, _sellAmount):
    # validate input
    assert(_supply != 0 and _reserveBalance != 0 and _reserveRatio > 0 and _reserveRatio <= 100 and _sellAmount <= _supply);

    # special case for 0 sell amount
    if (_sellAmount == 0):
        return 0;

    baseD = safeSub(_supply, _sellAmount);

    # special case if the CRR = 100
    if (_reserveRatio == 100):
        temp1 = safeMul(_reserveBalance, _supply);
        temp2 = safeMul(_reserveBalance, baseD);
        return safeSub(temp1, temp2) / _supply;

    # special case for selling the entire supply
    if (_sellAmount == _supply):
        return _reserveBalance;

    (result, precision) = power(_supply, baseD, 100, _reserveRatio);
    temp1 = safeMul(_reserveBalance, result);
    temp2 = safeMul(_reserveBalance, ONE << precision);
    return safeSub(temp1, temp2) / result;

'''
    General Description:
        Determine a value of precision.
        Calculate an integer approximation of (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision.
        Return the result along with the precision used.
    Detailed Description:
        Instead of calculating "base ^ exp", we calculate "e ^ (ln(base) * exp)".
        The value of "ln(base)" is represented with an integer slightly smaller than "ln(base) * 2 ^ precision".
        The larger "precision" is, the more accurately this value represents the real value.
        However, the larger "precision" is, the more bits are required in order to store this value.
        And the exponentiation function, which takes "x" and calculates "e ^ x", is limited to a maximum exponent (maximum value of "x").
        This maximum exponent depends on the precision used ("maxExpArray" maps each precision between 0 and 127 to its maximum exponent).
        Hence we need to determine the highest precision which can be used for the given input, before calling the exponentiation function.
        This allows us to compute "base ^ exp" with maximum accuracy and without exceeding 256 bits in any of the intermediate computations.
'''
def power(_baseN, _baseD, _expN, _expD):
    maxExp = safeMul(ln(_baseN, _baseD), _expN) / _expD;
    precision = findPositionInMaxExpArray(maxExp);
    return (fixedExp(maxExp >> (MAX_PRECISION - precision), precision), precision);

'''
    Return floor(ln(numerator / denominator) * 2 ^ MAX_PRECISION), where:
    - The numerator   is a value between 1 and 2 ^ (256 - MAX_PRECISION) - 1
    - The denominator is a value between 1 and 2 ^ (256 - MAX_PRECISION) - 1
    - The output      is a value between 0 and floor(ln(2 ^ (256 - MAX_PRECISION) - 1) * 2 ^ MAX_PRECISION)
    This functions asserts that the numerator is larger than or equal to the denominator, because the output would be negative otherwise.
'''
def ln(_numerator, _denominator):
    assert(1 <= _denominator and _denominator <= _numerator and _numerator <= MAX_NUM);

    res = 0;
    x = (_numerator * FIXED_1) / _denominator;

    # If x >= 2, then we compute the integer part of log2(x), which is larger than 0.
    if (x >= FIXED_2):
        count = floorLog2(x / FIXED_1);
        x >>= count; # now x < 2
        res = count * FIXED_1;

    # If x > 1, then we compute the fraction part of log2(x), which is larger than 0.
    if (x > FIXED_1):
        for i in range(MAX_PRECISION, 0, -1):
            x = (x * x) / FIXED_1; # now 1 < x < 4
            if (x >= FIXED_2):
                x >>= 1; # now 1 < x < 2
                res += ONE << (i - 1);

    return (res * LN2_MANTISSA) >> LN2_EXPONENT;

'''
    The global "maxExpArray" is sorted in descending order, and therefore the following statements are equivalent:
    - This function finds the position of [the smallest value in "maxExpArray" larger than or equal to "maxExp"]
    - This function finds the highest position of [a value in "maxExpArray" larger than or equal to "maxExp"]
'''
def findPositionInMaxExpArray(maxExp):
    lo = MIN_PRECISION;
    hi = MAX_PRECISION;
    while (lo + 1 < hi):
        mid = (lo + hi) / 2;
        if (maxExpArray[mid] >= maxExp):
            lo = mid;
        else:
            hi = mid;
    if (maxExpArray[hi] >= maxExp):
        return hi;
    else:
        return lo;

'''
    This function can be auto-generated by the script 'PrintFunctionFixedExp.py'.
    It approximates "e ^ x" via maclauren summation: "(x^0)/0! + (x^1)/1! + ... + (x^n)/n!".
    It returns "e ^ (x >> precision) << precision", that is, the result is upshifted for accuracy.
    The maximum permitted value for "x" is "maxExpArray[precision] >> (MAX_PRECISION - precision)".
'''
def fixedExp(_x, _precision):
    xi = _x;
    res = (0xde1bc4d19efcac82445da75b00000000) << _precision;

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

'''
    Compute the largest integer smaller than or equal to the binary logarithm of the input.
'''
def floorLog2(_n):
    res = 0;

    if (_n < 256):
        # At most 8 iterations
        while (_n > 1):
            _n >>= 1;
            res += 1;
    else:
        # Exactly 8 iterations
        for s in [1 << (8 - 1 - k) for k in range(8)]:
            if (_n >= (ONE << s)):
                _n >>= s;
                res |= s;

    return res;


def safeMul(x,y):
    assert(x * y < (1 << 256))
    return x * y


def safeAdd(x,y):
    assert(x + y < (1 << 256))
    return x + y


def safeSub(x,y):
    assert(x - y >= 0)
    return x - y


BancorFormula()
