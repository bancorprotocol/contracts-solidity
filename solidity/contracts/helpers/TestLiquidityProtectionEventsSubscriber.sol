// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/interfaces/ILiquidityProtectionEventsSubscriber.sol";

/**
 * @dev Liquidity protection events subscriber interface
 */
contract TestLiquidityProtectionEventsSubscriber is ILiquidityProtectionEventsSubscriber {
    struct LiquidityProtectionEvent {
        uint256 id;
        address provider;
        IConverterAnchor poolAnchor;
        IReserveToken reserveToken;
        uint256 poolAmount;
        uint256 reserveAmount;
        bool adding;
    }

    LiquidityProtectionEvent[] private _events;

    function onAddingLiquidity(
        address provider,
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override {
        _events.push(
            LiquidityProtectionEvent({
                id: 0,
                provider: provider,
                poolAnchor: poolAnchor,
                reserveToken: reserveToken,
                poolAmount: poolAmount,
                reserveAmount: reserveAmount,
                adding: true
            })
        );
    }

    function onRemovingLiquidity(
        uint256 id,
        address provider,
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override {
        _events.push(
            LiquidityProtectionEvent({
                id: id,
                provider: provider,
                poolAnchor: poolAnchor,
                reserveToken: reserveToken,
                poolAmount: poolAmount,
                reserveAmount: reserveAmount,
                adding: false
            })
        );
    }

    function reset() external {
        delete _events;
    }

    function events(uint256 id)
        external
        view
        returns (
            uint256,
            address,
            IConverterAnchor,
            IReserveToken,
            uint256,
            uint256,
            bool
        )
    {
        LiquidityProtectionEvent memory e = _events[id];

        return (e.id, e.provider, e.poolAnchor, e.reserveToken, e.poolAmount, e.reserveAmount, e.adding);
    }

    function eventCount() external view returns (uint256) {
        return _events.length;
    }
}
