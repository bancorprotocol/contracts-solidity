// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../converter/types/liquidity-pool-v2/LiquidityPoolV2Converter.sol";

contract TestLiquidityPoolV2Converter is LiquidityPoolV2Converter {
    uint256 public currentTime;

    constructor(IPoolTokensContainer _token, IContractRegistry _registry, uint32 _maxConversionFee)
        public LiquidityPoolV2Converter(_token, _registry, _maxConversionFee) {
    }

    function setExternalRateUpdateTime(uint256 _externalRateUpdateTime) public {
        externalRateUpdateTime = _externalRateUpdateTime;
    }

    function time() internal view override returns (uint256) {
        return currentTime != 0 ? currentTime : now;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }

    function setReserveWeight(IERC20Token _reserveToken, uint32 _weight)
        public
        validReserve(_reserveToken)
    {
        reserves[_reserveToken].weight = _weight;

        if (_reserveToken == primaryReserveToken) {
            reserves[secondaryReserveToken].weight = PPM_RESOLUTION - _weight;
        }
        else {
            reserves[primaryReserveToken].weight = PPM_RESOLUTION - _weight;
        }
    }
}
