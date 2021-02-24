// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../converter/types/standard-pool/StandardPoolConverter.sol";
import "./TestTime.sol";

contract TestStandardPoolConverter is StandardPoolConverter, TestTime {
    uint256[] public reserveAmountsRemoved = new uint256[](2);

    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public StandardPoolConverter(_token, _registry, _maxConversionFee) {}

    function removeLiquidityTest(
        uint256 _amount,
        IERC20[] memory _reserveTokens,
        uint256[] memory _reserveMinReturnAmounts
    ) public {
        reserveAmountsRemoved = removeLiquidity(_amount, _reserveTokens, _reserveMinReturnAmounts);
    }

    function time() internal view override(Time, TestTime) returns (uint256) {
        return TestTime.time();
    }
}
