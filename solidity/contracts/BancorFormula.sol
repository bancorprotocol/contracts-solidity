pragma solidity ^0.4.11;
import './SafeMath.sol';
import './interfaces/IBancorFormula.sol';

/*
    Open issues:
    - The formula is not yet super accurate, especially for very small/very high ratios
    - Improve dynamic precision support
*/

contract BancorFormula is IBancorFormula, SafeMath {

    uint256 constant MAX_FIXED_EXP_32 = 0x386bfdba29;
    string public version = '0.2';

    function BancorFormula() {
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
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256) {
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

        uint8 precision = getBestPrecision(baseN, _reserveBalance, _reserveRatio, 100);
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
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256) {
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

        uint8 precision = getBestPrecision(_supply, baseD, 100, _reserveRatio);
        uint256 resN = power(_supply, baseD, 100, _reserveRatio, precision);

        temp1 = safeMul(_reserveBalance, resN);
        temp2 = safeMul(_reserveBalance, uint256(1) << precision);

        return safeSub(temp1, temp2) / resN;
    }

    /**
        @dev Calculate (_baseN / _baseD) ^ (_expN / _expD)
        Returns result upshifted by precision

        This method is overflow-safe
    */ 
    function power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD, uint8 _precision) constant returns (uint256 resN) {
        uint256 logbase = ln(_baseN, _baseD, _precision);
        // Not using safeDiv here, since safeDiv protects against
        // precision loss. It's unavoidable, however
        // Both `ln` and `fixedExp` are overflow-safe. 
        resN = fixedExp(safeMul(logbase, _expN) / _expD, _precision);
        return resN;
    }
    
    /**
        input range: 
            - numerator: [1, uint256_max >> precision]    
            - denominator: [1, uint256_max >> precision]
        output range:
            [0, 0x9b43d4f8d6]

        This method asserts outside of bounds

    */
    function ln(uint256 _numerator, uint256 _denominator, uint8 _precision) public constant returns (uint256) {
        // denominator > numerator: less than one yields negative values. Unsupported
        assert(_denominator <= _numerator);

        // log(1) is the lowest we can go
        assert(_denominator != 0 && _numerator != 0);

        // Upper bits are scaled off by precision
        uint256 MAX_VAL = uint256(1) << (256 - _precision);
        assert(_numerator < MAX_VAL);
        assert(_denominator < MAX_VAL);

        return fixedLoge( (_numerator << _precision) / _denominator, _precision);
    }

    /**
        input range: 
            [0x100000000,uint256_max]
        output range:
            [0, 0x9b43d4f8d6]

        This method asserts outside of bounds

    */
    function fixedLoge(uint256 _x, uint8 _precision) constant returns (uint256 logE) {
        /*
        Since `fixedLog2_min` output range is max `0xdfffffffff` 
        (40 bits, or 5 bytes), we can use a very large approximation
        for `ln(2)`. This one is used since it's the max accuracy 
        of Python `ln(2)`

        0xb17217f7d1cf78 = ln(2) * (1 << 56)
        
        */
        //Cannot represent negative numbers (below 1)
        assert(_x >= uint256(1) << _precision);

        uint256 log2 = fixedLog2(_x, _precision);
        logE = (log2 * 0xb17217f7d1cf78) >> 56;
    }

    /**
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

    */
    function fixedLog2(uint256 _x, uint8 _precision) constant returns (uint256) {
        uint256 FIXED_ONE = uint256(1) << _precision;
        uint256 FIXED_TWO = uint256(2) << _precision;

        // Numbers below 1 are negative. 
        assert( _x >= FIXED_ONE);

        uint256 hi = 0;
        while (_x >= FIXED_TWO) {
            _x >>= 1;
            hi += FIXED_ONE;
        }

        for (uint8 i = 0; i < _precision; ++i) {
            _x = (_x * _x) / FIXED_ONE;
            if (_x >= FIXED_TWO) {
                _x >>= 1;
                hi += uint256(1) << (_precision - 1 - i);
            }
        }

        return hi;
    }

    /**
        fixedExp is a 'protected' version of `fixedExpUnsafe`, which 
        asserts instead of overflows
    */
    function fixedExp(uint256 _x, uint8 _precision) constant returns (uint256) {
        uint256 maxExp = MAX_FIXED_EXP_32;
        for (uint8 p = 32; p < _precision; p += 2)
            maxExp = maxExp * 367765941410054209 / 100000000000000000;
        
        assert(_x <= maxExp);
        return fixedExpUnsafe(_x, _precision);
    }

    /**
        fixedExp 
        Calculates e^x according to maclauren summation:

        e^x = 1+x+x^2/2!...+x^n/n!

        and returns e^(x>>32) << 32, that is, upshifted for accuracy

        Input range:
            - Function ok at    <= 242329958953 
            - Function fails at >= 242329958954

        This method is is visible for testcases, but not meant for direct use. 
 
        The values in this method been generated via the following python snippet: 

        def calculateFactorials():
            """Method to print out the factorials for fixedExp"""

            ni = []
            ni.append( 295232799039604140847618609643520000000) # 34!
            ITERATIONS = 34
            for n in range( 1,  ITERATIONS,1 ) :
                ni.append(math.floor(ni[n - 1] / n))
            print( "\n        ".join(["xi = (xi * _x) >> _precision;\n        res += xi * %s;" % hex(int(x)) for x in ni]))

    */
    function fixedExpUnsafe(uint256 _x, uint8 _precision) constant returns (uint256) {
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

    function getBestPrecision(uint256 _baseN, uint256 _baseD, uint256 _expN, uint256 _expD) constant returns (uint8) {
        uint8 precision = floorLog2(MAX_FIXED_EXP_32 * _expD / (lnUpperBound(_baseN,_baseD) * _expN));
        if (precision <= 32)
            return 32;
        if (precision >= 48)
            return 64;
        return precision * 2 - 32;
    }

    /**
        lnUpperBound 
        Takes a rational number (baseN/baseD) as input.
        Returns an estimated upper-bound integer of the natural logarithm of the input.
        We can generally use floorLog2, although there is possibly a tighter bound.
        We cannot use floorLog2 when the input is smaller than 8.
        Complexity is O(log(input)).
    */
    function lnUpperBound(uint256 baseN, uint256 baseD) constant returns (uint8) {
        assert(baseN > baseD);

        uint256 scaledBaseN = baseN * 100000;
        if (scaledBaseN <= baseD *  271828) // baseN / baseD < e^1 (floorLog2 will return 0 if baseN/baseD < 2)
            return 1;
        if (scaledBaseN <= baseD *  738905) // baseN / baseD < e^2 (floorLog2 will return 1 if baseN/baseD < 4)
            return 2;
        if (scaledBaseN <= baseD * 2008553) // baseN / baseD < e^3 (floorLog2 will return 2 if baseN/baseD < 8)
            return 3;

        return floorLog2(baseN/baseD);
    }

    /**
        floorLog2 
        Takes a natural number (n) as input.
        Returns the largest integer smaller than or equal to the binary logarithm of the input.
        Complexity is O(log(input)).
    */
    function floorLog2(uint256 n) constant returns (uint8) {
        uint256 t = 0;
        for (int k = 7; k >= 0; k--) {
            if (n > (uint256(1) << (1 << k)) - 1) {
                uint256 s = uint256(1) << k;
                n >>= s;
                t |= s;
            }
        }

        return uint8(t | (n >> 1));
    }
}
