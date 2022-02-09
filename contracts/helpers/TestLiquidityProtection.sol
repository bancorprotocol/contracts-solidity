// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/LiquidityProtection.sol";

import "./TestTime.sol";

contract TestLiquidityProtection is LiquidityProtection, TestTime {
    bool private _poolTokenRateOverride;
    uint256 private _poolTokenRateN;
    uint256 private _poolTokenRateD;

    constructor(
        IBancorNetworkV3 networkV3,
        address payable vaultV3,
        ILiquidityProtectionSettings settings,
        ILiquidityProtectionStore store,
        ILiquidityProtectionStats stats,
        ILiquidityProtectionSystemStore systemStore,
        ITokenHolder wallet,
        ITokenGovernance networkTokenGovernance,
        ITokenGovernance govTokenGovernance
    )
        public
        LiquidityProtection(
            networkV3,
            vaultV3,
            settings,
            store,
            stats,
            systemStore,
            wallet,
            networkTokenGovernance,
            govTokenGovernance
        )
    {}

    function protectedAmountPlusFeeTest(
        uint256 poolAmount,
        uint256 poolRateN,
        uint256 poolRateD,
        uint256 addRateN,
        uint256 addRateD,
        uint256 removeRateN,
        uint256 removeRateD
    ) external pure returns (uint256) {
        Fraction memory poolRate = Fraction({ n: poolRateN, d: poolRateD });
        Fraction memory addRate = Fraction({ n: addRateN, d: addRateD });
        Fraction memory removeRate = Fraction({ n: removeRateN, d: removeRateD });
        return _protectedAmountPlusFee(poolAmount, poolRate, addRate, removeRate);
    }

    function impLossTest(
        uint256 initialRateN,
        uint256 initialRateD,
        uint256 currentRateN,
        uint256 currentRateD
    ) external pure returns (uint256, uint256) {
        Fraction memory initialRate = Fraction({ n: initialRateN, d: initialRateD });
        Fraction memory currentRate = Fraction({ n: currentRateN, d: currentRateD });
        Fraction memory impLossRate = _impLoss(initialRate, currentRate);
        return (impLossRate.n, impLossRate.d);
    }

    function compensationAmountTest(
        uint256 amount,
        uint256 total,
        uint256 lossN,
        uint256 lossD,
        uint256 levelN,
        uint256 levelD
    ) external pure returns (uint256) {
        Fraction memory loss = Fraction({ n: lossN, d: lossD });
        Fraction memory level = Fraction({ n: levelN, d: levelD });
        return _compensationAmount(amount, total, loss, level);
    }

    function averageRateTest(IDSToken poolToken, IReserveToken reserveToken) external view returns (uint256, uint256) {
        (Fraction memory spotRate, Fraction memory averageRate) = _reserveTokenRates(poolToken, reserveToken);
        _verifyRateDeviation(spotRate.n, spotRate.d, averageRate.n, averageRate.d);
        return (averageRate.n, averageRate.d);
    }

    function removeLiquidityTargetAmountTest(
        uint256 poolTokenRateN,
        uint256 poolTokenRateD,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint128 addSpotRateN,
        uint128 addSpotRateD,
        uint128 removeSpotRateN,
        uint128 removeSpotRateD,
        uint128 removeAverageRateN,
        uint128 removeAverageRateD,
        uint256 addTimestamp,
        uint256 removeTimestamp
    ) external returns (uint256) {
        _poolTokenRateOverride = true;
        _poolTokenRateN = poolTokenRateN;
        _poolTokenRateD = poolTokenRateD;

        PackedRates memory packedRates = PackedRates({
            addSpotRateN: addSpotRateN,
            addSpotRateD: addSpotRateD,
            removeSpotRateN: removeSpotRateN,
            removeSpotRateD: removeSpotRateD,
            removeAverageRateN: removeAverageRateN,
            removeAverageRateD: removeAverageRateD
        });

        uint256 targetAmount = _removeLiquidityTargetAmount(
            IDSToken(0),
            IReserveToken(0),
            poolAmount,
            reserveAmount,
            packedRates,
            addTimestamp,
            removeTimestamp
        );
        _poolTokenRateOverride = false;
        return targetAmount;
    }

    function _poolTokenRate(IDSToken poolToken, IReserveToken reserveToken)
        internal
        view
        override
        returns (Fraction memory)
    {
        if (_poolTokenRateOverride) {
            return Fraction({ n: _poolTokenRateN, d: _poolTokenRateD });
        }
        return super._poolTokenRate(poolToken, reserveToken);
    }

    function _time() internal view override(Time, TestTime) returns (uint256) {
        return TestTime._time();
    }
}
