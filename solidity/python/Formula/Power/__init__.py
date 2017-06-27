PRECISION = 32  # fractional bits
FIXED_ONE = (1) << PRECISION # 0x100000000
FIXED_TWO = (2) << PRECISION # 0x200000000
FIXED_MAX = (1) << (256-PRECISION) # 0x100000000000000000000000000000000000000000000000000000000


'''*
    @dev Calculate (_baseN / _baseD) ^ (_expN / _expD)
    Returns result upshifted by PRECISION
    This method is overflow-safe
''' 
def power(_baseN, _baseD, _expN, _expD):
    logbase = ln(_baseN, _baseD)
    # Not using safeDiv here, since safeDiv protects against
    # precision loss. It's unavoidable, however
    # Both `ln` and `fixedExp` are overflow-safe. 
    resN = fixedExp(safeMul(logbase, _expN) / _expD)
    return resN


'''*
    input range: 
        - numerator: [1, uint256_max >> PRECISION]    
        - denominator: [1, uint256_max >> PRECISION]
    output range:
        [0, 0x9b43d4f8d6]
    This method asserts outside of bounds
'''
def ln(_numerator, _denominator):
    # denominator > numerator: less than one yields negative values. Unsupported
    assert(_denominator <= _numerator)

    # log(1) is the lowest we can go
    assert(_denominator != 0 and _numerator != 0)

    # Upper 32 bits are scaled off by PRECISION
    assert(_numerator < FIXED_MAX)
    assert(_denominator < FIXED_MAX)

    return fixedLoge( (_numerator * FIXED_ONE) / _denominator)


'''*
    input range: 
        [0x100000000,uint256_max]
    output range:
        [0, 0x9b43d4f8d6]
    This method asserts outside of bounds
'''
def fixedLoge(_x):
    '''
    Since `fixedLog2_min` output range is max `0xdfffffffff` 
    (40 bits, or 5 bytes), we can use a very large approximation
    for `ln(2)`. This one is used since it's the max accuracy 
    of Python `ln(2)`
    0xb17217f7d1cf78 = ln(2) * (1 << 56)
    
    '''
    #Cannot represent negative numbers (below 1)
    assert(_x >= FIXED_ONE)

    log2 = fixedLog2(_x)
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
def fixedLog2(_x):
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
def fixedExp(_x):
    assert(_x <= 0x386bfdba29)
    return fixedExpUnsafe(_x)


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
def fixedExpUnsafe(_x):

    xi = FIXED_ONE
    res = 0xde1bc4d19efcac82445da75b00000000 * xi

    xi = (xi * _x) >> PRECISION
    res += xi * 0xde1bc4d19efcb0000000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x6f0de268cf7e58000000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x2504a0cd9a7f72000000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x9412833669fdc800000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x1d9d4d714865f500000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x4ef8ce836bba8c0000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xb481d807d1aa68000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x16903b00fa354d000000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x281cdaac677b3400000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x402e2aad725eb80000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x5d5a6c9f31fe24000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x7c7890d442a83000000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x9931ed540345280000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xaf147cf24ce150000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xbac08546b867d000000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xbac08546b867d00000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0xafc441338061b8000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x9c3cabbc0056e000000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x839168328705c80000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x694120286c04a0000
    xi = (xi * _x) >> PRECISION
    res += xi * 0x50319e98b3d2c400
    xi = (xi * _x) >> PRECISION
    res += xi * 0x3a52a1e36b82020
    xi = (xi * _x) >> PRECISION
    res += xi * 0x289286e0fce002
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