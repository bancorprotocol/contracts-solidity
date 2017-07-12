MAX_FIXED_EXP_32 = 0x386bfdba29


'''*
    @dev Calculate (_baseN / _baseD) ^ (_expN / _expD)
    Returns result upshifted by PRECISION
    This method is overflow-safe
''' 
def power(_baseN, _baseD, _expN, _expD, PRECISION):
    logbase = ln(_baseN, _baseD, PRECISION)
    # Not using safeDiv here, since safeDiv protects against
    # precision loss. It's unavoidable, however
    # Both `ln` and `fixedExp` are overflow-safe. 
    resN = fixedExp(safeMul(logbase, _expN) / _expD, PRECISION)
    return resN


'''*
    input range: 
        - numerator: [1, uint256_max >> PRECISION]    
        - denominator: [1, uint256_max >> PRECISION]
    output range:
        [0, 0x9b43d4f8d6]
    This method asserts outside of bounds
'''
def ln(_numerator, _denominator, PRECISION):
    # denominator > numerator: less than one yields negative values. Unsupported
    assert(_denominator <= _numerator)

    # log(1) is the lowest we can go
    assert(_denominator != 0 and _numerator != 0)

    # Upper 32 bits are scaled off by PRECISION
    assert(_numerator < (1 << (256-PRECISION)))
    assert(_denominator < (1 << (256-PRECISION)))

    return fixedLoge( (_numerator * (1 << PRECISION)) / _denominator, PRECISION)


'''*
    input range: 
        [0x100000000,uint256_max]
    output range:
        [0, 0x9b43d4f8d6]
    This method asserts outside of bounds
'''
def fixedLoge(_x, PRECISION):
    '''
    Since `fixedLog2_min` output range is max `0xdfffffffff` 
    (40 bits, or 5 bytes), we can use a very large approximation
    for `ln(2)`. This one is used since it's the max accuracy 
    of Python `ln(2)`
    0xb17217f7d1cf78 = ln(2) * (1 << 56)
    
    '''
    #Cannot represent negative numbers (below 1)
    assert(_x >= (1 << PRECISION))

    log2 = fixedLog2(_x, PRECISION)
    return (log2 * 0xb17217f7d1cf78) >> 56


'''*
    Returns log2(x >> 32) << 32 [1]
    So x is assumed to be already upshifted 32 bits, and 
    the result is also upshifted 32 bits. 
    
    [1] The function returns a number which is lower than the 
    actual value
    input-range : 
        [0x100000000,uint256_max]
    output-range: 
        [0,0xdfffffffff]
    This method asserts outside of bounds
'''
def fixedLog2(_x, PRECISION):
    FIXED_ONE = 1 << PRECISION
    FIXED_TWO = 2 << PRECISION

    # Numbers below 1 are negative. 
    assert( _x >= FIXED_ONE)

    hi = 0
    while (_x >= FIXED_TWO):
        _x >>= 1
        hi += FIXED_ONE

    for i in range(PRECISION):
        _x = (_x * _x) / FIXED_ONE
        if (_x >= FIXED_TWO):
            _x >>= 1
            hi += (1) << (PRECISION - 1 - i)

    return hi


'''*
    fixedExp is a 'protected' version of `fixedExpUnsafe`, which 
    asserts instead of overflows
'''
def fixedExp(_x, PRECISION):
    assert(_x <= MAX_FIXED_EXP_32)
    return fixedExpUnsafe(_x, PRECISION)


'''*
    fixedExp 
    Calculates e^x according to maclauren summation:
    e^x = 1+x+x^2/2!...+x^n/n!
    and returns e^(x>>32) << 32, that is, upshifted for accuracy
    Input range:
        - Function ok at    <= 242329958953 
        - Function fails at >= 242329958954
    This method is is visible for testcases, but not meant for direct use. 
'''
def fixedExpUnsafe(_x, PRECISION):

    res = 0xde1bc4d19efcac82445da75b00000000 << PRECISION

    xi = (xi * _x) >> PRECISION
    res += xi * 0xde1bc4d19efcac82445da75b00000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x6f0de268cf7e5641222ed3ad80000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x2504a0cd9a7f7215b60f9be480000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x9412833669fdc856d83e6f920000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x1d9d4d714865f4de2b3fafea0000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x4ef8ce836bba8cfb1dff2a70000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xb481d807d1aa66d04490610000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x16903b00fa354cda08920c2000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x281cdaac677b334ab9e732000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x402e2aad725eb8778fd85000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x5d5a6c9f31fe2396a2af000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x7c7890d442a82f73839400000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x9931ed54034526b58e400000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xaf147cf24ce150cf7e00000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xbac08546b867cdaa200000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xbac08546b867cdaa20000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xafc441338061b2820000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x9c3cabbc0056d790000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x839168328705c30000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x694120286c049c000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x50319e98b3d2c000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x3a52a1e36b82000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x289286e0fce000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x1b0c59eb53400
    xi = (xi * _x) >> PRECISION
    res += xi * 0x114f95b55400
    xi = (xi * _x) >> PRECISION
    res += xi * 0xaa7210d200
    xi = (xi * _x) >> PRECISION
    res += xi * 0x650139600
    xi = (xi * _x) >> PRECISION
    res += xi * 0x39b78e80
    xi = (xi * _x) >> PRECISION
    res += xi * 0x1fd8080
    xi = (xi * _x) >> PRECISION
    res += xi * 0x10fbc0
    xi = (xi * _x) >> PRECISION
    res += xi * 0x8c40
    xi = (xi * _x) >> PRECISION
    res += xi * 0x462
    xi = (xi * _x) >> PRECISION
    res += xi * 0x22

    return res / 0xde1bc4d19efcac82445da75b00000000


def safeMul(x,y):
    assert(x * y < (1 << 256))
    return x * y


def getBestPrecision(_baseN, _baseD, _expN, _expD):
    precision = floorLog2(MAX_FIXED_EXP_32*_expD/(lnUpperBound(_baseN,_baseD)*_expN))
    return max(precision,32)


def lnUpperBound(baseN,baseD):
    assert(baseN > baseD)
    if 100000*baseN <= 271828*baseD: # baseN/baseD < e^1
        return 1
    if 100000*baseN <= 738905*baseD: # baseN/baseD < e^2
        return 2
    if baseN <= 8*baseD:             # baseN/baseD <= 2^3 < e^3
        return 3
    return floorLog2(baseN/baseD)


def floorLog2(n):
    t = 0
    for k in range(8,0,-1):
        if (n > (1<<(1<<k))-1):
            s = 1 << k
            n >>= s
            t |= s
    return t | (n >> 1)
