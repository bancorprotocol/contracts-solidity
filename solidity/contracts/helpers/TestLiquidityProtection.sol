// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../liquidity-protection/LiquidityProtection.sol";

contract TestLiquidityProtection is LiquidityProtection {
    uint256 public currentTime = 1;

    constructor(
        ILiquidityProtectionStore _store,
        IDSToken _networkToken,
        IDSToken _govToken,
        IContractRegistry _registry)
        LiquidityProtection(_store, _networkToken, _govToken, _registry)
        public
    {
    }

    function time() internal view override returns (uint256) {
        return currentTime;
    }

    function _minNetworkCompensation() internal view override returns (uint256) {
        return 3;
    }

    function setTime(uint256 _currentTime) external {
        currentTime = _currentTime;
    }

    function impLossTest(uint256 _initialRateN, uint256 _initialRateD, uint256 _currentRateN, uint256 _currentRateD) external pure returns (uint256, uint256) {
        Fraction memory initialRate = Fraction({ n: _initialRateN, d: _initialRateD });
        Fraction memory currentRate = Fraction({ n: _currentRateN, d: _currentRateD });
        Fraction memory impLossRate = impLoss(initialRate, currentRate);
        return (impLossRate.n, impLossRate.d);
    }

    function averageRateTest(IDSToken _poolToken, IERC20Token _reserveToken) external view returns (uint256, uint256) {
        Fraction memory rate = reserveTokenAverageRate(_poolToken, _reserveToken);
        return (rate.n, rate.d);
    }
}
