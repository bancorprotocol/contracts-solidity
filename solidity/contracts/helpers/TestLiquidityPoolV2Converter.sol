// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity >=0.6.12 <0.7.0;
import "../converter/types/liquidity-pool-v2/LiquidityPoolV2Converter.sol";

contract TestLiquidityPoolV2Converter is LiquidityPoolV2Converter {
    uint256 internal currentTime;

    constructor(IPoolTokensContainer _token, IContractRegistry _registry, uint32 _maxConversionFee)
        public LiquidityPoolV2Converter(_token, _registry, _maxConversionFee) {
    }

    function time() internal override view returns (uint256) {
        return currentTime != 0 ? currentTime : now;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }

    function setPrevConversionTime(uint256 _prevConversionTime) public {
        prevConversionTime = _prevConversionTime;
    }

    function calculateFeeTest(
        IERC20Token _sourceToken,
        IERC20Token _targetToken,
        uint32 _sourceWeight,
        uint32 _targetWeight,
        uint256 _externalRateN,
        uint256 _externalRateD,
        uint32 _targetExternalWeight,
        uint256 _targetAmount)
        external
        view
        returns (uint256)
    {
        return calculateFee(
            _sourceToken,
            _targetToken,
            _sourceWeight,
            _targetWeight,
            Fraction(_externalRateN, _externalRateD),
            _targetExternalWeight,
            _targetAmount);
    }

    function normalizedRatioTest(uint256 _a, uint256 _b, uint256 _scale) external pure returns (uint256, uint256) {
        return normalizedRatio(_a, _b, _scale);
    }

    function accurateRatioTest(uint256 _a, uint256 _b, uint256 _scale) external pure returns (uint256, uint256) {
        return accurateRatio(_a, _b, _scale);
    }

    function reducedRatioTest(uint256 _n, uint256 _d, uint256 _max) external pure returns (uint256, uint256) {
        return reducedRatio(_n, _d, _max);
    }

    function roundDivTest(uint256 _n, uint256 _d) external pure returns (uint256) {
        return roundDiv(_n, _d);
    }

    function weightedAverageIntegersTest(uint256 _x, uint256 _y, uint256 _n, uint256 _d) external pure returns (uint256) {
        return weightedAverageIntegers(_x, _y, _n, _d);
    }

    function compareRatesTest(uint256 _xn, uint256 _xd, uint256 _yn, uint256 _yd) external pure returns (int8) {
        return compareRates(Fraction(_xn, _xd), Fraction(_yn, _yd));
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
