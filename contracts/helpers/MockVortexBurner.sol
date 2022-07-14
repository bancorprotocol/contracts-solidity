// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

contract MockVortexBurner {
    uint256 _total = 1000;

    function totalBurnedAmount() external view returns (uint256) {
        return _total;
    }
}
