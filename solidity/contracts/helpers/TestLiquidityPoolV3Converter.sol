// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/liquidity-pool-v3/LiquidityPoolV3Converter.sol";

contract TestLiquidityPoolV3Converter is LiquidityPoolV3Converter {
    uint256 public currentTime = 1;

    constructor(
        IDSToken _token,
        IContractRegistry _registry,
        uint32 _maxConversionFee
    )
        LiquidityPoolV3Converter(_token, _registry, _maxConversionFee)
        public
    {
    }

    function time() internal view override returns (uint256) {
        return currentTime;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }
}
