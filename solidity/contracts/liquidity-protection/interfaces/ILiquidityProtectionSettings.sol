// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../converter/interfaces/IConverterAnchor.sol";

/*
    Liquidity Protection Store Settings interface
*/
interface ILiquidityProtectionSettings {
    function addHighTierPool(IConverterAnchor _poolAnchor) external;

    function removeHighTierPool(IConverterAnchor _poolAnchor) external;

    function isHighTierPool(IConverterAnchor _poolAnchor) external view returns (bool);

    function maxSystemNetworkTokenAmount() external view returns (uint256);

    function maxSystemNetworkTokenRatio() external view returns (uint32);

    function setSystemNetworkTokenLimits(uint256 _maxSystemNetworkTokenAmount, uint32 _maxSystemNetworkTokenRatio)
        external;

    function minProtectionDelay() external view returns (uint256);

    function maxProtectionDelay() external view returns (uint256);

    function setProtectionDelays(uint256 _minProtectionDelay, uint256 _maxProtectionDelay) external;

    function minNetworkCompensation() external view returns (uint256);

    function setMinNetworkCompensation(uint256 _minCompensation) external;

    function lockDuration() external view returns (uint256);

    function setLockDuration(uint256 _lockDuration) external;

    function averageRateMaxDeviation() external view returns (uint32);

    function setAverageRateMaxDeviation(uint32 _averageRateMaxDeviation) external;
}
