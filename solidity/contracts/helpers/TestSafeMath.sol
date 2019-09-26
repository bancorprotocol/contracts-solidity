pragma solidity 0.4.26;
import '../utility/SafeMath.sol';

/*
    Utils test helper that exposes the safe math functions
*/
contract TestSafeMath {
    using SafeMath for uint256;


    constructor() public {
    }

    function testSafeAdd(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.add(_y);
    }

    function testSafeSub(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.sub(_y);
    }

    function testSafeMul(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.mul(_y);
    }
}
