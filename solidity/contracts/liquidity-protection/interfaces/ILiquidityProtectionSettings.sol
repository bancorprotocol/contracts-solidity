// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./ILiquidityProtectionEventsSubscriber.sol";
import "../../converter/interfaces/IConverterAnchor.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection Store Settings interface
*/
interface ILiquidityProtectionSettings {
    function addPoolToWhitelist(IConverterAnchor poolAnchor) external;

    function removePoolFromWhitelist(IConverterAnchor poolAnchor) external;

    function isPoolWhitelisted(IConverterAnchor poolAnchor) external view returns (bool);

    function poolWhitelist() external view returns (address[] memory);

    function addSubscriber(ILiquidityProtectionEventsSubscriber subscriber) external;

    function removeSubscriber(ILiquidityProtectionEventsSubscriber subscriber) external;

    function subscribers() external view returns (address[] memory);

    function isPoolSupported(IConverterAnchor poolAnchor) external view returns (bool);

    function minNetworkTokenLiquidityForMinting() external view returns (uint256);

    function defaultNetworkTokenMintingLimit() external view returns (uint256);

    function networkTokenMintingLimits(IConverterAnchor poolAnchor) external view returns (uint256);

    function addLiquidityDisabled(IConverterAnchor poolAnchor, IERC20Token reserveToken) external view returns (bool);

    function disableAddLiquidity(IConverterAnchor poolAnchor, IERC20Token reserveToken, bool disable) external;

    function minProtectionDelay() external view returns (uint256);

    function maxProtectionDelay() external view returns (uint256);

    function setProtectionDelays(uint256 minDelay, uint256 maxDelay) external;

    function minNetworkCompensation() external view returns (uint256);

    function setMinNetworkCompensation(uint256 amount) external;

    function lockDuration() external view returns (uint256);

    function setLockDuration(uint256 duration) external;

    function averageRateMaxDeviation() external view returns (uint32);

    function setAverageRateMaxDeviation(uint32 deviation) external;
}
