import math,sys

# These methods are high-precision equivalents of the underlying 
# algorithms that we try to implement in the contract

def calculatePurchaseReturn(S,R,F,E):
    if F== 100:
        return S*E/R

    return S * ( math.pow(1.0 + float(E)/float(R), float(F)/100.0) - 1.0 )
        
def calculateSaleReturn(S,R,F,T):
    """ 
    E = R(1 - ((1 - T / S) ^ (1 / F))
     """
    if (T > S):
        return 0

    if F == 100:
        return R*T/S

    return float(R) * ( 1.0 - math.pow(float(S-T)/float(S) , (100.0/float(F))))

def realFixedLogn(x , n):
    one = 1 << 32
    return int(math.floor( math.log( float(x) / one, n) * one ))

def realFixedLogFloat(x , n):
    one = 1 << 32
    return math.log( float(x) / float(one), n) * float(one) 

def realFixedLogE(x):
    one = 1 << 32
    return int(math.floor( math.log( float(x) / one) * one ))


# These functions mimic the EVM-implementation
#
verbose = False

PRECISION = 32;                    # fractional bits
FIXED_ONE = 1 << PRECISION         # 0x100000000

FIXED_TWO = 2 << PRECISION         # 0x200000000
         
# Helper method to detect overflows
def uint256(x):
    r = int(x) & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
    if x > 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:
        raise Exception("Loss of number! %s" % str(x))
    return r

# Helper method to detect overflows
def return_uint256(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper


@return_uint256
def ln(_numerator, _denominator):
    if verbose:
        print("  -> ln(numerator = %s  , denominator = %s)"  % (hex(_numerator) , hex(_denominator)))
    
    r = fixedLoge ( (_numerator << PRECISION) / _denominator)
    if verbose:
        print("  <- ln(numerator = %s  , denominator = %s) : %d"  % (hex(_numerator) , hex(_denominator), r))

    return r



@return_uint256
def fixedLoge(_x) :

    if (_x < FIXED_ONE):
        raise Exeption("Out of bounds")

    if verbose:
        print("   --> fixedLoge( %s = %s )  " % (hex(_x), _x))

    x = uint256(_x)
    log2 = fixedLog2_min(_x)
    if verbose:
        print("    --> fixedLog2_min( %s = %s )  ) %s " % (hex(_x), _x, log2))
        print("        should be    ( %s = %s )  ) %s " % (hex(_x), _x, realFixedLogn(x,2)))

    logE = (log2 * 0xb17217f7d1cf78) >> 56;

    res = math.floor(logE)
    if verbose:
        print("   <-- returning %s" % res)
        print("   <-- should be %s" % realFixedLogE(x))

    #return realFixedLogE(x)
    return res

@return_uint256
def fixedLog2_min( _ix) :
    
    _x = uint256(_ix)

    if _x < FIXED_ONE:
        raise Exception("Out of bounds")

    hi = 0;
    while _x >= FIXED_TWO:
        _x >>= 1;
        hi = uint256( hi + FIXED_ONE)

    for i in range(0, PRECISION,1):
        _x = uint256(_x * _x) >> PRECISION
        if (_x >= FIXED_TWO):
            _x >>= 1
            hi =uint256( hi + uint256(1 << (PRECISION - 1 - i)))
            

    if verbose:
        print("    fixedLog2 ( %s ) returning %s (%s)"  % ( hex(_ix), hi, hex(hi)))



    return hi

@return_uint256
def fixedExp(_x):
    _x = uint256(_x)
    if verbose:
        print("  -> fixedExp(  %d )"  % _x)

    if _x > 0x386bfdba29: 
        raise Exception("Overflow: %s" % hex(_x))

    if _x == 0:
        if verbose:
            print("  <- fixedExp(  %d ): %s"  % (_x, hex(FIXED_ONE)))
        return FIXED_ONE


    xi = FIXED_ONE;
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

    res  = res / 0xde1bc4d19efcac82445da75b00000000;
    
    if verbose:
        print("  <- fixedExp(  %d ): %s"  % (_x, hex(res)))
    return res



def power(_baseN,_baseD, _expN, _expD):

    _expD = uint256(_expD)

    _ln = uint256(ln(_baseN, _baseD))

    if verbose:
        print(" -> power(baseN = %d, baseD = %d, expN = %d, expD = %d) " % (_baseN, _baseD, _expN, _expD ))


    abc = uint256(uint256(_ln * _expN) / _expD)
    if verbose:
        print(" ln [%d] * expN[%d] / expD[%d] : %d" % ( _ln, _expN ,  _expD, abc))
    res = fixedExp(abc)
    if verbose:
        print(" <- power(baseN = %d, baseD = %d, expN = %d, expD = %d) : %s" % (_baseN, _baseD, _expN, _expD ,hex(res)))
    return res;

@return_uint256
def calculatePurchaseReturnSolidity(S,R,F,E):
    """The 'solidity' version, which matches pretty closely to what 
    happens under the EVM hood"""

    _supply = uint256(S)
    _reserveBalance = uint256(R)
    _reserveRatio = uint256(F)
    _depositAmount = uint256(E)

    baseN = uint256(_depositAmount + _reserveBalance);

    if _reserveRatio == 100:
        amount = uint256(_supply * baseN) / _reserveBalance
        if amount < _supply: 
            raise Exception("Error, amount < supply")
        return amount - _supply
    
    resD = FIXED_ONE
    resN = power(baseN, _reserveBalance, _reserveRatio, 100);


    result =  (_supply * resN / resD) - _supply
    if verbose:
        print(" supply[%d] * resN[%d] / resD[%d] - supply[%d] = %d " %
            (_supply, resN, resD, _supply, result))

    #Potential fix, reduce the result by the error occurred through rounding
    #if result < minUnit(S):
    #    throw("Overflow")
    #return uint256(result- minUnit(S))
    return result

def calcPurchaseMin(S):
    _supply = uint256(S)
    return (_supply * 0x100000001/0x100000000 -_supply)

def calcSaleMin(R):
    _reserveBalance = uint256(R)
    return _reserveBalance * 0x100000001/0x100000000 -_reserveBalance

def minUnit(x):
    return x/0x100000000

@return_uint256
def calculateSaleReturnSolidity(S, R, F,  T):
    """The 'solidity' version, which matches pretty closely to what 
    happens under the EVM hood"""
    _supply = uint256(S)
    _reserveBalance = uint256(R)
    _reserveRatio = uint256(F)
    _sellAmount = uint256(T)
 
    if ( _supply < _sellAmount):
        raise Exception("Supply < Tokens")

    _baseN = _supply - _sellAmount


    if _reserveRatio == 100:
        amount = uint256(_reserveBalance * _baseN ) / _supply
        if _reserveBalance < amount:
            raise Exception("_reservebalance < amount")

        return _reserveBalance - amount

    resD = FIXED_ONE
    #resN  = power_sale(_supply, _baseN, 100, _reserveRatio)
    resN = power(_supply, _baseN, 100, _reserveRatio)
    resN = uint256(resN)

    reserveUpshifted =  uint256(_reserveBalance * resN)
    amount            = uint256(_reserveBalance * resD) 

    
    result = (reserveUpshifted - amount) / resN
    
    if verbose:
        print(" rbal[%d] * resN[%d] / resD[%d] - rbal[%d] = %d " %
        (_reserveBalance, resN, resD, _reserveBalance, result))

    return uint256(result - minUnit(R))

def calculateFactorials():
    """Method to print out the factorials for fixedExp"""

    ni = []
    ni.append( 295232799039604140847618609643520000000) # 34!
    ITERATIONS = 34
    for n in range( 1,  ITERATIONS,1 ) :
        ni.append(math.floor(ni[n - 1] / n))
    print( "\n        ".join(["xi = (xi * _x) >> PRECISION;\n        res += xi * %s;" % hex(int(x)) for x in ni]))


class Market():

    def __init__(self,S,R,F):
        self.R = int(R)# 63000 #
        self.S = int(S)
        self.F = int(F) # 21% CRR , 
                
    def buyWithReserveToken(self, E):
        T = calculatePurchaseReturnSolidity(self.S,self.R,self.F,E)
        print("Buy with %d Ether => %d tokens" % (E, T) )
        Tc = calculatePurchaseReturn(self.S,self.R,self.F,E)
        print("[Correct]:Buy with %d Ether => %d tokens" % (E, Tc) )

        T = uint256(math.floor(T))
        self.R += E
        self.S += T
        return T

    def sellForReserveToken(self, T):
        E = calculateSaleReturnSolidity(self.S,self.R,self.F,T)
        E = uint256(math.floor(E))
        self.R -= E
        self.S -= T
        print("Returning %d ether" % E)
        return E

    def __str__(self):
        unit_price = self.R / (self.S*self.F)
        return "\n" \
        +" ETH Reserve      %f\n" % self.R \
        +" BGT Supply       %f\n" % self.S \
        +" BGT Market-cap:  %f\n" % (self.S * unit_price)\
        + " BGT Unit price   %f\n" % unit_price 
