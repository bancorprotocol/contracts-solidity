// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "./ILiquidityProtectionStore.sol";
import "./ILiquidityProtectionStats.sol";
import "./ILiquidityProtectionSettings.sol";
import "./ILiquidityProtectionSystemStore.sol";
import "./ITransferPositionCallback.sol";

import "../../utility/interfaces/ITokenHolder.sol";

import "../../token/interfaces/IReserveToken.sol";

import "../../converter/interfaces/IConverterAnchor.sol";

/**
 * @dev Liquidity Protection interface
 */
interface ILiquidityProtection {
    function store() external view returns (ILiquidityProtectionStore);

    function stats() external view returns (ILiquidityProtectionStats);

    function settings() external view returns (ILiquidityProtectionSettings);

    function systemStore() external view returns (ILiquidityProtectionSystemStore);

    function wallet() external view returns (ITokenHolder);

    function addLiquidityFor(
        address owner,
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 amount
    ) external payable returns (uint256);

    function addLiquidity(
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 amount
    ) external payable returns (uint256);

    function removeLiquidity(uint256 id, uint32 portion) external;

    function transferPosition(uint256 id, address newProvider) external returns (uint256);

    function transferPositionAndNotify(
        uint256 id,
        address newProvider,
        ITransferPositionCallback callback,
        bytes calldata data
    ) external returns (uint256);
}
