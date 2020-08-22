// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../utility/SafeMath.sol";

/*
    Utils test helper that exposes the safe math functions
*/
contract TestSafeMath {
    using SafeMath for uint256;

    function testSafeAdd(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.add(_y);
    }

    function testSafeSub(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.sub(_y);
    }

    function testSafeMul(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.mul(_y);
    }

    function testSafeDiv(uint256 _x, uint256 _y) public pure returns (uint256) {
        return _x.div(_y);
    }
}
