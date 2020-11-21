// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/LiquidityProtection.sol";
import "./TestTime.sol";

contract TestLiquidityProtection is LiquidityProtection, TestTime {
    constructor(
        ILiquidityProtectionSettings _settings,
        ILiquidityProtectionStore _store,
        ITokenGovernance _networkTokenGovernance,
        ITokenGovernance _govTokenGovernance
    ) public LiquidityProtection(_settings, _store, _networkTokenGovernance, _govTokenGovernance) {}

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
        Fraction memory rate = reserveTokenAverageRate(_poolToken, _reserveToken, true);
        return (rate.n, rate.d);
    }

    function time() public view virtual override(Time, TestTime) returns (uint256) {
        return TestTime.time();
    }
}
