// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/LiquidityProtection.sol";

contract TestLiquidityProtection is LiquidityProtection {
    uint256 public currentTime = 1;
    bool private poolTokenRateOverride;
    uint256 private poolTokenRateN;
    uint256 private poolTokenRateD;

    constructor(
        ILiquidityProtectionStore _store,
        ITokenGovernance _networkTokenGovernance,
        ITokenGovernance _govTokenGovernance,
        IContractRegistry _registry
    ) public LiquidityProtection(_store, _networkTokenGovernance, _govTokenGovernance, _registry) {}

    function time() internal view override returns (uint256) {
        return currentTime;
    }

    function _minNetworkCompensation() internal view override returns (uint256) {
        return 3;
    }

    function setTime(uint256 _currentTime) external {
        currentTime = _currentTime;
    }

    function impLossTest(
        uint256 _initialRateN,
        uint256 _initialRateD,
        uint256 _currentRateN,
        uint256 _currentRateD
    ) external pure returns (uint256, uint256) {
        Fraction memory initialRate = Fraction({ n: _initialRateN, d: _initialRateD });
        Fraction memory currentRate = Fraction({ n: _currentRateN, d: _currentRateD });
        Fraction memory impLossRate = impLoss(initialRate, currentRate);
        return (impLossRate.n, impLossRate.d);
    }

    function averageRateTest(IDSToken _poolToken, IERC20Token _reserveToken) external view returns (uint256, uint256) {
        Fraction memory rate = reserveTokenAverageRate(_poolToken, _reserveToken);
        return (rate.n, rate.d);
    }

    function removeLiquidityTargetAmountTest(
        uint256 _poolTokenRateN,
        uint256 _poolTokenRateD,
        uint256 _poolAmount,
        uint256 _reserveAmount,
        uint128 _addSpotRateN,
        uint128 _addSpotRateD,
        uint128 _removeSpotRateN,
        uint128 _removeSpotRateD,
        uint128 _removeAverageRateN,
        uint128 _removeAverageRateD,
        uint256 _addTimestamp,
        uint256 _removeTimestamp)
        external returns (uint256)
    {
        poolTokenRateOverride = true;
        poolTokenRateN = _poolTokenRateN;
        poolTokenRateD = _poolTokenRateD;

        PackedRates memory packedRates = PackedRates({
            addSpotRateN: _addSpotRateN,
            addSpotRateD: _addSpotRateD,
            removeSpotRateN: _removeSpotRateN,
            removeSpotRateD: _removeSpotRateD,
            removeAverageRateN: _removeAverageRateN,
            removeAverageRateD: _removeAverageRateD
        });

        uint256 targetAmount = removeLiquidityTargetAmount(IDSToken(0), IERC20Token(0), _poolAmount, _reserveAmount, packedRates, _addTimestamp, _removeTimestamp);
        poolTokenRateOverride = false;
        return targetAmount;
    }

    function poolTokenRate(IDSToken _poolToken, IERC20Token _reserveToken) internal view override returns (Fraction memory) {
        if (poolTokenRateOverride) {
            return Fraction({ n: poolTokenRateN, d: poolTokenRateD });
        }
        return super.poolTokenRate(_poolToken, _reserveToken);
    }
}
