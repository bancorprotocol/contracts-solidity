// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

contract TestCall {
    uint256 private _num;
    string private _str;

    function num() external view returns (uint256) {
        return _num;
    }

    function str() external view returns (string memory) {
        return _str;
    }

    function set(uint256 newNum, string calldata newStr) external {
        _num = newNum;
        _str = newStr;
    }

    function error() external pure {
        revert("ERR_REVERT");
    }
}
