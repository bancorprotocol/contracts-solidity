// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/*
    Whitelist interface
*/
abstract contract IWhitelist {
    function isWhitelisted(address _address) public virtual view returns (bool);
}
