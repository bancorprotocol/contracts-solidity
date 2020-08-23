// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;

/*
    Owned contract interface
*/
abstract contract IOwned {
    // this function isn't abstract since the compiler emits automatically generated getter functions as external
    function owner() external virtual view returns (address);

    function transferOwnership(address _newOwner) public virtual;
    function acceptOwnership() public virtual;
}
