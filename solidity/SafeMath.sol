pragma solidity ^0.4.10;

/*
    overflow protected math functions
*/
contract SafeMath {
    function SafeMath() {
    }

    function safeAdd(uint256 a, uint256 b) internal returns (uint256) {
        uint c = a + b;
        assert(c >= a);
        return c;
    }

    function safeSub(uint256 a, uint256 b) internal returns (uint256) {
        assert(a >= b);
        return a - b;
    }

    function safeMul(uint256 a, uint256 b) internal returns (uint256) {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }
}
