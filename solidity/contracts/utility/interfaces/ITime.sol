// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/*
    Time implementing contract interface
*/
interface ITime {
    /**
     * @dev returns the current time
     */
    function time() external view returns (uint256);
}
