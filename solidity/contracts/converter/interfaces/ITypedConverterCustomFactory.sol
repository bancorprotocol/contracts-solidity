// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

/*
    Typed Converter Custom Factory interface
*/
interface ITypedConverterCustomFactory {
    function converterType() external pure returns (uint16);
}
