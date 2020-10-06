// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/**
  * @dev ReentrancyGuard
  *
  * The contract provides protection against re-entrancy - calling a function (directly or
  * indirectly) from within itself.
*/
contract ReentrancyGuard {
    // 1 while protected code is being executed, 0 otherwise
    uint256 private locked = 0;

    /**
      * @dev ensures instantiation only by sub-contracts
    */
    constructor() internal {}

    // protects a function against reentrancy attacks
    modifier protected() {
        _protected();
        locked = 1;
        _;
        locked = 0;
    }

    // error message binary size optimization
    function _protected() internal view {
        require(locked == 0, "ERR_REENTRANCY");
    }
}
