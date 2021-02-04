// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./ILiquidityProtectionEventsSubscriber.sol";
import "../../converter/interfaces/IConverterAnchor.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection Store Settings interface
*/
interface ILiquidityProtectionSettings {
    function addPoolToWhitelist(IConverterAnchor _poolAnchor) external;

    function removePoolFromWhitelist(IConverterAnchor _poolAnchor) external;

    function isPoolWhitelisted(IConverterAnchor _poolAnchor) external view returns (bool);

    function poolWhitelist() external view returns (address[] memory);

    function addSubscriber(ILiquidityProtectionEventsSubscriber _subscriber) external;

    function removeSubscriber(ILiquidityProtectionEventsSubscriber _subscriber) external;

    function subscribers() external view returns (address[] memory);

    function isPoolSupported(IConverterAnchor _poolAnchor) external view returns (bool);

    function minNetworkTokenLiquidityForMinting() external view returns (uint256);

    function defaultNetworkTokenMintingLimit() external view returns (uint256);

    function networkTokenMintingLimits(IConverterAnchor _poolAnchor) external view returns (uint256);

    function addLiquidityDisabled(IConverterAnchor _poolAnchor, IERC20Token _reserveToken) external view returns (bool);

    function disableAddLiquidity(IConverterAnchor _poolAnchor, IERC20Token _reserveToken, bool _disable) external;

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
