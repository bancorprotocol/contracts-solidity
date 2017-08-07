pragma solidity ^0.4.11;
import '../BancorFormula.sol';

/*
    BancorFormula test helper that exposes some BancorFormula functions
*/
contract TestBancorFormula is BancorFormula {
    function TestBancorFormula() {
    }

    function testPower(uint256 _baseN, uint256 _baseD, uint8 _expN, uint8 _expD) public constant returns (uint256, uint8) {
        return super.power(_baseN, _baseD, _expN, _expD);
    }

    function testLn(uint256 _numerator, uint256 _denominator) public constant returns (uint256) {
        return super.ln(_numerator, _denominator);
    }

    function testFindPositionInMaxExpArray(uint256 _x) public constant returns (uint8) {
        return super.findPositionInMaxExpArray(_x);
    }

    function testFixedExp(uint256 _x, uint8 _precision) public constant returns (uint256) {
        return super.fixedExp(_x, _precision);
    }

    function testFloorLog2(uint256 _n) public constant returns (uint8) {
        return super.floorLog2(_n);
    }
}
