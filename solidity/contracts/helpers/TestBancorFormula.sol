pragma solidity ^0.4.11;
import '../BancorFormula.sol';

/*
    BancorFormula test helper that exposes some BancorFormula functions
*/
contract TestBancorFormula is BancorFormula {
    function TestBancorFormula() public {
    }

    function powerTest(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) external view returns (uint256, uint8) {
        return super.power(_baseN, _baseD, _expN, _expD);
    }

    function lnTest(uint256 _numerator, uint256 _denominator) external pure returns (uint256) {
        return super.ln(_numerator, _denominator);
    }

    function findPositionInMaxExpArrayTest(uint256 _x) external view returns (uint8) {
        return super.findPositionInMaxExpArray(_x);
    }

    function fixedExpTest(uint256 _x, uint8 _precision) external pure returns (uint256) {
        return super.fixedExp(_x, _precision);
    }

    function floorLog2Test(uint256 _n) external pure returns (uint8) {
        return super.floorLog2(_n);
    }

    function powTest(uint256 a, uint256 b, uint256 c, uint256 d) external pure returns (uint256) {
        return super.pow(a, b, c, d);
    }

    function logTest(uint256 x) external pure returns (uint256) {
        return super.log(x);
    }

    function expTest(uint256 x) external pure returns (uint256) {
        return super.exp(x);
    }
}
