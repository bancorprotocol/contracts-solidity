// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../converter/types/liquidity-pool-v1/LiquidityPoolV1Converter.sol";
import "./TestTime.sol";

contract TestLiquidityPoolV1Converter is LiquidityPoolV1Converter, TestTime {
    uint256[] public reserveAmountsRemoved;

    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public LiquidityPoolV1Converter(_token, _registry, _maxConversionFee) {}

    function removeLiquidityTest(
        uint256 _amount,
        IReserveToken[] memory _reserveTokens,
        uint256[] memory _reserveMinReturnAmounts
    ) public {
        reserveAmountsRemoved = removeLiquidity(_amount, _reserveTokens, _reserveMinReturnAmounts);
    }

    function time() internal view override(Time, TestTime) returns (uint256) {
        return TestTime.time();
    }
}
