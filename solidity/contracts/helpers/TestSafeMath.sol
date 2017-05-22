pragma solidity ^0.4.11;
import '../SafeMath.sol';

/*
    Test token with predefined supply
*/
contract TestSafeMath is SafeMath {
    function TestSafeMath() {
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
