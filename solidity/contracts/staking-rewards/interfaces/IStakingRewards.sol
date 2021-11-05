// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "../../liquidity-protection/interfaces/ILiquidityProvisionEventsSubscriber.sol";

import "./IStakingRewardsStore.sol";

interface IStakingRewards is ILiquidityProvisionEventsSubscriber {
    /**
     * @dev triggered when pending rewards are being claimed
     */
    event RewardsClaimed(address indexed provider, uint256 amount);

    /**
     * @dev triggered when pending rewards are being staked in a pool
     */
    event RewardsStaked(address indexed provider, IDSToken indexed poolToken, uint256 amount, uint256 indexed newId);

    function store() external view returns (IStakingRewardsStore);

    function pendingRewards(address provider) external view returns (uint256);

    function pendingPoolRewards(address provider, IDSToken poolToken) external view returns (uint256);

    function pendingReserveRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken
    ) external view returns (uint256);

    function rewardsMultiplier(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken
    ) external view returns (uint32);

    function totalClaimedRewards(address provider) external view returns (uint256);

    function claimRewards() external returns (uint256);

    function stakeRewards(uint256 maxAmount, IDSToken newPoolToken) external returns (uint256, uint256);

    function stakeReserveRewards(
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 maxAmount,
        IDSToken newPoolToken
    ) external returns (uint256, uint256);

    function storePoolRewards(address[] calldata providers, IDSToken poolToken) external;
}
