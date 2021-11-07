// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../converter/interfaces/IConverterAnchor.sol";

import "../../token/interfaces/IDSToken.sol";
import "../../token/interfaces/IReserveToken.sol";

import "../../utility/interfaces/IOwned.sol";

/**
 * @dev Liquidity Protection Store interface
 */
interface ILiquidityProtectionStore is IOwned {
    function withdrawTokens(
        IReserveToken token,
        address recipient,
        uint256 amount
    ) external;

    function protectedLiquidity(uint256 id)
        external
        view
        returns (
            address,
            IDSToken,
            IReserveToken,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );

    function addProtectedLiquidity(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 reserveRateN,
        uint256 reserveRateD,
        uint256 timestamp
    ) external returns (uint256);

    function updateProtectedLiquidityAmounts(
        uint256 id,
        uint256 poolNewAmount,
        uint256 reserveNewAmount
    ) external;

    function removeProtectedLiquidity(uint256 id) external;

    function lockedBalance(address provider, uint256 index) external view returns (uint256, uint256);

    function lockedBalanceRange(
        address provider,
        uint256 startIndex,
        uint256 endIndex
    ) external view returns (uint256[] memory, uint256[] memory);

    function addLockedBalance(
        address provider,
        uint256 reserveAmount,
        uint256 expirationTime
    ) external returns (uint256);

    function removeLockedBalance(address provider, uint256 index) external;

    function systemBalance(IReserveToken poolToken) external view returns (uint256);

    function incSystemBalance(IReserveToken poolToken, uint256 poolAmount) external;

    function decSystemBalance(IReserveToken poolToken, uint256 poolAmount) external;
}
