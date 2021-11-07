// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../converter/types/standard-pool/StandardPoolConverter.sol";

import "./TestTime.sol";

contract TestStandardPoolConverter is StandardPoolConverter, TestTime {
    constructor(
        IDSToken token,
        IContractRegistry registry,
        uint32 maxConversionFee
    ) public StandardPoolConverter(token, registry, maxConversionFee) {}

    function _time() internal view override(Time, TestTime) returns (uint256) {
        return TestTime._time();
    }
}
