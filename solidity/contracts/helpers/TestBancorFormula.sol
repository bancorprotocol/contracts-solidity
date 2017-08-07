pragma solidity ^0.4.11;
import '../BancorFormula.sol';

/*
    BancorFormula test helper that exposes some BancorFormula functions
*/
contract TestBancorFormula is BancorFormula {
    function TestBancorFormula() {
    }

    function testLn(uint256 _numerator, uint256 _denominator) public constant returns (uint256) {
        return super.ln(_numerator, _denominator);
    }

    function testFixedExp(uint256 _x, uint8 _precision) public constant returns (uint256) {
        return super.fixedExp(_x, _precision);
    }
}
