// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./interfaces/ITime.sol";

/*
    Time implementing contract
*/
contract Time is ITime {
    /**
     * @dev returns the current time
     */
    function time() public view virtual override returns (uint256) {
        return block.timestamp;
    }
}
