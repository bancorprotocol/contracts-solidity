// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/liquidity-pool-v1/LiquidityPoolV1Converter.sol";

contract TestLiquidityPoolV1Converter is LiquidityPoolV1Converter {
    uint256 public currentTime = 1;
    uint256[] public reserveAmountsRemoved;

    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    ) public LiquidityPoolV1Converter(_token, _registry, _maxConversionFee) {}

    function time() internal view override returns (uint256) {
        return currentTime;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }

    function removeLiquidityTest(
        uint256 _amount,
        IERC20Token[] memory _reserveTokens,
        uint256[] memory _reserveMinReturnAmounts
    ) public {
        reserveAmountsRemoved = removeLiquidity(_amount, _reserveTokens, _reserveMinReturnAmounts);
    }
}
