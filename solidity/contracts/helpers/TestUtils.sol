pragma solidity ^0.4.11;
import '../Utils.sol';

/*
    Utils test helper that exposes the safe math functions
*/
contract TestUtils is Utils {
    function TestUtils() {
    }

    function testSafeAdd(uint256 _x, uint256 _y) public constant returns (uint256) {
        return super.safeAdd(_x, _y);
    }

    function testSafeSub(uint256 _x, uint256 _y) public constant returns (uint256) {
        return super.safeSub(_x, _y);
    }

    function testSafeMul(uint256 _x, uint256 _y) public constant returns (uint256) {
        return super.safeMul(_x, _y);
    }
}
