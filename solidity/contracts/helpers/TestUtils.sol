pragma solidity ^0.4.24;
import '../utility/Utils.sol';

/*
    Utils test helper that exposes the safe math functions
*/
contract TestUtils is Utils {
    constructor() public {
    }

    function testSafeAdd(uint256 _x, uint256 _y) public pure returns (uint256) {
        return super.safeAdd(_x, _y);
    }

    function testSafeSub(uint256 _x, uint256 _y) public pure returns (uint256) {
        return super.safeSub(_x, _y);
    }

    function testSafeMul(uint256 _x, uint256 _y) public pure returns (uint256) {
        return super.safeMul(_x, _y);
    }
}
