// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/*
    Time implementing contract
*/
contract Time {
    /**
     * @dev returns the current time
     */
    function time() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
