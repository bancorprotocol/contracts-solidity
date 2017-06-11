pragma solidity ^0.4.11;
import './SafeMath.sol';
import './IBancorFormula.sol';

/*
    Open issues:
    - The formula is not yet super accurate, especially for very small/very high ratios
    - Possibly support dynamic precision in the future
*/

contract BancorFormula is IBancorFormula, SafeMath {
    uint8 constant PRECISION = 32;  // fractional bits

    string public version = '0.1';

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
        var resD = uint256(1) << PRECISION;
        var resN = power(baseN, _reserveBalance, _reserveRatio, 100);
        temp = safeMul(_supply, resN) / resD;
        var result = safeSub(temp, _supply);
 
        //From the result, we deduct the minimal increment, which is a 
        // function of S and precision. 
        return safeSub(result, _supply/0x100000000);
 
    }

    /**
        @dev given a token supply, reserve, CRR and a sell amount (in the main token), calculates the return for a given change (in the reserve token)

        Formula:
        Return = _reserveBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_reserveRatio / 100))

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

        // special case for selling the entire supply
        if (_sellAmount == _supply)
            return _reserveBalance;

        uint256 baseN = safeSub(_supply, _sellAmount);
        uint256 temp1;
        uint256 temp2;

        // special case if the CRR = 100
        if (_reserveRatio == 100) {
            temp1 = safeMul(_reserveBalance, _supply);
            temp2 = safeMul(_reserveBalance, baseN);
            return safeSub(temp1, temp2) / _supply;
        }
        var resD = uint256(1) << PRECISION;
        var resN = power_rounddown(_supply, baseN, 100, _reserveRatio);
        temp1 = safeMul(_reserveBalance, resN);
        temp2 = safeMul(_reserveBalance, resD);

        var result = safeSub(temp1, temp2) / resN;
        //From the result, we deduct the minimal increment, which is a 
        // function of R and precision. 
        return safeSub(result, _reserveBalance/0x100000000);
    }

    /**
        @dev Calculate (_baseN / _baseD) ^ (_expN / _expD)
        Returns result upshifted by PRECISION

        This method is overflow-safe
    */ 
    function power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) constant returns (uint256 resN) {
        uint256 logbase = ln(_baseN, _baseD);
        // Not using safeDiv here, since safeDiv protects against
        // precision loss. It's unavoidable, however
        // Both `ln` and `fixedExp` are overflow-safe. 
        resN = fixedExp(safeMul(logbase, _expN) / _expD);

        return resN;
	}
    /**
        @dev Calculate (_baseN / _baseD) ^ (_expN / _expD)
        This mehthod is skewed to make the precision loss error decrease the result 
        Returns result upshifted by PRECISION

        This method is overflow-safe
    */ 
    function power_rounddown(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) constant returns (uint256 resN) {
        
        // In `ln`, the log of numerator and denominator are subtracted: 
        // log(n)-log(d) . To ensure that the precision loss is in the right 
        // direction, we subtract one unit 
        // Reasoning: 
        //      floor(log(d)) +1 == ceil(log(d))
        uint256 logbase = ln(_baseN, _baseD);
        
        if (logbase > 1){
            logbase -= 1;
        }
        // Not using safeDiv here, since safeDiv protects against
        // precision loss. It's unavoidable, however
        // Both `ln` and `fixedExp` are overflow-safe. 
        resN = fixedExp(safeMul(logbase, _expN) / _expD);

        return resN;
    }
    
    /**
        input range: 
            - numerator: [1, uint256_max >> PRECISION]    
            - denominator: [1, uint256_max >> PRECISION]
        output range:
            [0, 0x9b43d4f8d6]

        This method asserts outside of bounds

    */
    function ln(uint256 _numerator, uint256 _denominator) constant returns (uint256) {
        // denominator > numerator: less than one yields negative values. Unsupported
        assert(_denominator <= _numerator);

        // log(1) is the lowest we can go
        assert(_denominator != 0 && _numerator != 0);

        // Upper 32 bits are scaled off by PRECISION
        assert(_numerator & 0xffffffff00000000000000000000000000000000000000000000000000000000 == 0);
        assert(_denominator & 0xffffffff00000000000000000000000000000000000000000000000000000000 == 0);

        return fixedLoge(_numerator << PRECISION) - fixedLoge(_denominator << PRECISION);
    }

    /**
        input range: 
            [0x100000000,uint256_max]
        output range:
            [0, 0x9b43d4f8d6]

        This method asserts outside of bounds

    */
    function fixedLoge(uint256 _x) constant returns (uint256 logE) {
        /*
        Since `fixedLog2` output range is max `0xdfffffffff` 
        (40 bits, or 5 bytes), we can use a very large approximation
        for `ln(2)`. This one is used since it's the max accuracy 
        of Python `ln(2)`

        0xb17217f7d1cf78 = ln(2) * (1 << 56)
        
        */
        //Cannot represent negative numbers (below 1)
        assert(_x >= 0x100000000);

        if (_x < 0x300000000){
            return 0;
        }
        uint256 log2 = fixedLog2(_x);
        logE = (log2 * 0xb17217f7d1cf78) >> 56;
    }

    /**
        Returns log2(x >> 32) << 32 
        So x is assumed to be already upshifted 32 bits, and 
        the result is also upshifted 32 bits. 

        input-range : 
            [0x100000000,uint256_max]
        output-range: 
            [0,0xdfffffffff]

        This method asserts outside of bounds

    */
    function fixedLog2(uint256 _x) constant returns (uint256) {
        uint256 fixedOne = uint256(1) << PRECISION;
        uint256 fixedTwo = uint256(2) << PRECISION;

        if (_x < fixedTwo) {
            if (_x >= fixedOne){
                return 0;
            }
            // Numbers below 1 are negative. 
            assert(false);
        }

        uint256 lo = 0;
        uint256 hi = 0;

        while (_x < fixedOne) {
            _x <<= 1;
            lo += fixedOne;
        }

        while (_x >= fixedTwo) {
            _x >>= 1;
            hi += fixedOne;
        }

        for (uint8 i = 0; i < PRECISION; ++i) {
            _x = (_x * _x) >> PRECISION;
            if (_x >= fixedTwo) {
                _x >>= 1;
                hi += uint256(1) << (PRECISION - 1 - i);
            }
        }
        if (lo > hi) {
            //Should never happen, due to the check above
            // but this is a cheap extra check in case the 
            // implementation changes over time
            assert(false);
        }

        return hi - lo;
    }

    /**
        fixedExp is a 'protected' version of `fixedExpUnsafe`, which 
        asserts instead of overflows
    */
    function fixedExp(uint256 _x) constant returns (uint256) {
        assert(_x <= 0x386bfdba29);
        return fixedExpUnsafe(_x);
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
    */
    function fixedExpUnsafe(uint256 _x) constant returns (uint256) {
        uint256 fixedOne = uint256(1) << PRECISION;
        uint256 xi = fixedOne;
        uint256 res = 0xde1bc4d19efcac82445da75b00000000 * xi;

        xi = (xi * _x) >> PRECISION;
        res += xi * 0xde1bc4d19efcb0000000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x6f0de268cf7e58000000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x2504a0cd9a7f72000000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x9412833669fdc800000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x1d9d4d714865f500000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x4ef8ce836bba8c0000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0xb481d807d1aa68000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x16903b00fa354d000000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x281cdaac677b3400000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x402e2aad725eb80000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x5d5a6c9f31fe24000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x7c7890d442a83000000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x9931ed540345280000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0xaf147cf24ce150000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0xbac08546b867d000000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0xbac08546b867d00000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0xafc441338061b8000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x9c3cabbc0056e000000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x839168328705c80000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x694120286c04a0000;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x50319e98b3d2c400;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x3a52a1e36b82020;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x289286e0fce002;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x1b0c59eb53400;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x114f95b55400;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0xaa7210d200;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x650139600;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x39b78e80;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x1fd8080;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x10fbc0;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x8c40;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x462;
        xi = (xi * _x) >> PRECISION;
        res += xi * 0x22;

        return res / 0xde1bc4d19efcac82445da75b00000000;
    }
}
