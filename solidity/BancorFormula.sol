pragma solidity ^0.4.8;
import "./Owned.sol";

/*
    Open issues:
    - the formula is not yet super accurate, especially for very small/very high ratios
    - need to add overflow protection
    - possibly support changing the CRR precision in the future
    - change exp to use a predefined constant array (for ni) instead of calculating it each call
*/

contract BancorFormula is Owned {
    uint8 constant PRECISION = 32;  // fractional bits

    string public version = '0.1';
    address public newFormula;

    function BancorFormula() {
    }

    function setNewFormula(address _formula) public onlyOwner {
        newFormula = _formula;
    }

    /*
        given a token supply, reserve, CRR and a deposit amount (in the reserve token), calculates the return for a given change (in the main token)

        _supply             token total supply
        _reserveBalance     total reserve
        _reserveRatio       constant reserve ratio, 1-99
        _depositAmount      deposit amount, in reserve token
    */
    function calculatePurchaseReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256 amount) {
        if (_supply == 0 || _reserveBalance == 0 || _reserveRatio < 1 || _reserveRatio > 99 || _depositAmount == 0) // validate input
            throw;
        // limiting input to 128bit to provide *some* overflow protection while keeping the interface generic 256bit
        // TODO: will need to revisit this
        if (_supply > uint128(-1) || _reserveBalance > uint128(-1) || _depositAmount > uint128(-1))
            throw;

        var (resN, resD) = power(uint128(_depositAmount + _reserveBalance), uint128(_reserveBalance), _reserveRatio, 100);
        return (_supply * resN / resD) - _supply;
    }

    /*
        given a token supply, reserve, CRR and a sell amount (in the main token), calculates the return for a given change (in the reserve token)

        _supply             token total supply
        _reserveBalance     total reserve
        _reserveRatio       constant reserve ratio, 1-99
        _sellAmount         sell amount, in the token itself
    */
    function calculateSaleReturn(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256 amount) {
        if (_supply == 0 || _reserveBalance == 0 || _reserveRatio < 1 || _reserveRatio > 99 || _sellAmount == 0) // validate input
            throw;
        // limiting input to 128bit to provide *some* overflow protection while keeping the interface generic 256bit
        // TODO: will need to revisit this
        if (_supply > uint128(-1) || _reserveBalance > uint128(-1) || _sellAmount > uint128(-1))
            throw;

        var (resN, resD) = power(uint128(_sellAmount + _supply), uint128(_supply), 100, _reserveRatio);
        return (_reserveBalance * resN / resD) - _reserveBalance;
    }

    function power(uint128 _baseN, uint128 _baseD, uint32 _expN, uint32 _expD) private returns (uint256 resN, uint256 resD) {
        return (fixedExp(ln(_baseN, _baseD) * _expN / _expD), uint256(1) << PRECISION);
	}
    
    function ln(uint128 _numerator, uint128 _denominator) private returns (uint256) {
        return fixedLoge(uint256(_numerator) << PRECISION) - fixedLoge(uint256(_denominator) << PRECISION);
    }

    function fixedLoge(uint256 _x) private returns (uint256) {
        /*
        Might be room enough to choose an even higher number, e.g.
        ln(2) * ( 2 ^ 37), which is 47632711549.11315
        Much better accuracy, and less rounding errors
        */ 

        return (fixedLog2(_x) * 2977044471) >> 32; // 2977044471.819572 = ln(2) * (2 ^ 32)
    }

    function fixedLog2(uint256 _x) private returns (uint256) {
        uint256 fixedOne = uint256(1) << PRECISION;
        uint256 fixedTwo = uint256(2) << PRECISION;

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

        return hi - lo;
    }
    /*
     fixedExp 
     Calculates e^x according to maclauren summation:
      e^x = 1+x+x^2/2!...+x^n/n!
     
     _x : An input assumed to already be upshifted for accuracy
     
     returns e^(x>>32) << 32 , that is, upshifted for accuracy
    */
    function fixedExp(uint256 _x) constant returns (uint256) {
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


    function() {
        throw;
    }
}
