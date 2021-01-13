// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../liquidity-protection/interfaces/ILiquidityProtectionEventsSubscriber.sol";

/**
 * @dev Liquidity protection events subscriber interface
 */
contract TestLiquidityProtectionEventsSubscriber is ILiquidityProtectionEventsSubscriber {
    uint256 private _id;
    address private _provider;
    IConverterAnchor private _poolAnchor;
    IERC20Token private _reserveToken;
    uint256 private _poolAmount;
    uint256 private _reserveAmount;
    bool private _adding;

    function onAddingLiquidity(
        address provider,
        IConverterAnchor poolAnchor,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override {
        _adding = true;

        _id = 0;
        _provider = provider;
        _poolAnchor = poolAnchor;
        _reserveToken = reserveToken;
        _poolAmount = poolAmount;
        _reserveAmount = reserveAmount;
    }

    function onRemovingLiquidity(
        uint256 id,
        address provider,
        IConverterAnchor poolAnchor,
        IERC20Token reserveToken,
        uint256 poolAmount,
        uint256 reserveAmount
    ) external override {
        _adding = false;

        _id = id;
        _provider = provider;
        _poolAnchor = poolAnchor;
        _reserveToken = reserveToken;
        _poolAmount = poolAmount;
        _reserveAmount = reserveAmount;
    }

    function id() external view returns (uint256) {
        return _id;
    }

    function provider() external view returns (address) {
        return _provider;
    }

    function poolAnchor() external view returns (IConverterAnchor) {
        return _poolAnchor;
    }

    function reserveToken() external view returns (IERC20Token) {
        return _reserveToken;
    }

    function poolAmount() external view returns (uint256) {
        return _poolAmount;
    }

    function reserveAmount() external view returns (uint256) {
        return _reserveAmount;
    }

    function adding() external view returns (bool) {
        return _adding;
    }
}
