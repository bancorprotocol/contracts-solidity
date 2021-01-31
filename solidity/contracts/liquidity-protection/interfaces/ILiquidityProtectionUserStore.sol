// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;
import "../../token/interfaces/IDSToken.sol";
import "../../token/interfaces/IERC20Token.sol";

/*
    Liquidity Protection User Store interface
*/
interface ILiquidityProtectionUserStore {
    function position(uint256 id)
        external
        view
        returns (
            address,
            IDSToken,
            IERC20Token,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256
        );

    function addPosition(
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 reserveRateN,
        uint256 reserveRateD,
        uint256 timestamp
    ) external returns (uint256);

    function updatePositionAmounts(
        uint256 id,
        uint256 poolNewAmount,
        uint256 reserveNewAmount
    ) external;

    function removePosition(uint256 id) external;

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

    function seedPosition(
        uint256 id,
        address provider,
        IDSToken poolToken,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount,
        uint256 reserveRateN,
        uint256 reserveRateD,
        uint256 timestamp
    ) external;
}
