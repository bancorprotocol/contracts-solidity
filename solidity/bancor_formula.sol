pragma solidity ^0.4.9;
import "owned.sol";

/*
    Open issues:
    - the formula is not yet super accurate, especially for very small/very high ratios
    - need to add overflow protection
    - possibly support changing the CRR precision in the future
    - change exp to use a predefined constant array (for ni) instead of calculating it each call
*/

contract BancorFormula is owned {
    uint8 constant PRECISION = 32;  // fractional bits

    string public version = '0.1';
    address public newFormula;

    function BancorFormula() {
    }

    function setNewFormula(address _formula) public onlyOwner {
        newFormula = _formula;
    }

    /*
        given a token supply, reserve, CRR and a deposit amount (in the reserve token), calculates the value that the account needs to get in return (in the main token)

        _supply             token total supply
        _reserveBalance     total reserve
        _reserveRatio       constant reserve ratio, 1-99
        _depositAmount      deposit amount, in reserve token
    */
    function calculatePurchaseValue(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _depositAmount) public constant returns (uint256 value) {
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
        given a token supply, reserve, CRR and a sell amount (in the main token), calculates the value that the account needs to get in return (in the reserve token)

        _supply             token total supply
        _reserveBalance     total reserve
        _reserveRatio       constant reserve ratio, 1-99
        _sellAmount         sell amount, in the token itself
    */
    function calculateSaleValue(uint256 _supply, uint256 _reserveBalance, uint16 _reserveRatio, uint256 _sellAmount) public constant returns (uint256 value) {
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
        return (fixedLog2(_x) * 1488522236) >> 31; // 1,488,522,236 = ln(2) * (2 ^ 31)
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
    
    function fixedExp(uint256 _x) private returns (uint256) {
        uint256 fixedOne = uint256(1) << PRECISION;

        // TODO: change to constant array instead of calculating each time        
		uint256[34 + 1] memory ni;
		ni[0] = 295232799039604140847618609643520000000;
		for (uint8 n = 1; n < ni.length; ++n)
		    ni[n] = ni[n - 1] / n;

		uint256 res = ni[0] << PRECISION;
		uint256 xi = fixedOne;
		for (uint8 i = 1; i < ni.length; ++i) {
    	    xi = (xi * _x) >> PRECISION;
			res += xi * ni[i];
		}

		return res / ni[0];
    }

    function() {
        throw;
    }
}
