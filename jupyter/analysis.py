import math,sys

def calculatePurchaseReturn(S,R,F,E):
    return float(S) * ( math.pow(1.0 + float(E)/float(R), float(F)/100.0) - 1.0 )
        
def calculateSaleReturn(S,R,F,T):
    return R * ( math.pow((1.0+T/S)  ,(100.0/F)) -1 )
# These functions mimic the EVM-implementation

PRECISION = 32;  # fractional bits
uint128 = lambda x : int(int(x) & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
         

def uint256(x):
    r = int(x) & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFL
    if x > r:
        raise Exception("Loss of number!")
    return r

def return_uint256(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


@return_uint256
def ln(_numerator, _denominator):
    print("ln(numerator = %s  , denominator = %s"  % (hex(_numerator) , hex(_denominator)))
    return fixedLoge(_numerator << PRECISION) - fixedLoge(_denominator << PRECISION);


@return_uint256
def fixedLoge(_x) :
    print("fixedLoge(  %s )"  % hex(_x))
    x = uint256(_x)
    return math.floor((fixedLog2(_x) * 1488522235) >> 31); # 1,488,522,236 = ln(2) * (2 ^ 31)
    

@return_uint256
def fixedLog2( _ix) :
    print("fixedLog2(  %s )"  % hex(_ix))
    _x = uint256(_ix)

    fixedOne = uint256(1 << PRECISION);# 0x100000000	
    fixedTwo = uint256(2 << PRECISION);# 0x200000000
    lo = 0;
    hi = 0;
    while _x < fixedOne:
        _x = uint256(_x << 1)
        lo = uint256( lo + fixedOne)

    while _x >= fixedTwo:
        _x >>= 1;
        hi = uint256( hi + fixedOne)

    for i in range(0, PRECISION,1):
        _x = uint256(_x * _x) >> PRECISION
        if (_x >= fixedTwo):
            _x >>= 1
            hi =uint256( hi + uint256(1 << (PRECISION - 1 - i)))
    
    if lo >= hi:

        raise Exception("Underflow, hi < lo: %d < %d at (%d) " % (hi,lo, _ix))
    #print "Correct: %s" % int(math.log(_ix >> PRECISION,2) * 0x100000000)
    #print("fixedLog2(%s << 32  ) => %f => %d" % (hex(_ix >> PRECISION), (hi-lo), math.floor(hi - lo)))
    #print("Returns: %s" % int(math.floor(hi - lo)))
    return uint256(math.floor(hi - lo))


@return_uint256
def fixedExp(_x):
    fixedOne = uint256(1) << PRECISION;
    xi = fixedOne;
    res = uint256(0xde1bc4d19efcac82445da75b00000000 * xi)

    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xde1bc4d19efcb0000000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x6f0de268cf7e58000000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x2504a0cd9a7f72000000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x9412833669fdc800000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x1d9d4d714865f500000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x4ef8ce836bba8c0000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xb481d807d1aa68000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x16903b00fa354d000000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x281cdaac677b3400000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x402e2aad725eb80000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x5d5a6c9f31fe24000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x7c7890d442a83000000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x9931ed540345280000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xaf147cf24ce150000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xbac08546b867d000000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xbac08546b867d00000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xafc441338061b8000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x9c3cabbc0056e000000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x839168328705c80000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x694120286c04a0000
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x50319e98b3d2c400
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x3a52a1e36b82020
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x289286e0fce002
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x1b0c59eb53400
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x114f95b55400
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0xaa7210d200
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x650139600
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x39b78e80
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x1fd8080
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x10fbc0
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x8c40
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x462
    xi = uint256(xi * _x) >> PRECISION
    res += xi * 0x22

    return res / 0xde1bc4d19efcac82445da75b00000000;


@return_uint256
def fixedExpOld( _x) :
    """ The previous version, left here for comparisons"""
    _x = uint256(_x)
    precision = PRECISION
    fixedOne = uint256(1 << precision);

    ni = factorials

    xi = uint256(fixedOne)
    res = uint256(xi * ni[0] )
    
    for i in range(1, len(ni) ,1 ):
        xi = uint256(xi * _x ) >> precision
        res += math.floor(xi * ni[i])
        res = uint256(res)


    final_res = math.floor(res / ni[0])
    return final_res


def power(_baseN,_baseD, _expN, _expD):
    print("power(baseN = %d, baseD = %d, expN = %d, expD = %d)" % (_baseN, _baseD, _expN, _expD ))
    x_ln = ln(_baseN, _baseD)
    #print("ln(%d, %d) = %d" % (_baseN, _baseD, x_ln))
    #     36893553730 with 31 bit precision
    #     36893553743 with 32 bit precision
    #_ln = 36893553752
    _ln = x_ln
    return (fixedExp(_ln * _expN / _expD), 1 << PRECISION);


@return_uint256
def calculatePurchaseReturnSolidity(S,R,F,E):
    """The 'solidity' version, which matches pretty closely to what 
    happens under the EVM hood"""

    _supply = int(S)
    _reserveBalance = int(R)
    _reserveRatio = int(F)
    _depositAmount = int(E)

    uint128_1 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
    
    if _supply > uint128_1 or _reserveBalance > uint128_1 or _depositAmount > uint128_1:
        raise Exception("Out of bounds")

    # (E+R)^R
    
    (resN, resD) = power(uint128(_depositAmount + _reserveBalance), uint128(_reserveBalance), _reserveRatio, 100);
    
    correct_resN = int(math.pow((E+R)/R, float(F)/100)*resD)
    print "C resN: %d" % correct_resN
    print "E resN: %d" % resN

    #return (_supply *  correct_resN / resD) - _supply
    return (_supply * resN / resD) - _supply


@return_uint256
def calculateSaleReturnSolidity(S, R, F,  T):
    """The 'solidity' version, which matches pretty closely to what 
    happens under the EVM hood"""
    _supply = int(S)
    _reserveBalance = int(R)
    _reserveRatio = int(F)
    _sellAmount = int(T)
    
    uint128_1 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
    
    if (_supply == 0 or _reserveBalance == 0 or _reserveRatio < 1 or _reserveRatio > 99 or  _sellAmount == 0):# validate input
            raise Exception("Error %s %s %s" % (_supply, _reserveBalance,_reserveRatio))
        # limiting input to 128bit to provide *some* overflow protection while keeping the interface generic 256bit
        # TODO: will need to revisit this
    if (_supply > uint128_1 or _reserveBalance > uint128_1 or _sellAmount > uint128_1):
        raise Exception("Out of bounds")

    (resN, resD) = power(uint128(_sellAmount + _supply), uint128(_supply), 100, _reserveRatio);
    resN = uint256(resN)
    resD = uint256(resD)
    return (_reserveBalance * resN / resD) - _reserveBalance

def calculateFactorials():
    """Method to print out the factorials for fixedExp"""

    ni = []
    ni.append( 295232799039604140847618609643520000000) # 34!
    ITERATIONS = 34
    for n in range( 1,  ITERATIONS,1 ) :
        ni.append(math.floor(ni[n - 1] / n))
    print "\n        ".join(["xi = (xi * _x) >> PRECISION;\n        res += xi * %s;" % hex(int(x)) for x in ni])
