// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ILiquidityProtectionEventsSubscriber.sol";
import "../../converter/interfaces/IConverterAnchor.sol";

/*
    Liquidity Protection Store Settings interface
*/
interface ILiquidityProtectionSettings {
    function isPoolWhitelisted(IConverterAnchor poolAnchor) external view returns (bool);

    function poolWhitelist() external view returns (address[] memory);

    function subscribers() external view returns (address[] memory);

    function isPoolSupported(IConverterAnchor poolAnchor) external view returns (bool);

    function minNetworkTokenLiquidityForMinting() external view returns (uint256);

    function defaultNetworkTokenMintingLimit() external view returns (uint256);

    function networkTokenMintingLimits(IConverterAnchor poolAnchor) external view returns (uint256);

    function addLiquidityDisabled(IConverterAnchor poolAnchor, IERC20 reserveToken) external view returns (bool);

    function minProtectionDelay() external view returns (uint256);

    function maxProtectionDelay() external view returns (uint256);

    function minNetworkCompensation() external view returns (uint256);

    function lockDuration() external view returns (uint256);

    function averageRateMaxDeviation() external view returns (uint32);
}
