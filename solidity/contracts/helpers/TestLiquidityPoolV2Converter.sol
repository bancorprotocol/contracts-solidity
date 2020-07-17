pragma solidity 0.4.26;
import "../converter/types/liquidity-pool-v2/LiquidityPoolV2Converter.sol";

contract TestLiquidityPoolV2Converter is LiquidityPoolV2Converter {
    uint256 private currentTime;

    constructor(IPoolTokensContainer _token, IContractRegistry _registry, uint32 _maxConversionFee)
        public LiquidityPoolV2Converter(_token, _registry, _maxConversionFee) {
    }

    function setReferenceRateUpdateTime(uint256 _referenceRateUpdateTime) public {
        referenceRateUpdateTime = _referenceRateUpdateTime;
    }

    function time() internal view returns (uint256) {
        return currentTime != 0 ? currentTime : now;
    }

    function setTime(uint256 _currentTime) public {
        currentTime = _currentTime;
    }

    function calculateAdjustedFeeTest(
        uint256 _primaryReserveStaked,
        uint256 _secondaryReserveStaked,
        uint256 _primaryReserveWeight,
        uint256 _secondaryReserveWeight,
        uint256 _primaryReserveRate,
        uint256 _secondaryReserveRate,
        uint256 _conversionFee)
        external
        pure
        returns (uint256)
    {
        return calculateAdjustedFee(
            _primaryReserveStaked,
            _secondaryReserveStaked,
            _primaryReserveWeight,
            _secondaryReserveWeight,
            _primaryReserveRate,
            _secondaryReserveRate,
            _conversionFee);
    }
}
