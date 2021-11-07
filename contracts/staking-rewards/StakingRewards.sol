// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@bancor/token-governance/contracts/ITokenGovernance.sol";

import "../utility/ContractRegistryClient.sol";
import "../utility/Utils.sol";
import "../utility/Time.sol";
import "../utility/interfaces/ICheckpointStore.sol";

import "../token/ReserveToken.sol";

import "../liquidity-protection/interfaces/ILiquidityProtection.sol";

import "./interfaces/IStakingRewards.sol";

/**
 * @dev This contract manages the distribution of the staking rewards
 */
contract StakingRewards is IStakingRewards, AccessControl, Time, Utils, ContractRegistryClient {
    using SafeMath for uint256;
    using ReserveToken for IReserveToken;
    using SafeERC20 for IERC20;
    using SafeERC20Ex for IERC20;

    // the role is used to globally govern the contract and its governing roles.
    bytes32 public constant ROLE_SUPERVISOR = keccak256("ROLE_SUPERVISOR");

    // the roles is used to restrict who is allowed to publish liquidity protection events.
    bytes32 public constant ROLE_PUBLISHER = keccak256("ROLE_PUBLISHER");

    // the roles is used to restrict who is allowed to update/cache provider rewards.
    bytes32 public constant ROLE_UPDATER = keccak256("ROLE_UPDATER");

    // the weekly 25% increase of the rewards multiplier (in units of PPM).
    uint32 private constant MULTIPLIER_INCREMENT = PPM_RESOLUTION / 4;

    // the maximum weekly 200% rewards multiplier (in units of PPM).
    uint32 private constant MAX_MULTIPLIER = PPM_RESOLUTION + MULTIPLIER_INCREMENT * 4;

    // the rewards halving factor we need to take into account during the sanity verification process.
    uint8 private constant REWARDS_HALVING_FACTOR = 4;

    // since we will be dividing by the total amount of protected tokens in units of wei, we can encounter cases
    // where the total amount in the denominator is higher than the product of the rewards rate and staking duration. In
    // order to avoid this imprecision, we will amplify the reward rate by the units amount.
    uint256 private constant REWARD_RATE_FACTOR = 1e18;

    uint256 private constant MAX_UINT256 = uint256(-1);

    // the staking rewards settings.
    IStakingRewardsStore private immutable _store;

    // the permissioned wrapper around the network token which should allow this contract to mint staking rewards.
    ITokenGovernance private immutable _networkTokenGovernance;

    // the address of the network token.
    IERC20 private immutable _networkToken;

    // the checkpoint store recording last protected position removal times.
    ICheckpointStore private immutable _lastRemoveTimes;

    /**
     * @dev initializes a new StakingRewards contract
     */
    constructor(
        IStakingRewardsStore store,
        ITokenGovernance networkTokenGovernance,
        ICheckpointStore lastRemoveTimes,
        IContractRegistry registry
    )
        public
        validAddress(address(store))
        validAddress(address(networkTokenGovernance))
        validAddress(address(lastRemoveTimes))
        ContractRegistryClient(registry)
    {
        _store = store;
        _networkTokenGovernance = networkTokenGovernance;
        _networkToken = networkTokenGovernance.token();
        _lastRemoveTimes = lastRemoveTimes;

        // set up administrative roles.
        _setRoleAdmin(ROLE_SUPERVISOR, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_PUBLISHER, ROLE_SUPERVISOR);
        _setRoleAdmin(ROLE_UPDATER, ROLE_SUPERVISOR);

        // allow the deployer to initially govern the contract.
        _setupRole(ROLE_SUPERVISOR, _msgSender());
    }

    modifier onlyPublisher() {
        _onlyPublisher();
        _;
    }

    function _onlyPublisher() internal view {
        require(hasRole(ROLE_PUBLISHER, msg.sender), "ERR_ACCESS_DENIED");
    }

    modifier onlyUpdater() {
        _onlyUpdater();
        _;
    }

    function _onlyUpdater() internal view {
        require(hasRole(ROLE_UPDATER, msg.sender), "ERR_ACCESS_DENIED");
    }

    /**
     * @dev liquidity provision notification callback. The callback should be called *before* the liquidity is added in
     * the LP contract
     *
     * Requirements:
     *
     * - the caller must have the ROLE_PUBLISHER role
     */
    function onAddingLiquidity(
        address provider,
        IConverterAnchor poolAnchor,
        IReserveToken reserveToken,
        uint256, /* poolAmount */
        uint256 /* reserveAmount */
    ) external override onlyPublisher validExternalAddress(provider) {
        IDSToken poolToken = IDSToken(address(poolAnchor));
        PoolProgram memory program = _poolProgram(poolToken);
        if (program.startTime == 0) {
            return;
        }

        _updateRewards(provider, poolToken, reserveToken, program, _liquidityProtectionStats());
    }

    /**
     * @dev liquidity removal callback. The callback must be called *before* the liquidity is removed in the LP
     * contract
     *
     * Requirements:
     *
     * - the caller must have the ROLE_PUBLISHER role
     */
    function onRemovingLiquidity(
        uint256, /* id */
        address provider,
        IConverterAnchor, /* poolAnchor */
        IReserveToken, /* reserveToken */
        uint256, /* poolAmount */
        uint256 /* reserveAmount */
    ) external override onlyPublisher validExternalAddress(provider) {
        ILiquidityProtectionStats lpStats = _liquidityProtectionStats();

        // make sure that all pending rewards are properly stored for future claims, with retroactive rewards
        // multipliers.
        _storeRewards(provider, lpStats.providerPools(provider), lpStats);
    }

    /**
     * @dev returns the staking rewards store
     */
    function store() external view override returns (IStakingRewardsStore) {
        return _store;
    }

    /**
     * @dev returns specific provider's pending rewards for all participating pools
     */
    function pendingRewards(address provider) external view override returns (uint256) {
        return _pendingRewards(provider, _liquidityProtectionStats());
    }

    /**
     * @dev returns specific provider's pending rewards for a specific participating pool
     */
    function pendingPoolRewards(address provider, IDSToken poolToken) external view override returns (uint256) {
        return _pendingRewards(provider, poolToken, _liquidityProtectionStats());
    }

    /**
     * @dev returns specific provider's pending rewards for a specific participating pool/reserve
     */
    function pendingReserveRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken
    ) external view override returns (uint256) {
        PoolProgram memory program = _poolProgram(poolToken);

        return _pendingRewards(provider, poolToken, reserveToken, program, _liquidityProtectionStats());
    }

    /**
     * @dev returns the current rewards multiplier for a provider in a given pool
     */
    function rewardsMultiplier(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken
    ) external view override returns (uint32) {
        ProviderRewards memory providerRewards = _providerRewards(provider, poolToken, reserveToken);
        PoolProgram memory program = _poolProgram(poolToken);
        return _rewardsMultiplier(provider, providerRewards.effectiveStakingTime, program);
    }

    /**
     * @dev returns specific provider's total claimed rewards from all participating pools
     */
    function totalClaimedRewards(address provider) external view override returns (uint256) {
        uint256 totalRewards = 0;

        ILiquidityProtectionStats lpStats = _liquidityProtectionStats();
        IDSToken[] memory poolTokens = lpStats.providerPools(provider);

        for (uint256 i = 0; i < poolTokens.length; ++i) {
            IDSToken poolToken = poolTokens[i];
            PoolProgram memory program = _poolProgram(poolToken);

            for (uint256 j = 0; j < program.reserveTokens.length; ++j) {
                IReserveToken reserveToken = program.reserveTokens[j];

                ProviderRewards memory providerRewards = _providerRewards(provider, poolToken, reserveToken);

                totalRewards = totalRewards.add(providerRewards.totalClaimedRewards);
            }
        }

        return totalRewards;
    }

    /**
     * @dev claims pending rewards from all participating pools
     */
    function claimRewards() external override returns (uint256) {
        return _claimPendingRewards(msg.sender, _liquidityProtectionStats());
    }

    /**
     * @dev stakes all pending rewards into another participating pool
     */
    function stakeRewards(uint256 maxAmount, IDSToken newPoolToken) external override returns (uint256, uint256) {
        return _stakeRewards(msg.sender, maxAmount, newPoolToken, _liquidityProtectionStats());
    }

    /**
     * @dev stakes specific pending rewards into another participating pool
     */
    function stakeReserveRewards(
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 maxAmount,
        IDSToken newPoolToken
    ) external override returns (uint256, uint256) {
        return _stakeRewards(msg.sender, poolToken, reserveToken, maxAmount, newPoolToken, _liquidityProtectionStats());
    }

    /**
     * @dev store pending rewards for a list of providers in a specific pool for future claims
     *
     * Requirements:
     *
     * - the caller must have the ROLE_UPDATER role
     */
    function storePoolRewards(address[] calldata providers, IDSToken poolToken) external override onlyUpdater {
        ILiquidityProtectionStats lpStats = _liquidityProtectionStats();
        PoolProgram memory program = _poolProgram(poolToken);

        for (uint256 i = 0; i < providers.length; ++i) {
            for (uint256 j = 0; j < program.reserveTokens.length; ++j) {
                _storeRewards(providers[i], poolToken, program.reserveTokens[j], program, lpStats, false);
            }
        }
    }

    /**
     * @dev returns specific provider's pending rewards for all participating pools
     */
    function _pendingRewards(address provider, ILiquidityProtectionStats lpStats) private view returns (uint256) {
        return _pendingRewards(provider, lpStats.providerPools(provider), lpStats);
    }

    /**
     * @dev returns specific provider's pending rewards for a specific list of participating pools
     */
    function _pendingRewards(
        address provider,
        IDSToken[] memory poolTokens,
        ILiquidityProtectionStats lpStats
    ) private view returns (uint256) {
        uint256 reward = 0;

        uint256 length = poolTokens.length;
        for (uint256 i = 0; i < length; ++i) {
            uint256 poolReward = _pendingRewards(provider, poolTokens[i], lpStats);
            reward = reward.add(poolReward);
        }

        return reward;
    }

    /**
     * @dev returns specific provider's pending rewards for a specific pool
     */
    function _pendingRewards(
        address provider,
        IDSToken poolToken,
        ILiquidityProtectionStats lpStats
    ) private view returns (uint256) {
        uint256 reward = 0;
        PoolProgram memory program = _poolProgram(poolToken);

        for (uint256 i = 0; i < program.reserveTokens.length; ++i) {
            uint256 reserveReward = _pendingRewards(provider, poolToken, program.reserveTokens[i], program, lpStats);
            reward = reward.add(reserveReward);
        }

        return reward;
    }

    /**
     * @dev returns specific provider's pending rewards for a specific pool/reserve
     */

    function _pendingRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private view returns (uint256) {
        if (!_isProgramValid(reserveToken, program)) {
            return 0;
        }

        // calculate the new reward rate per-token
        PoolRewards memory poolRewardsData = _poolRewards(poolToken, reserveToken);

        // rewardPerToken must be calculated with the previous value of lastUpdateTime
        poolRewardsData.rewardPerToken = _rewardPerToken(poolToken, reserveToken, poolRewardsData, program, lpStats);
        poolRewardsData.lastUpdateTime = Math.min(_time(), program.endTime);

        // update provider's rewards with the newly claimable base rewards and the new reward rate per-token
        ProviderRewards memory providerRewards = _providerRewards(provider, poolToken, reserveToken);

        // if this is the first liquidity provision - set the effective staking time to the current time
        if (
            providerRewards.effectiveStakingTime == 0 &&
            lpStats.totalProviderAmount(provider, poolToken, reserveToken) == 0
        ) {
            providerRewards.effectiveStakingTime = _time();
        }

        // pendingBaseRewards must be calculated with the previous value of providerRewards.rewardPerToken
        providerRewards.pendingBaseRewards = providerRewards.pendingBaseRewards.add(
            _baseRewards(provider, poolToken, reserveToken, poolRewardsData, providerRewards, program, lpStats)
        );
        providerRewards.rewardPerToken = poolRewardsData.rewardPerToken;

        // get full rewards and the respective rewards multiplier
        (uint256 fullReward, ) = _fullRewards(
            provider,
            poolToken,
            reserveToken,
            poolRewardsData,
            providerRewards,
            program,
            lpStats
        );

        return fullReward;
    }

    /**
     * @dev claims specific provider's pending rewards for a specific list of participating pools
     */
    function _claimPendingRewards(
        address provider,
        IDSToken[] memory poolTokens,
        uint256 maxAmount,
        ILiquidityProtectionStats lpStats,
        bool resetStakingTime
    ) private returns (uint256) {
        uint256 reward = 0;

        uint256 length = poolTokens.length;
        for (uint256 i = 0; i < length && maxAmount > 0; ++i) {
            uint256 poolReward = _claimPendingRewards(provider, poolTokens[i], maxAmount, lpStats, resetStakingTime);
            reward = reward.add(poolReward);

            if (maxAmount != MAX_UINT256) {
                maxAmount = maxAmount.sub(poolReward);
            }
        }

        return reward;
    }

    /**
     * @dev claims specific provider's pending rewards for a specific pool
     */
    function _claimPendingRewards(
        address provider,
        IDSToken poolToken,
        uint256 maxAmount,
        ILiquidityProtectionStats lpStats,
        bool resetStakingTime
    ) private returns (uint256) {
        uint256 reward = 0;
        PoolProgram memory program = _poolProgram(poolToken);

        for (uint256 i = 0; i < program.reserveTokens.length && maxAmount > 0; ++i) {
            uint256 reserveReward = _claimPendingRewards(
                provider,
                poolToken,
                program.reserveTokens[i],
                program,
                maxAmount,
                lpStats,
                resetStakingTime
            );
            reward = reward.add(reserveReward);

            if (maxAmount != MAX_UINT256) {
                maxAmount = maxAmount.sub(reserveReward);
            }
        }

        return reward;
    }

    /**
     * @dev claims specific provider's pending rewards for a specific pool/reserve
     */
    function _claimPendingRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolProgram memory program,
        uint256 maxAmount,
        ILiquidityProtectionStats lpStats,
        bool resetStakingTime
    ) private returns (uint256) {
        // update all provider's pending rewards, in order to apply retroactive reward multipliers
        (PoolRewards memory poolRewardsData, ProviderRewards memory providerRewards) = _updateRewards(
            provider,
            poolToken,
            reserveToken,
            program,
            lpStats
        );

        // get full rewards and the respective rewards multiplier
        (uint256 fullReward, uint32 multiplier) = _fullRewards(
            provider,
            poolToken,
            reserveToken,
            poolRewardsData,
            providerRewards,
            program,
            lpStats
        );

        // mark any debt as repaid.
        providerRewards.baseRewardsDebt = 0;
        providerRewards.baseRewardsDebtMultiplier = 0;

        if (maxAmount != MAX_UINT256 && fullReward > maxAmount) {
            // get the amount of the actual base rewards that were claimed
            providerRewards.baseRewardsDebt = _removeMultiplier(fullReward.sub(maxAmount), multiplier);

            // store the current multiplier for future retroactive rewards correction
            providerRewards.baseRewardsDebtMultiplier = multiplier;

            // grant only maxAmount rewards
            fullReward = maxAmount;
        }

        // update pool rewards data total claimed rewards
        _store.updatePoolRewardsData(
            poolToken,
            reserveToken,
            poolRewardsData.lastUpdateTime,
            poolRewardsData.rewardPerToken,
            poolRewardsData.totalClaimedRewards.add(fullReward)
        );

        // update provider rewards data with the remaining pending rewards and if needed, set the effective
        // staking time to the timestamp of the current block
        _store.updateProviderRewardsData(
            provider,
            poolToken,
            reserveToken,
            providerRewards.rewardPerToken,
            0,
            providerRewards.totalClaimedRewards.add(fullReward),
            resetStakingTime ? _time() : providerRewards.effectiveStakingTime,
            providerRewards.baseRewardsDebt,
            providerRewards.baseRewardsDebtMultiplier
        );

        return fullReward;
    }

    /**
     * @dev claims specific provider's pending rewards from all participating pools
     */
    function _claimPendingRewards(address provider, ILiquidityProtectionStats lpStats) private returns (uint256) {
        return _claimPendingRewards(provider, lpStats.providerPools(provider), MAX_UINT256, lpStats);
    }

    /**
     * @dev claims specific provider's pending rewards for a specific list of participating pools
     */
    function _claimPendingRewards(
        address provider,
        IDSToken[] memory poolTokens,
        uint256 maxAmount,
        ILiquidityProtectionStats lpStats
    ) private returns (uint256) {
        uint256 amount = _claimPendingRewards(provider, poolTokens, maxAmount, lpStats, true);
        if (amount == 0) {
            return amount;
        }

        // make sure to update the last claim time so that it'll be taken into effect when calculating the next rewards
        // multiplier
        _store.updateProviderLastClaimTime(provider);

        // mint the reward tokens directly to the provider
        _networkTokenGovernance.mint(provider, amount);

        emit RewardsClaimed(provider, amount);

        return amount;
    }

    /**
     * @dev stakes specific provider's pending rewards from all participating pools
     */
    function _stakeRewards(
        address provider,
        uint256 maxAmount,
        IDSToken poolToken,
        ILiquidityProtectionStats lpStats
    ) private returns (uint256, uint256) {
        return _stakeRewards(provider, lpStats.providerPools(provider), maxAmount, poolToken, lpStats);
    }

    /**
     * @dev claims and stakes specific provider's pending rewards from a specific list of participating pools
     */
    function _stakeRewards(
        address provider,
        IDSToken[] memory poolTokens,
        uint256 maxAmount,
        IDSToken newPoolToken,
        ILiquidityProtectionStats lpStats
    ) private returns (uint256, uint256) {
        uint256 amount = _claimPendingRewards(provider, poolTokens, maxAmount, lpStats, false);
        if (amount == 0) {
            return (amount, 0);
        }

        return (amount, _stakeClaimedRewards(amount, provider, newPoolToken));
    }

    /**
     * @dev claims and stakes specific provider's pending rewards from a specific list of participating pools
     */
    function _stakeRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        uint256 maxAmount,
        IDSToken newPoolToken,
        ILiquidityProtectionStats lpStats
    ) private returns (uint256, uint256) {
        uint256 amount = _claimPendingRewards(
            provider,
            poolToken,
            reserveToken,
            _poolProgram(poolToken),
            maxAmount,
            lpStats,
            false
        );
        if (amount == 0) {
            return (amount, 0);
        }

        return (amount, _stakeClaimedRewards(amount, provider, newPoolToken));
    }

    /**
     * @dev stakes claimed rewards into another participating pool
     */
    function _stakeClaimedRewards(
        uint256 amount,
        address provider,
        IDSToken newPoolToken
    ) private returns (uint256) {
        // approve the LiquidityProtection contract to pull the rewards
        ILiquidityProtection liquidityProtection = _liquidityProtection();
        address liquidityProtectionAddress = address(liquidityProtection);
        _networkToken.ensureApprove(liquidityProtectionAddress, amount);

        // mint the reward tokens directly to the staking contract, so that the LiquidityProtection could pull the
        // rewards and attribute them to the provider
        _networkTokenGovernance.mint(address(this), amount);

        uint256 newId = liquidityProtection.addLiquidityFor(
            provider,
            newPoolToken,
            IReserveToken(address(_networkToken)),
            amount
        );

        // please note, that in order to incentivize staking, we won't be updating the time of the last claim, thus
        // preserving the rewards bonus multiplier

        emit RewardsStaked(provider, newPoolToken, amount, newId);

        return newId;
    }

    /**
     * @dev store specific provider's pending rewards for future claims
     */
    function _storeRewards(
        address provider,
        IDSToken[] memory poolTokens,
        ILiquidityProtectionStats lpStats
    ) private {
        for (uint256 i = 0; i < poolTokens.length; ++i) {
            IDSToken poolToken = poolTokens[i];
            PoolProgram memory program = _poolProgram(poolToken);

            for (uint256 j = 0; j < program.reserveTokens.length; ++j) {
                _storeRewards(provider, poolToken, program.reserveTokens[j], program, lpStats, true);
            }
        }
    }

    /**
     * @dev store specific provider's pending rewards for future claims
     */
    function _storeRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats,
        bool resetStakingTime
    ) private {
        if (!_isProgramValid(reserveToken, program)) {
            return;
        }

        // update all provider's pending rewards, in order to apply retroactive reward multipliers
        (PoolRewards memory poolRewardsData, ProviderRewards memory providerRewards) = _updateRewards(
            provider,
            poolToken,
            reserveToken,
            program,
            lpStats
        );

        // get full rewards and the respective rewards multiplier
        (uint256 fullReward, uint32 multiplier) = _fullRewards(
            provider,
            poolToken,
            reserveToken,
            poolRewardsData,
            providerRewards,
            program,
            lpStats
        );

        // get the amount of the actual base rewards that were claimed
        providerRewards.baseRewardsDebt = _removeMultiplier(fullReward, multiplier);

        // update store data with the store pending rewards and set the last update time to the timestamp of the
        // current block. if we're resetting the effective staking time, then we'd have to store the rewards multiplier in order to
        // account for it in the future. Otherwise, we must store base rewards without any rewards multiplier
        _store.updateProviderRewardsData(
            provider,
            poolToken,
            reserveToken,
            providerRewards.rewardPerToken,
            0,
            providerRewards.totalClaimedRewards,
            resetStakingTime ? _time() : providerRewards.effectiveStakingTime,
            providerRewards.baseRewardsDebt,
            resetStakingTime ? multiplier : PPM_RESOLUTION
        );
    }

    /**
     * @dev updates pool rewards
     */
    function _updateReserveRewards(
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private returns (PoolRewards memory) {
        // calculate the new reward rate per-token and update it in the store
        PoolRewards memory poolRewardsData = _poolRewards(poolToken, reserveToken);

        bool update = false;

        // rewardPerToken must be calculated with the previous value of lastUpdateTime
        uint256 newRewardPerToken = _rewardPerToken(poolToken, reserveToken, poolRewardsData, program, lpStats);
        if (poolRewardsData.rewardPerToken != newRewardPerToken) {
            poolRewardsData.rewardPerToken = newRewardPerToken;

            update = true;
        }

        uint256 newLastUpdateTime = Math.min(_time(), program.endTime);
        if (poolRewardsData.lastUpdateTime != newLastUpdateTime) {
            poolRewardsData.lastUpdateTime = newLastUpdateTime;

            update = true;
        }

        if (update) {
            _store.updatePoolRewardsData(
                poolToken,
                reserveToken,
                poolRewardsData.lastUpdateTime,
                poolRewardsData.rewardPerToken,
                poolRewardsData.totalClaimedRewards
            );
        }

        return poolRewardsData;
    }

    /**
     * @dev updates provider rewards. this function is called during every liquidity changes
     */
    function _updateProviderRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolRewards memory poolRewardsData,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private returns (ProviderRewards memory) {
        // update provider's rewards with the newly claimable base rewards and the new reward rate per-token
        ProviderRewards memory providerRewards = _providerRewards(provider, poolToken, reserveToken);

        bool update = false;

        // if this is the first liquidity provision - set the effective staking time to the current time
        if (
            providerRewards.effectiveStakingTime == 0 &&
            lpStats.totalProviderAmount(provider, poolToken, reserveToken) == 0
        ) {
            providerRewards.effectiveStakingTime = _time();

            update = true;
        }

        // pendingBaseRewards must be calculated with the previous value of providerRewards.rewardPerToken
        uint256 rewards = _baseRewards(
            provider,
            poolToken,
            reserveToken,
            poolRewardsData,
            providerRewards,
            program,
            lpStats
        );
        if (rewards != 0) {
            providerRewards.pendingBaseRewards = providerRewards.pendingBaseRewards.add(rewards);

            update = true;
        }

        if (providerRewards.rewardPerToken != poolRewardsData.rewardPerToken) {
            providerRewards.rewardPerToken = poolRewardsData.rewardPerToken;

            update = true;
        }

        if (update) {
            _store.updateProviderRewardsData(
                provider,
                poolToken,
                reserveToken,
                providerRewards.rewardPerToken,
                providerRewards.pendingBaseRewards,
                providerRewards.totalClaimedRewards,
                providerRewards.effectiveStakingTime,
                providerRewards.baseRewardsDebt,
                providerRewards.baseRewardsDebtMultiplier
            );
        }

        return providerRewards;
    }

    /**
     * @dev updates pool and provider rewards. this function is called during every liquidity changes
     */
    function _updateRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private returns (PoolRewards memory, ProviderRewards memory) {
        PoolRewards memory poolRewardsData = _updateReserveRewards(poolToken, reserveToken, program, lpStats);
        ProviderRewards memory providerRewards = _updateProviderRewards(
            provider,
            poolToken,
            reserveToken,
            poolRewardsData,
            program,
            lpStats
        );

        return (poolRewardsData, providerRewards);
    }

    /**
     * @dev returns the aggregated reward rate per-token
     */
    function _rewardPerToken(
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolRewards memory poolRewardsData,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private view returns (uint256) {
        // if there is no longer any liquidity in this reserve, return the historic rate (i.e., rewards won't accrue)
        uint256 totalReserveAmount = lpStats.totalReserveAmount(poolToken, reserveToken);
        if (totalReserveAmount == 0) {
            return poolRewardsData.rewardPerToken;
        }

        // don't grant any rewards before the starting time of the program
        uint256 currentTime = _time();
        if (currentTime < program.startTime) {
            return 0;
        }

        uint256 stakingEndTime = Math.min(currentTime, program.endTime);
        uint256 stakingStartTime = Math.max(program.startTime, poolRewardsData.lastUpdateTime);
        if (stakingStartTime == stakingEndTime) {
            return poolRewardsData.rewardPerToken;
        }

        // since we will be dividing by the total amount of protected tokens in units of wei, we can encounter cases
        // where the total amount in the denominator is higher than the product of the rewards rate and staking duration.
        // in order to avoid this imprecision, we will amplify the reward rate by the units amount
        return
            poolRewardsData.rewardPerToken.add( // the aggregated reward rate
                stakingEndTime
                .sub(stakingStartTime) // the duration of the staking
                .mul(program.rewardRate) // multiplied by the rate
                .mul(REWARD_RATE_FACTOR) // and factored to increase precision
                .mul(_rewardShare(reserveToken, program)).div(totalReserveAmount.mul(PPM_RESOLUTION)) // and applied the specific token share of the whole reward // and divided by the total protected tokens amount in the pool
            );
    }

    /**
     * @dev returns the base rewards since the last claim
     */
    function _baseRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolRewards memory poolRewardsData,
        ProviderRewards memory providerRewards,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private view returns (uint256) {
        uint256 totalProviderAmount = lpStats.totalProviderAmount(provider, poolToken, reserveToken);
        uint256 newRewardPerToken = _rewardPerToken(poolToken, reserveToken, poolRewardsData, program, lpStats);

        return totalProviderAmount.mul(newRewardPerToken.sub(providerRewards.rewardPerToken)).div(REWARD_RATE_FACTOR); // the protected tokens amount held by the provider // multiplied by the difference between the previous and the current rate // and factored back
    }

    /**
     * @dev returns the full rewards since the last claim
     */
    function _fullRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken,
        PoolRewards memory poolRewardsData,
        ProviderRewards memory providerRewards,
        PoolProgram memory program,
        ILiquidityProtectionStats lpStats
    ) private view returns (uint256, uint32) {
        // calculate the claimable base rewards (since the last claim)
        uint256 newBaseRewards = _baseRewards(
            provider,
            poolToken,
            reserveToken,
            poolRewardsData,
            providerRewards,
            program,
            lpStats
        );

        // make sure that we aren't exceeding the reward rate for any reason
        _verifyBaseReward(newBaseRewards, providerRewards.effectiveStakingTime, reserveToken, program);

        // calculate pending rewards and apply the rewards multiplier
        uint32 multiplier = _rewardsMultiplier(provider, providerRewards.effectiveStakingTime, program);
        uint256 fullReward = _applyMultiplier(providerRewards.pendingBaseRewards.add(newBaseRewards), multiplier);

        // add any debt, while applying the best retroactive multiplier
        fullReward = fullReward.add(
            _applyHigherMultiplier(
                providerRewards.baseRewardsDebt,
                multiplier,
                providerRewards.baseRewardsDebtMultiplier
            )
        );

        // make sure that we aren't exceeding the full reward rate for any reason
        _verifyFullReward(fullReward, reserveToken, poolRewardsData, program);

        return (fullReward, multiplier);
    }

    /**
     * @dev returns the specific reserve token's share of all rewards
     */
    function _rewardShare(IReserveToken reserveToken, PoolProgram memory program) private pure returns (uint32) {
        if (reserveToken == program.reserveTokens[0]) {
            return program.rewardShares[0];
        }

        return program.rewardShares[1];
    }

    /**
     * @dev returns the rewards multiplier for the specific provider
     */
    function _rewardsMultiplier(
        address provider,
        uint256 stakingStartTime,
        PoolProgram memory program
    ) private view returns (uint32) {
        uint256 effectiveStakingEndTime = Math.min(_time(), program.endTime);
        uint256 effectiveStakingStartTime = Math.max( // take the latest of actual staking start time and the latest multiplier reset
            Math.max(stakingStartTime, program.startTime), // don't count staking before the start of the program
            Math.max(_lastRemoveTimes.checkpoint(provider), _store.providerLastClaimTime(provider)) // get the latest multiplier reset timestamp
        );

        // check that the staking range is valid. for example, it can be invalid when calculating the multiplier when
        // the staking has started before the start of the program, in which case the effective staking start time will
        // be in the future, compared to the effective staking end time (which will be the time of the current block)
        if (effectiveStakingStartTime >= effectiveStakingEndTime) {
            return PPM_RESOLUTION;
        }

        uint256 effectiveStakingDuration = effectiveStakingEndTime.sub(effectiveStakingStartTime);

        // given x representing the staking duration (in seconds), the resulting multiplier (in PPM) is:
        // * for 0 <= x <= 1 weeks: 100% PPM
        // * for 1 <= x <= 2 weeks: 125% PPM
        // * for 2 <= x <= 3 weeks: 150% PPM
        // * for 3 <= x <= 4 weeks: 175% PPM
        // * for x > 4 weeks: 200% PPM
        return PPM_RESOLUTION + MULTIPLIER_INCREMENT * uint32(Math.min(effectiveStakingDuration.div(1 weeks), 4));
    }

    /**
     * @dev returns the pool program for a specific pool
     */
    function _poolProgram(IDSToken poolToken) private view returns (PoolProgram memory) {
        PoolProgram memory program;
        (program.startTime, program.endTime, program.rewardRate, program.reserveTokens, program.rewardShares) = _store
            .poolProgram(poolToken);

        return program;
    }

    /**
     * @dev returns pool rewards for a specific pool and reserve
     */
    function _poolRewards(IDSToken poolToken, IReserveToken reserveToken) private view returns (PoolRewards memory) {
        PoolRewards memory data;
        (data.lastUpdateTime, data.rewardPerToken, data.totalClaimedRewards) = _store.poolRewards(
            poolToken,
            reserveToken
        );

        return data;
    }

    /**
     * @dev returns provider rewards for a specific pool and reserve
     */
    function _providerRewards(
        address provider,
        IDSToken poolToken,
        IReserveToken reserveToken
    ) private view returns (ProviderRewards memory) {
        ProviderRewards memory data;
        (
            data.rewardPerToken,
            data.pendingBaseRewards,
            data.totalClaimedRewards,
            data.effectiveStakingTime,
            data.baseRewardsDebt,
            data.baseRewardsDebtMultiplier
        ) = _store.providerRewards(provider, poolToken, reserveToken);

        return data;
    }

    /**
     * @dev applies the multiplier on the provided amount
     */
    function _applyMultiplier(uint256 amount, uint32 multiplier) private pure returns (uint256) {
        if (multiplier == PPM_RESOLUTION) {
            return amount;
        }

        return amount.mul(multiplier).div(PPM_RESOLUTION);
    }

    /**
     * @dev removes the multiplier on the provided amount
     */
    function _removeMultiplier(uint256 amount, uint32 multiplier) private pure returns (uint256) {
        if (multiplier == PPM_RESOLUTION) {
            return amount;
        }

        return amount.mul(PPM_RESOLUTION).div(multiplier);
    }

    /**
     * @dev applies the best of two rewards multipliers on the provided amount
     */
    function _applyHigherMultiplier(
        uint256 amount,
        uint32 multiplier1,
        uint32 multiplier2
    ) private pure returns (uint256) {
        return _applyMultiplier(amount, multiplier1 > multiplier2 ? multiplier1 : multiplier2);
    }

    /**
     * @dev performs a sanity check on the newly claimable base rewards
     */
    function _verifyBaseReward(
        uint256 baseReward,
        uint256 stakingStartTime,
        IReserveToken reserveToken,
        PoolProgram memory program
    ) private view {
        // don't grant any rewards before the starting time of the program or for stakes after the end of the program
        uint256 currentTime = _time();
        if (currentTime < program.startTime || stakingStartTime >= program.endTime) {
            require(baseReward == 0, "ERR_BASE_REWARD_TOO_HIGH");

            return;
        }

        uint256 effectiveStakingStartTime = Math.max(stakingStartTime, program.startTime);
        uint256 effectiveStakingEndTime = Math.min(currentTime, program.endTime);

        // make sure that we aren't exceeding the base reward rate for any reason
        require(
            baseReward <=
                (program.rewardRate * REWARDS_HALVING_FACTOR)
                    .mul(effectiveStakingEndTime.sub(effectiveStakingStartTime))
                    .mul(_rewardShare(reserveToken, program))
                    .div(PPM_RESOLUTION),
            "ERR_BASE_REWARD_RATE_TOO_HIGH"
        );
    }

    /**
     * @dev performs a sanity check on the newly claimable full rewards
     */
    function _verifyFullReward(
        uint256 fullReward,
        IReserveToken reserveToken,
        PoolRewards memory poolRewardsData,
        PoolProgram memory program
    ) private pure {
        uint256 maxClaimableReward = (
            (program.rewardRate * REWARDS_HALVING_FACTOR)
                .mul(program.endTime.sub(program.startTime))
                .mul(_rewardShare(reserveToken, program))
                .mul(MAX_MULTIPLIER)
                .div(PPM_RESOLUTION)
                .div(PPM_RESOLUTION)
        ).sub(poolRewardsData.totalClaimedRewards);

        // make sure that we aren't exceeding the full reward rate for any reason
        require(fullReward <= maxClaimableReward, "ERR_REWARD_RATE_TOO_HIGH");
    }

    /**
     * @dev returns the liquidity protection stats data contract
     */
    function _liquidityProtectionStats() private view returns (ILiquidityProtectionStats) {
        return _liquidityProtection().stats();
    }

    /**
     * @dev returns the liquidity protection contract
     */
    function _liquidityProtection() private view returns (ILiquidityProtection) {
        return ILiquidityProtection(_addressOf(LIQUIDITY_PROTECTION));
    }

    /**
     * @dev returns if the program is valid
     */
    function _isProgramValid(IReserveToken reserveToken, PoolProgram memory program) private pure returns (bool) {
        return
            address(reserveToken) != address(0) &&
            (program.reserveTokens[0] == reserveToken || program.reserveTokens[1] == reserveToken);
    }
}
