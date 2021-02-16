// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./TestStandardPoolConverter.sol";

contract TestFixedRatePoolConverter is TestStandardPoolConverter {
    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public TestStandardPoolConverter(_token, _registry, _maxConversionFee) {}
}
