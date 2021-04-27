const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const MathUtils = require('./helpers/MathUtils');
const humanizeDuration = require('humanize-duration');
const { set } = require('lodash');

const Constants = require('./helpers/Constants');
const Contracts = require('./helpers/Contracts');

const { duration, latest } = require('./helpers/Time');

const { ZERO_ADDRESS } = require('./helpers/Constants');
const { CONVERTER_FACTORY, CONVERTER_REGISTRY, CONVERTER_REGISTRY_DATA, LIQUIDITY_PROTECTION } = Constants.registry;
const {
    ROLE_SUPERVISOR,
    ROLE_OWNER,
    ROLE_MANAGER,
    ROLE_GOVERNOR,
    ROLE_MINTER,
    ROLE_PUBLISHER,
    ROLE_UPDATER
} = Constants.roles;

const PPM_RESOLUTION = BigNumber.from(1000000);
const MULTIPLIER_INCREMENT = PPM_RESOLUTION.div(BigNumber.from(4)); // 25%
const NETWORK_TOKEN_REWARDS_SHARE = BigNumber.from(700000); // 70%
const BASE_TOKEN_REWARDS_SHARE = BigNumber.from(300000); // 30%

const REWARD_RATE_FACTOR = BigNumber.from(10).pow(BigNumber.from(18));
const REWARDS_DURATION = duration.weeks(12);
const BIG_POOL_BASE_REWARD_RATE = BigNumber.from(100000)
    .mul(BigNumber.from(10).pow(BigNumber.from(18)))
    .div(duration.weeks(1));
const SMALL_POOL_BASE_REWARD_RATE = BigNumber.from(10000)
    .mul(BigNumber.from(10).pow(BigNumber.from(18)))
    .div(duration.weeks(1));

const RESERVE1_AMOUNT = BigNumber.from(10000000).mul(BigNumber.from(10).pow(BigNumber.from(18)));
const RESERVE2_AMOUNT = BigNumber.from(25000000).mul(BigNumber.from(10).pow(BigNumber.from(18)));
const TOTAL_SUPPLY = BigNumber.from(10).pow(BigNumber.from(36));

const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_POOL_CONVERTER_WEIGHTS = [500_000, 500_000];

let now;
let prevNow;
let contractRegistry;
let converterRegistry;
let reserveToken;
let reserveToken2;
let reserveToken3;
let networkToken;
let poolToken;
let poolToken2;
let poolToken3;
let networkTokenGovernance;
let checkpointStore;
let liquidityProtectionSettings;
let liquidityProtectionStats;
let liquidityProtectionStore;
let liquidityProtectionSystemStore;
let liquidityProtectionWallet;
let liquidityProtection;
let store;
let staking;

let supervisor;
let updater;
let accounts;

describe('StakingRewards', () => {
    const setTime = async (time) => {
        prevNow = now;
        now = time;

        for (const t of [liquidityProtection, store, staking, checkpointStore]) {
            if (t) {
                await t.setTime(now);
            }
        }
    };

    const toPPM = (percent) => BigNumber.from(percent).mul(PPM_RESOLUTION).div(BigNumber.from(100));

    const getRewardsMultiplier = (stakingDuration) => {
        // For 0 <= x <= 1 weeks: 100% PPM
        if (stakingDuration.gte(duration.weeks(0)) && stakingDuration.lt(duration.weeks(1))) {
            return PPM_RESOLUTION;
        }

        // For 1 <= x <= 2 weeks: 125% PPM
        if (stakingDuration.gte(duration.weeks(1)) && stakingDuration.lt(duration.weeks(2))) {
            return PPM_RESOLUTION.add(MULTIPLIER_INCREMENT);
        }

        // For 2 <= x <= 3 weeks: 150% PPM
        if (stakingDuration.gte(duration.weeks(2)) && stakingDuration.lt(duration.weeks(3))) {
            return PPM_RESOLUTION.add(MULTIPLIER_INCREMENT.mul(BigNumber.from(2)));
        }

        // For 3 <= x < 4 weeks: 175% PPM
        if (stakingDuration.gte(duration.weeks(3)) && stakingDuration.lt(duration.weeks(4))) {
            return PPM_RESOLUTION.add(MULTIPLIER_INCREMENT.mul(BigNumber.from(3)));
        }

        // For x >= 4 weeks: 200% PPM
        return PPM_RESOLUTION.mul(BigNumber.from(2));
    };

    const getProviderRewards = async (provider, poolToken, reserveToken) => {
        const data = await store.providerRewards(
            provider,
            poolToken.address || poolToken,
            reserveToken.address || reserveToken
        );

        return {
            rewardPerToken: data[0],
            pendingBaseRewards: data[1],
            totalClaimedRewards: data[2],
            effectiveStakingTime: data[3],
            baseRewardsDebt: data[4],
            baseRewardsDebtMultiplier: data[5]
        };
    };

    const expectAlmostEqual = (amount1, amount2, maxError = 0.0000000001) => {
        if (!amount1.eq(amount2)) {
            const error = new MathUtils.Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
            expect(error.lte(maxError)).to.be.equal(true, `error = ${error.toFixed(maxError.length)}`);
        }
    };

    const createPoolToken = async (reserveToken) => {
        await converterRegistry.newConverter(
            STANDARD_CONVERTER_TYPE,
            'PT',
            'PT',
            18,
            PPM_RESOLUTION,
            [reserveToken.address, networkToken.address],
            STANDARD_POOL_CONVERTER_WEIGHTS
        );

        const anchorCount = await converterRegistry.getAnchorCount();
        const poolTokenAddress = await converterRegistry.getAnchor(anchorCount - 1);
        const poolToken = await Contracts.DSToken.attach(poolTokenAddress);
        const converterAddress = await poolToken.owner();
        const converter = await Contracts.StandardPoolConverter.attach(converterAddress);
        await converter.acceptOwnership();

        await reserveToken.approve(converter.address, RESERVE1_AMOUNT);
        await networkToken.approve(converter.address, RESERVE2_AMOUNT);

        await converter.addLiquidity(
            [reserveToken.address, networkToken.address],
            [RESERVE1_AMOUNT, RESERVE2_AMOUNT],
            1
        );

        await liquidityProtectionSettings.addPoolToWhitelist(poolToken.address);
        await liquidityProtectionSettings.setNetworkTokenMintingLimit(poolToken.address, TOTAL_SUPPLY);

        return poolToken;
    };

    before(async () => {
        accounts = await ethers.getSigners();

        supervisor = accounts[0];
        updater = accounts[1];

        contractRegistry = await Contracts.ContractRegistry.deploy();
        converterRegistry = await Contracts.TestConverterRegistry.deploy(contractRegistry.address);
        const converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);

        const standardPoolConverterFactory = await Contracts.StandardPoolConverterFactory.deploy();
        const converterFactory = await Contracts.ConverterFactory.deploy();
        await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

        await contractRegistry.registerAddress(CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY_DATA, converterRegistryData.address);
    });

    beforeEach(async () => {
        networkToken = await Contracts.DSToken.deploy('BNT', 'BNT', 18);
        await networkToken.issue(supervisor.address, TOTAL_SUPPLY);

        reserveToken = await Contracts.TestStandardToken.deploy('RSV1', 'RSV1', 18, TOTAL_SUPPLY);
        reserveToken2 = await Contracts.TestStandardToken.deploy('RSV2', 'RSV2', 18, TOTAL_SUPPLY);
        reserveToken3 = await Contracts.TestStandardToken.deploy('RSV3', 'RSV3', 18, TOTAL_SUPPLY);

        networkTokenGovernance = await Contracts.TestTokenGovernance.deploy(networkToken.address);
        await networkTokenGovernance.grantRole(ROLE_GOVERNOR, supervisor.address);
        await networkTokenGovernance.grantRole(ROLE_MINTER, supervisor.address);
        await networkToken.transferOwnership(networkTokenGovernance.address);
        await networkTokenGovernance.acceptTokenOwnership();

        const govToken = await Contracts.DSToken.deploy('vBNT', 'vBNT', 18);
        const govTokenGovernance = await Contracts.TestTokenGovernance.deploy(govToken.address);
        await govTokenGovernance.grantRole(ROLE_GOVERNOR, supervisor.address);
        await govToken.transferOwnership(govTokenGovernance.address);
        await govTokenGovernance.acceptTokenOwnership();

        checkpointStore = await Contracts.TestCheckpointStore.deploy();

        store = await Contracts.TestStakingRewardsStore.deploy();
        staking = await Contracts.TestStakingRewards.deploy(
            store.address,
            networkTokenGovernance.address,
            checkpointStore.address,
            contractRegistry.address
        );

        await staking.grantRole(ROLE_UPDATER, updater.address);
        await store.grantRole(ROLE_OWNER, staking.address);
        await store.grantRole(ROLE_MANAGER, supervisor.address);
        await networkTokenGovernance.grantRole(ROLE_MINTER, staking.address);

        liquidityProtectionSettings = await Contracts.LiquidityProtectionSettings.deploy(
            networkToken.address,
            contractRegistry.address
        );

        await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(BigNumber.from(0));

        liquidityProtectionStore = await Contracts.LiquidityProtectionStore.deploy();
        liquidityProtectionStats = await Contracts.LiquidityProtectionStats.deploy();
        liquidityProtectionSystemStore = await Contracts.LiquidityProtectionSystemStore.deploy();
        liquidityProtectionWallet = await Contracts.TokenHolder.deploy();
        liquidityProtection = await Contracts.TestLiquidityProtection.deploy(
            liquidityProtectionSettings.address,
            liquidityProtectionStore.address,
            liquidityProtectionStats.address,
            liquidityProtectionSystemStore.address,
            liquidityProtectionWallet.address,
            networkTokenGovernance.address,
            govTokenGovernance.address,
            checkpointStore.address
        );

        await contractRegistry.registerAddress(LIQUIDITY_PROTECTION, liquidityProtection.address);

        await liquidityProtectionSettings.addSubscriber(staking.address);

        await liquidityProtectionSettings.grantRole(ROLE_OWNER, liquidityProtection.address);
        await liquidityProtectionStats.grantRole(ROLE_OWNER, liquidityProtection.address);
        await liquidityProtectionSystemStore.grantRole(ROLE_OWNER, liquidityProtection.address);
        await checkpointStore.grantRole(ROLE_OWNER, liquidityProtection.address);
        await liquidityProtectionStore.transferOwnership(liquidityProtection.address);
        await liquidityProtection.acceptStoreOwnership();
        await liquidityProtectionWallet.transferOwnership(liquidityProtection.address);
        await liquidityProtection.acceptWalletOwnership();
        await networkTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address);
        await govTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address);

        await staking.grantRole(ROLE_PUBLISHER, liquidityProtection.address);

        await setTime(await latest());
    });

    describe('construction', async () => {
        it('should properly initialize roles', async () => {
            const newStaking = await Contracts.TestStakingRewards.deploy(
                store.address,
                networkTokenGovernance.address,
                checkpointStore.address,
                contractRegistry.address
            );

            expect(await newStaking.getRoleMemberCount(ROLE_SUPERVISOR)).to.be.equal(BigNumber.from(1));
            expect(await newStaking.getRoleMemberCount(ROLE_PUBLISHER)).to.be.equal(BigNumber.from(0));
            expect(await newStaking.getRoleMemberCount(ROLE_UPDATER)).to.be.equal(BigNumber.from(0));

            expect(await newStaking.getRoleAdmin(ROLE_SUPERVISOR)).to.eql(ROLE_SUPERVISOR);
            expect(await newStaking.getRoleAdmin(ROLE_PUBLISHER)).to.eql(ROLE_SUPERVISOR);
            expect(await newStaking.getRoleAdmin(ROLE_UPDATER)).to.eql(ROLE_SUPERVISOR);

            expect(await newStaking.hasRole(ROLE_SUPERVISOR, supervisor.address)).to.be.true;
            expect(await newStaking.hasRole(ROLE_PUBLISHER, supervisor.address)).to.be.false;
            expect(await newStaking.hasRole(ROLE_UPDATER, supervisor.address)).to.be.false;
        });

        it('should initialize the state', async () => {
            expect(await staking.store()).to.eql(store.address);
        });

        it('should revert if initialized with a zero address store', async () => {
            await expect(
                Contracts.TestStakingRewards.deploy(
                    ZERO_ADDRESS,
                    networkTokenGovernance.address,
                    checkpointStore.address,
                    contractRegistry.address
                )
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert if initialized with a zero address network governance', async () => {
            await expect(
                Contracts.TestStakingRewards.deploy(
                    store.address,
                    ZERO_ADDRESS,
                    checkpointStore.address,
                    contractRegistry.address
                )
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert if initialized with a zero address checkpoint store', async () => {
            await expect(
                Contracts.TestStakingRewards.deploy(
                    store.address,
                    networkTokenGovernance.address,
                    ZERO_ADDRESS,
                    contractRegistry.address
                )
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert if initialized with a zero address registry', async () => {
            await expect(
                Contracts.TestStakingRewards.deploy(
                    store.address,
                    networkTokenGovernance.address,
                    checkpointStore.address,
                    ZERO_ADDRESS
                )
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });
    });

    describe('notifications', async () => {
        const id = BigNumber.from(123);
        let provider;
        let liquidityProtectionProxy;
        let nonLiquidityProtection;

        before(async () => {
            provider = accounts[1];

            liquidityProtectionProxy = accounts[3];
            nonLiquidityProtection = accounts[9];
        });

        beforeEach(async () => {
            await setTime(now.add(duration.weeks(1)));

            poolToken = await createPoolToken(reserveToken);

            await staking.grantRole(ROLE_PUBLISHER, liquidityProtectionProxy.address);

            await store.addPoolProgram(
                poolToken.address,
                [networkToken.address, reserveToken.address],
                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                now.add(REWARDS_DURATION),
                BIG_POOL_BASE_REWARD_RATE
            );
        });

        it('should revert when a non-LP contract attempts to notify', async () => {
            await expect(
                staking
                    .connect(nonLiquidityProtection)
                    .onAddingLiquidity(provider.address, poolToken.address, reserveToken.address, 0, 0)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');

            await expect(
                staking
                    .connect(nonLiquidityProtection)
                    .onRemovingLiquidity(id, provider.address, poolToken.address, reserveToken.address, 0, 0)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when notifying for a zero provider ', async () => {
            await expect(
                staking
                    .connect(liquidityProtectionProxy)
                    .onAddingLiquidity(ZERO_ADDRESS, poolToken.address, reserveToken.address, 0, 0)
            ).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');

            await expect(
                staking
                    .connect(liquidityProtectionProxy)
                    .onRemovingLiquidity(id, ZERO_ADDRESS, poolToken.address, reserveToken.address, 0, 0)
            ).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');
        });
    });

    describe('rewards', async () => {
        let providers;

        let positions;
        let reserveAmounts;
        let totalReserveAmounts;
        let programs;
        let providerPools;

        before(async () => {
            providers = [accounts[1], accounts[2]];
        });

        beforeEach(async () => {
            poolToken = await createPoolToken(reserveToken);
            poolToken2 = await createPoolToken(reserveToken2);
            poolToken3 = await createPoolToken(reserveToken3);

            const poolTokens = [poolToken, poolToken2, poolToken3];
            const reserveTokens = {
                [poolToken.address]: reserveToken.address,
                [poolToken2.address]: reserveToken2.address,
                [poolToken3.address]: reserveToken3.address
            };

            positions = {};
            reserveAmounts = {};
            totalReserveAmounts = {};
            programs = {};
            providerPools = {};

            for (const { address: poolToken } of poolTokens) {
                const reserveToken = reserveTokens[poolToken];

                set(totalReserveAmounts, [poolToken, reserveToken], BigNumber.from(0));
                set(totalReserveAmounts, [poolToken, networkToken.address], BigNumber.from(0));

                set(programs, [poolToken, reserveToken], BigNumber.from(0));
                set(programs, [poolToken, networkToken.address], BigNumber.from(0));

                for (const provider of accounts) {
                    set(positions, [provider.address, poolToken, reserveToken], []);
                    set(positions, [provider.address, poolToken, networkToken.address], []);

                    providerPools[provider.address] = {};

                    set(reserveAmounts, [provider.address, poolToken, reserveToken], BigNumber.from(0));
                    set(reserveAmounts, [provider, poolToken.address, networkToken.address], BigNumber.from(0));
                }
            }
        });

        const addTestLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            if (!providerPools[provider][poolToken.address]) {
                providerPools[provider][poolToken.address] = [];
            }

            const reserveTokens = providerPools[provider][poolToken.address];
            if (!reserveTokens.includes(reserveToken.address)) {
                reserveTokens.push(reserveToken.address);
            }

            reserveAmounts[provider][poolToken.address][reserveToken.address] = reserveAmounts[provider][
                poolToken.address
            ][reserveToken.address].add(reserveAmount);

            totalReserveAmounts[poolToken.address][reserveToken.address] = totalReserveAmounts[poolToken.address][
                reserveToken.address
            ].add(reserveAmount);
        };

        const addLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            addTestLiquidity(provider.address, poolToken, reserveToken, reserveAmount);

            if (reserveToken.address !== networkToken.address) {
                await reserveToken.transfer(provider.address, reserveAmount);
            } else {
                await networkTokenGovernance.mint(provider.address, reserveAmount);
            }
            await reserveToken.connect(provider).approve(liquidityProtection.address, reserveAmount);

            await liquidityProtection
                .connect(provider)
                .addLiquidity(poolToken.address, reserveToken.address, reserveAmount);

            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(provider.address);
            const protectionId = protectionIds[0];
            positions[provider.address][poolToken.address][reserveToken.address].push(protectionId);
        };

        const removeTestLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            expect(reserveAmounts[provider][poolToken.address][reserveToken.address]).to.be.gte(reserveAmount);

            expect(totalReserveAmounts[poolToken.address][reserveToken.address]).to.be.gte(reserveAmount);

            reserveAmounts[provider][poolToken.address][reserveToken.address] = reserveAmounts[provider][
                poolToken.address
            ][reserveToken.address].sub(reserveAmount);

            totalReserveAmounts[poolToken.address][reserveToken.address] = totalReserveAmounts[poolToken.address][
                reserveToken.address
            ].sub(reserveAmount);

            if (reserveAmounts[provider][poolToken.address][reserveToken.address].eq(BigNumber.from(0))) {
                providerPools[provider][poolToken.address].splice(
                    providerPools[provider][poolToken.address].indexOf(reserveToken.address),
                    1
                );

                let reserveToken2;
                if (providerPools[provider][poolToken.address].length > 0) {
                    reserveToken2 = providerPools[provider][poolToken.address][0];
                }

                if (
                    !reserveToken2 ||
                    reserveAmounts[provider][poolToken.address][reserveToken2.address].eq(BigNumber.from(0))
                ) {
                    providerPools[provider].poolTokens = [];
                }
            }
        };

        const getPosition = async (provider, id) => {
            const position = await liquidityProtectionStore.protectedLiquidity(id);
            expect(provider).to.eql(position[0]);

            return {
                provider,
                poolToken: position[1],
                reserveToken: position[2],
                poolAmount: position[3],
                reserveAmount: position[4],
                reserveRateN: position[5],
                reserveRateD: position[6],
                timestamp: position[7]
            };
        };

        const removeLiquidity = async (provider, poolToken, reserveToken, portion) => {
            const id = positions[provider][poolToken.address][reserveToken.address][0];
            const position = await getPosition(provider, id);

            let reserveAmount;
            if (portion.eq(PPM_RESOLUTION)) {
                reserveAmount = position.reserveAmount;
            } else {
                reserveAmount = position.reserveAmount.mul(portion).div(PPM_RESOLUTION);
            }

            await liquidityProtection.removeLiquidity(id, portion, { from: provider });

            removeTestLiquidity(provider, poolToken, reserveToken, reserveAmount);
        };

        const addPoolProgram = async (poolToken, reserveToken, programEndTime, rewardRate) => {
            programs[poolToken.address] = {
                now,
                programEndTime,
                rewardRate
            };

            await store.addPoolProgram(
                poolToken.address,
                [networkToken.address, reserveToken.address],
                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                programEndTime,
                rewardRate
            );
        };

        const getExpectedRewards = (provider, duration, multiplierDuration = undefined) => {
            let reward = BigNumber.from(0);
            if (duration.lte(BigNumber.from(0))) {
                return reward;
            }

            for (const poolToken in providerPools[provider]) {
                reward = reward.add(getExpectedPoolRewards(provider, poolToken, duration, multiplierDuration));
            }

            return reward;
        };

        const getExpectedPoolRewards = (provider, poolToken, duration, multiplierDuration = undefined) => {
            let reward = BigNumber.from(0);
            if (duration.lte(BigNumber.from(0))) {
                return reward;
            }

            const reserveTokens = providerPools[provider][poolToken];

            for (const reserveToken of reserveTokens) {
                reward = reward.add(
                    getExpectedReserveRewards(provider, poolToken, reserveToken, duration, multiplierDuration)
                );
            }

            return reward;
        };

        const getExpectedReserveRewards = (
            provider,
            poolToken,
            reserveToken,
            duration,
            multiplierDuration = undefined
        ) => {
            const reward = BigNumber.from(0);
            if (duration.lte(BigNumber.from(0))) {
                return reward;
            }

            const rewardShare =
                reserveToken === networkToken.address ? NETWORK_TOKEN_REWARDS_SHARE : BASE_TOKEN_REWARDS_SHARE;

            if (totalReserveAmounts[poolToken][reserveToken].eq(BigNumber.from(0))) {
                return BigNumber.from(0);
            }

            return reserveAmounts[provider][poolToken][reserveToken]
                .mul(
                    duration
                        .mul(programs[poolToken].rewardRate)
                        .mul(REWARD_RATE_FACTOR)
                        .mul(rewardShare)
                        .div(PPM_RESOLUTION)
                        .div(totalReserveAmounts[poolToken][reserveToken])
                )
                .div(REWARD_RATE_FACTOR)
                .mul(getRewardsMultiplier(multiplierDuration || duration))
                .div(PPM_RESOLUTION);
        };

        let programStartTime;
        let programEndTime;

        const testRewards = async (provider, multiplierDuration = undefined) => {
            const reward = await staking.pendingRewards(provider);

            const effectiveTime = MathUtils.min(now, programEndTime);
            const expectedReward = getExpectedRewards(
                provider,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.be.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.equal(BigNumber.from(0));
        };

        const testPoolRewards = async (provider, poolToken, multiplierDuration = undefined) => {
            const reward = await staking.pendingPoolRewards(provider, poolToken.address);

            const effectiveTime = MathUtils.min(now, programEndTime);
            const expectedReward = getExpectedPoolRewards(
                provider,
                poolToken.address,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.be.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.equal(BigNumber.from(0));
        };

        const testReserveRewards = async (provider, poolToken, reserveToken, multiplierDuration = undefined) => {
            const reward = await staking.pendingReserveRewards(provider, poolToken.address, reserveToken.address);

            const effectiveTime = MathUtils.min(now, programEndTime);
            const expectedReward = getExpectedReserveRewards(
                provider,
                poolToken.address,
                reserveToken.address,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.be.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.equal(BigNumber.from(0));
        };

        const testPartialRewards = async (provider, prevReward, multiplierDuration = undefined) => {
            const reward = await staking.pendingRewards(provider);

            const effectiveTime = MathUtils.min(now, programEndTime);
            const extraReward = getExpectedRewards(provider, effectiveTime.sub(prevNow), multiplierDuration);
            const multiplier = getRewardsMultiplier(multiplierDuration || effectiveTime.sub(programStartTime));

            expectAlmostEqual(prevReward.mul(multiplier).div(PPM_RESOLUTION).add(extraReward), reward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.equal(BigNumber.from(0));
        };

        const testClaim = async (provider, multiplierDuration = undefined) => {
            const reward = await staking.pendingRewards(provider);

            const effectiveTime = MathUtils.min(now, programEndTime);
            const expectedReward = getExpectedRewards(provider, effectiveTime.sub(prevNow), multiplierDuration);

            expect(reward).to.be.equal(expectedReward);

            const claimed = await staking.claimRewards({ from: provider });
            expect(claimed).to.be.equal(reward);

            const prevBalance = await networkToken.balanceOf(provider);
            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

            const tx = await staking.claimRewards({ from: provider });
            if (claimed.gt(BigNumber.from(0))) {
                expect(tx).to.emit(staking, 'RewardsClaimed').withArgs(provider, claimed);
            }

            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance.add(reward));
            expect(await staking.totalClaimedRewards(provider)).to.be.equal(prevTotalProviderClaimed.add(reward));

            expect(await staking.pendingRewards(provider)).to.be.equal(BigNumber.from(0));
        };

        const testStorePoolRewards = async (providers, poolToken) => {
            const pendingRewards = {};
            const effectiveStakingTimes = {};

            for (const provider of providers) {
                for (const reserveToken of providerPools[provider][poolToken.address] || []) {
                    set(
                        pendingRewards,
                        [provider, poolToken.address, reserveToken],
                        await staking.pendingReserveRewards(provider, poolToken.address, reserveToken)
                    );

                    const providerRewards = await getProviderRewards(provider, poolToken.address, reserveToken);
                    set(
                        effectiveStakingTimes,
                        [provider, poolToken.address, reserveToken],
                        providerRewards.effectiveStakingTime
                    );
                }
            }

            await staking.storePoolRewards(providers, poolToken.address, { from: updater });

            for (const provider of providers) {
                for (const reserveToken of providerPools[provider][poolToken.address] || []) {
                    const providerRewards = await getProviderRewards(provider, poolToken.address, reserveToken);
                    const multiplier = await staking.rewardsMultiplier(provider, poolToken.address, reserveToken);

                    expectAlmostEqual(
                        providerRewards.baseRewardsDebt
                            .mul(providerRewards.baseRewardsDebtMultiplier)
                            .mul(multiplier)
                            .div(PPM_RESOLUTION)
                            .div(PPM_RESOLUTION),
                        pendingRewards[provider][poolToken.address][reserveToken]
                    );

                    expectAlmostEqual(
                        await staking.pendingReserveRewards(provider, poolToken.address, reserveToken),
                        pendingRewards[provider][poolToken.address][reserveToken]
                    );

                    expect(providerRewards.effectiveStakingTime).to.be.equal(
                        effectiveStakingTimes[provider][poolToken.address][reserveToken]
                    );
                }
            }
        };

        const testStaking = async (provider, amount, newPoolToken, participating = false) => {
            const reward = await staking.pendingRewards(provider);

            const data = await staking.stakeRewards(amount, newPoolToken.address, { from: provider });
            expect(data[0]).to.be.equal(amount);

            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

            const tx = await staking.stakeRewards(amount, newPoolToken.address, { from: provider });
            expect(tx).to.emit(staking, 'RewardsStaked').withArgs(provider, newPoolToken.address, amount, data[1]);

            // If we're staking to a participating pool, don't forget to update the local liquidity state for staking.
            if (participating) {
                addTestLiquidity(provider, newPoolToken, networkToken, amount);
            }

            expect(await staking.totalClaimedRewards(provider)).to.be.equal(prevTotalProviderClaimed.add(data[0]));

            const position = await getPosition(provider, data[1]);
            expect(position.poolToken).to.eql(newPoolToken.address);
            expect(position.reserveToken).to.eql(networkToken.address);
            expect(position.reserveAmount).to.be.equal(amount);

            const newReward = await staking.pendingRewards(provider);

            // take into account that there might be very small imprecisions when dealing with
            // multipliers
            if (newReward.eq(BigNumber.from(0))) {
                expect(newReward).to.be.closeTo(reward.sub(amount), BigNumber.from(1));
            } else {
                expectAlmostEqual(newReward, reward.sub(amount));
            }

            return newReward;
        };

        const tests = (providers) => {
            for (let i = 0; i < providers.length; ++i) {
                context(`provider #${i + 1}`, async () => {
                    const provider = providers[i];

                    describe('querying', async () => {
                        it('should properly calculate all rewards', async () => {
                            // Should return all rewards for the duration of one second.
                            await setTime(now.add(duration.seconds(1)));
                            await testRewards(provider);

                            // Should return all rewards for a single day.
                            await setTime(programStartTime.add(duration.days(1)));
                            await testRewards(provider);

                            // Should return all weekly rewards + second week's retroactive multiplier.
                            await setTime(programStartTime.add(duration.weeks(1)));
                            await testRewards(provider);

                            // Should return all program rewards + max retroactive multipliers.
                            await setTime(programEndTime);
                            await testRewards(provider, duration.weeks(4));

                            // Should not affect rewards after the ending time of the program.
                            await setTime(programEndTime.add(duration.days(1)));
                            await testRewards(provider, duration.weeks(4));
                        });

                        it('should properly calculate pool specific rewards', async () => {
                            // Should return all rewards for the duration of one second.
                            await setTime(now.add(duration.seconds(1)));
                            await testPoolRewards(provider, poolToken);

                            // Should return all rewards for a single day.
                            await setTime(programStartTime.add(duration.days(1)));
                            await testPoolRewards(provider, poolToken);

                            // Should return all weekly rewards + second week's retroactive multiplier.
                            await setTime(programStartTime.add(duration.weeks(1)));
                            await testPoolRewards(provider, poolToken);

                            // Should return all program rewards + max retroactive multipliers.
                            await setTime(programEndTime);
                            await testPoolRewards(provider, poolToken, duration.weeks(4));
                            await testPoolRewards(provider, poolToken, duration.weeks(4));

                            // Should not affect rewards after the ending time of the program.
                            await setTime(programEndTime.add(duration.days(1)));
                            await testPoolRewards(provider, poolToken, duration.weeks(4));
                            await testPoolRewards(provider, poolToken, duration.weeks(4));
                        });

                        it('should properly calculate reserve specific rewards', async () => {
                            // Should return all rewards for the duration of one second.
                            await setTime(now.add(duration.seconds(1)));
                            await testReserveRewards(provider, poolToken, networkToken);
                            await testReserveRewards(provider, poolToken, reserveToken);

                            // Should return all rewards for a single day.
                            await setTime(programStartTime.add(duration.days(1)));
                            await testReserveRewards(provider, poolToken, networkToken);

                            // Should return all weekly rewards + second week's retroactive multiplier.
                            await setTime(programStartTime.add(duration.weeks(1)));
                            await testReserveRewards(provider, poolToken, reserveToken);

                            // Should return all program rewards + max retroactive multipliers.
                            await setTime(programEndTime);
                            await testReserveRewards(provider, poolToken, networkToken, duration.weeks(4));
                            await testReserveRewards(provider, poolToken, reserveToken, duration.weeks(4));

                            // Should not affect rewards after the ending time of the program.
                            await setTime(programEndTime.add(duration.days(1)));
                            await testReserveRewards(provider, poolToken, networkToken, duration.weeks(4));
                            await testReserveRewards(provider, poolToken, reserveToken, duration.weeks(4));
                        });

                        it('should properly calculate pool specific multipliers', async () => {
                            await addLiquidity(
                                provider,
                                poolToken,
                                networkToken,
                                BigNumber.from(1).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            // Should return the correct multiplier for a duration of one second.
                            let actualMultiplier;
                            let expectedMultiplier;
                            let stakingDuration = duration.seconds(1);
                            await setTime(now.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolToken.address,
                                networkToken.address
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.equal(expectedMultiplier);

                            // Should return the correct multiplier for a duration of a single day after program start.
                            stakingDuration = duration.days(1);
                            await setTime(programStartTime.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolToken.address,
                                networkToken.address
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.equal(expectedMultiplier);

                            // Should return the correct multiplier for a duration of a single week after program start.
                            stakingDuration = duration.weeks(1);
                            await setTime(programStartTime.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolToken.address,
                                networkToken.address
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.equal(expectedMultiplier);

                            // Should return full multiplier for a duration of at least 4 weeks after program start.
                            stakingDuration = duration.weeks(4);
                            await setTime(programEndTime);
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolToken.address,
                                networkToken.address
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.equal(expectedMultiplier);

                            // Should keep the current multiplier after staking
                            const reward = await staking.pendingRewards(provider);
                            const amount = reward.div(BigNumber.from(10));
                            await testStaking(provider, amount, poolToken, true);
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolToken.address,
                                networkToken.address
                            );
                            expect(actualMultiplier).to.be.equal(expectedMultiplier);

                            // Should return full multiplier after the ending time of the program.
                            stakingDuration = duration.weeks(4);
                            await setTime(programEndTime.add(duration.days(1)));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolToken.address,
                                networkToken.address
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.equal(expectedMultiplier);
                        });

                        it('should not affect the rewards, when adding liquidity in the same block', async () => {
                            const provider3 = accounts[3];

                            await setTime(programStartTime.add(duration.weeks(5)));

                            const reward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(11111).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(11111).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(234324234234).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);
                        });

                        it('should not affect the rewards, when removing liquidity in the same block', async () => {
                            const provider3 = accounts[3];

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await setTime(programStartTime.add(duration.weeks(5)));

                            const reward = await staking.pendingRewards(provider);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(1));
                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(1));

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);

                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(30));

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);

                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(50));

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);
                        });

                        it('should properly calculate all rewards when adding liquidity', async () => {
                            const provider3 = accounts[3];

                            let prevReward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(28238238).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(50000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(990930923).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(2666678).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await setTime(now.add(duration.weeks(2)));
                            await testPartialRewards(provider, prevReward, duration.weeks(2));
                        });

                        it('should properly calculate all rewards when removing liquidity', async () => {
                            const provider3 = accounts[3];

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            let prevReward = await staking.pendingRewards(provider);

                            // Should return all rewards for the duration of one second.
                            await setTime(now.add(duration.seconds(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(50));

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(10));

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(30));

                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(25));

                            await setTime(now.add(duration.weeks(3)));
                            await testPartialRewards(provider, prevReward, duration.weeks(3));
                        });

                        it('should keep all rewards when removing liquidity', async () => {
                            // Should return all rewards for four weeks, with the four weeks multiplier bonus
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const unclaimed = await staking.pendingRewards(provider);
                            expect(unclaimed).to.be.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));
                            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance);

                            // Should not affect the claimable amount.
                            let reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(1)));

                            // Should retroactively apply the two weeks multiplier on the debt rewards.
                            const multiplier2 = getRewardsMultiplier(duration.weeks(1));
                            let bestMultiplier = MathUtils.max(debMultiplier, multiplier2);
                            reward = await staking.pendingRewards(provider);

                            let expectedRewards = getExpectedRewards(provider, duration.weeks(1)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);

                            // Should retroactively apply the four weeks multiplier on the unclaimed rewards.
                            await setTime(now.add(duration.weeks(2)));

                            const multiplier3 = getRewardsMultiplier(duration.weeks(3));
                            bestMultiplier = MathUtils.max(multiplier2, multiplier3);
                            reward = await staking.pendingRewards(provider);

                            expectedRewards = getExpectedRewards(provider, duration.weeks(3)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);
                        });

                        it('should keep all rewards when partially removing liquidity', async () => {
                            // Should return all rewards for four weeks, with the four weeks multiplier bonus
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const unclaimed = await staking.pendingRewards(provider);
                            expect(unclaimed).to.be.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance);

                            // Should not affect the claimable amount.
                            let reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(2)));

                            // Should retroactively apply the two weeks multiplier on the debt rewards.
                            const multiplier2 = getRewardsMultiplier(duration.weeks(2));
                            let bestMultiplier = MathUtils.max(debMultiplier, multiplier2);
                            reward = await staking.pendingRewards(provider);

                            let expectedRewards = getExpectedRewards(provider, duration.weeks(2)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);

                            // Should retroactively apply the four weeks multiplier on the unclaimed rewards.
                            await setTime(now.add(duration.weeks(2)));

                            const multiplier3 = getRewardsMultiplier(duration.weeks(4));
                            bestMultiplier = MathUtils.max(multiplier2, multiplier3);
                            reward = await staking.pendingRewards(provider);

                            expectedRewards = getExpectedRewards(provider, duration.weeks(4)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);

                            // Remove all the remaining liquidity after two weeks.
                            await setTime(now.add(duration.weeks(2)));

                            const unclaimed2 = await staking.pendingRewards(provider);
                            expectAlmostEqual(
                                unclaimed2,
                                getExpectedRewards(provider, duration.weeks(6)).add(
                                    debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                                )
                            );

                            const debMultiplier2 = getRewardsMultiplier(duration.weeks(2));
                            const debt2 = unclaimed2.mul(PPM_RESOLUTION).div(debMultiplier2);

                            const prevBalance2 = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance2);

                            // Should not affect the claimable amount.
                            reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt2.mul(debMultiplier2).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(1)));

                            // Should retroactively apply the one weeks multiplier on the debt rewards.
                            const multiplier4 = getRewardsMultiplier(duration.weeks(1));
                            bestMultiplier = MathUtils.max(debMultiplier2, multiplier4);
                            reward = await staking.pendingRewards(provider);

                            expectedRewards = getExpectedRewards(provider, duration.weeks(1)).add(
                                debt2.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);
                        });

                        it('should properly calculate new position rewards after the program has ended', async () => {
                            // Should not affect rewards after the ending time of the program.
                            await setTime(programEndTime.add(duration.days(1)));

                            const provider3 = accounts[3];
                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            const reward = await staking.pendingRewards(provider3);
                            expect(reward).to.be.equal(BigNumber.from(0));

                            const claimed = await staking.claimRewards({ from: provider3 });
                            expect(claimed).to.be.equal(reward);
                        });

                        it('should return no rewards for non-participating reserves', async () => {
                            const nonParticipatingPoolToken = accounts[8];

                            expect(
                                await staking.pendingReserveRewards(
                                    provider,
                                    nonParticipatingPoolToken,
                                    reserveToken.address
                                )
                            ).to.be.equal(BigNumber.from(0));

                            expect(
                                await staking.pendingReserveRewards(provider, ZERO_ADDRESS, reserveToken.address)
                            ).to.be.equal(BigNumber.from(0));

                            expect(
                                await staking.pendingReserveRewards(provider, poolToken.address, ZERO_ADDRESS)
                            ).to.be.equal(BigNumber.from(0));
                        });
                    });

                    describe('claiming', async () => {
                        it('should claim all rewards', async () => {
                            // Should grant all rewards for the duration of one second.
                            await setTime(now.add(duration.seconds(1)));
                            await testClaim(provider);

                            // Should return all rewards for a single day, excluding previously granted rewards.
                            await setTime(programStartTime.add(duration.days(1)));
                            await testClaim(provider);

                            // Should return all weekly rewards, excluding previously granted rewards, but without the
                            // multiplier bonus.
                            await setTime(programStartTime.add(duration.weeks(1)));
                            await testClaim(provider);

                            // Should return all the rewards for the two weeks, excluding previously granted rewards, with the
                            // two weeks rewards multiplier.
                            await setTime(programStartTime.add(duration.weeks(3)));
                            await testClaim(provider, duration.weeks(2));

                            // Should return all program rewards, excluding previously granted rewards + max retroactive
                            // multipliers.
                            await setTime(programEndTime);
                            await testClaim(provider, duration.weeks(4));

                            // Should return no additional rewards after the ending time of the program.
                            await setTime(programEndTime.add(duration.days(1)));
                            await testClaim(provider);
                        });

                        it('should allow claiming rewards after removing liquidity', async () => {
                            // Should return all rewards for four weeks, with the four weeks multiplier bonus
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const unclaimed = await staking.pendingRewards(provider);
                            expect(unclaimed).to.be.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));
                            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance);

                            // Should not affect the claimable amount.
                            const reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            const claimed = await staking.claimRewards({ from: provider });
                            expect(claimed).to.be.equal(reward);
                            const prevBalance2 = await networkToken.balanceOf(provider);
                            const tx = await staking.claimRewards({ from: provider });
                            if (claimed.gt(BigNumber.from(0))) {
                                expect(tx).to.emit(staking, 'RewardsClaimed').withArgs(provider, claimed);
                            }
                            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance2.add(reward));

                            expect(await staking.pendingRewards(provider)).to.be.equal(BigNumber.from(0));
                        });
                    });

                    describe('staking', async () => {
                        let reserveToken4;
                        let poolToken4;

                        beforeEach(async () => {
                            reserveToken4 = await Contracts.TestStandardToken.deploy('RSV4', 'RSV4', 18, TOTAL_SUPPLY);

                            poolToken4 = await createPoolToken(reserveToken4);

                            const reserveAmount = BigNumber.from(100000000).mul(
                                BigNumber.from(10).pow(BigNumber.from(18))
                            );
                            await reserveToken4.transfer(provider, reserveAmount);
                            await reserveToken4.approve(liquidityProtection.address, reserveAmount, { from: provider });

                            await liquidityProtection.addLiquidity(
                                poolToken4.address,
                                reserveToken4.address,
                                reserveAmount,
                                { from: provider }
                            );
                        });

                        it('should partially stake rewards', async () => {
                            // Should partially claim rewards for the duration of 5 hours.
                            await setTime(now.add(duration.hours(5)));

                            let reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            let amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = MathUtils.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            expect(await staking.pendingRewards(provider)).to.be.equal(BigNumber.from(0));

                            // Should return all rewards for a single day, excluding previously granted rewards.
                            await setTime(programStartTime.add(duration.days(1)));

                            reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = MathUtils.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            expect(await staking.pendingRewards(provider)).to.be.equal(BigNumber.from(0));

                            // Should return all weekly rewards, excluding previously granted rewards, but without the
                            // multiplier bonus.
                            await setTime(now.add(duration.weeks(1)));
                            await testClaim(provider);

                            // Should return all the rewards for the two weeks, excluding previously granted rewards
                            await setTime(now.add(duration.weeks(2)));

                            reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.equal(
                                getExpectedRewards(provider, now.sub(prevNow), duration.weeks(2))
                            );

                            amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = MathUtils.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            // Should return all program rewards, excluding previously granted rewards + max retroactive
                            // multipliers.
                            await setTime(programEndTime);

                            reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.equal(
                                getExpectedRewards(provider, now.sub(prevNow), duration.weeks(4))
                            );

                            amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = MathUtils.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }
                        });

                        it('should not allow staking more than the claimable rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            const amount = reward.mul(BigNumber.from(10000));
                            const data = await staking.stakeRewards(amount, poolToken4.address, {
                                from: provider
                            });
                            expect(data[0]).to.be.equal(reward);

                            const tx = await staking.stakeRewards(amount, poolToken4.address, {
                                from: provider
                            });
                            expect(tx)
                                .to.emit(staking, 'RewardsStaked')
                                .withArgs(provider, poolToken4.address, reward, data[1]);

                            const position = await getPosition(provider, data[1]);
                            expect(position.poolToken).to.eql(poolToken4.address);
                            expect(position.reserveToken).to.eql(networkToken.address);
                            expect(position.reserveAmount).to.be.equal(reward);

                            expect(await staking.pendingRewards(provider)).to.be.equal(BigNumber.from(0));
                        });

                        it('should allow staking, removal, and then claiming of the rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            const amount = reward.div(BigNumber.from(2));
                            const data = await staking.stakeRewards(amount, poolToken4.address, {
                                from: provider
                            });
                            expect(data[0]).to.be.equal(amount);

                            // Stake some of the rewards.
                            await staking.stakeRewards(amount, poolToken4.address, {
                                from: provider
                            });

                            let remainingReward = await staking.pendingRewards(provider);
                            if (remainingReward.eq(BigNumber.from(0))) {
                                expect(remainingReward).to.be.closeTo(reward.sub(amount), BigNumber.from(1));
                            } else {
                                expectAlmostEqual(remainingReward, reward.sub(amount));
                            }

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));

                            expect(await networkToken.balanceOf(provider)).to.be.equal(prevBalance);

                            // The removal shouldn't affect the pending rewards.
                            expectAlmostEqual(await staking.pendingRewards(provider), remainingReward);
                            remainingReward = await staking.pendingRewards(provider);

                            // Claim all the rewards.
                            const claimed = await staking.claimRewards({ from: provider });
                            expect(claimed).to.be.equal(remainingReward);

                            const prevBalance2 = await networkToken.balanceOf(provider);
                            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

                            await staking.claimRewards({ from: provider });

                            expect(await networkToken.balanceOf(provider)).to.be.equal(
                                prevBalance2.add(remainingReward)
                            );
                            expect(await staking.totalClaimedRewards(provider)).to.be.equal(
                                prevTotalProviderClaimed.add(remainingReward)
                            );

                            expect(await staking.pendingRewards(provider)).to.be.equal(BigNumber.from(0));
                        });
                    });
                });
            }

            describe('storing pool rewards', async () => {
                it('should revert when a non-updater attempts store pool rewards', async () => {
                    await expect(staking.storePoolRewards(providers, poolToken.address)).to.be.revertedWith(
                        'ERR_ACCESS_DENIED'
                    );
                });

                context('updater', async () => {
                    it('should store all rewards for all providers', async () => {
                        // Should grant all rewards for the duration of one second.
                        await setTime(now.add(duration.seconds(1)));
                        await testStorePoolRewards(providers, poolToken);

                        // Should return all rewards for a single day, excluding previously granted rewards.
                        await setTime(programStartTime.add(duration.days(1)));
                        await testStorePoolRewards(providers, poolToken);

                        // Should return all weekly rewards, excluding previously granted rewards, but without the
                        // multiplier bonus.
                        await setTime(programStartTime.add(duration.weeks(1)));
                        await testStorePoolRewards(providers, poolToken2);

                        // Should return all the rewards for the two weeks, excluding previously granted rewards, with the
                        // two weeks rewards multiplier.
                        await setTime(programStartTime.add(duration.weeks(3)));
                        await testStorePoolRewards(providers, poolToken2);

                        // Should return all program rewards, excluding previously granted rewards + max retroactive
                        // multipliers.
                        await setTime(programEndTime);
                        await testStorePoolRewards(providers, poolToken3);

                        // Should return no additional rewards after the ending time of the program.
                        await setTime(programEndTime.add(duration.days(1)));
                        await testStorePoolRewards(providers, poolToken);
                    });

                    it('should handle storing rewards for repeated or not participating providers', async () => {
                        await setTime(now.add(duration.seconds(1)));
                        await testStorePoolRewards([providers[0], providers[0], providers[0]], poolToken);

                        const provider3 = accounts[3];
                        await setTime(programStartTime.add(duration.days(5)));
                        testStorePoolRewards([provider3, providers[0], provider3], poolToken2);
                    });

                    it('should not store rewards for non-participating pools', async () => {
                        const nonParticipatingPoolToken = accounts[8];
                        await staking.storePoolRewards(providers, nonParticipatingPoolToken, { from: updater });
                        for (const provider of providers) {
                            const providerRewards = await getProviderRewards(
                                provider,
                                nonParticipatingPoolToken,
                                ZERO_ADDRESS
                            );
                            expect(providerRewards.rewardPerToken).to.be.equal(BigNumber.from(0));
                            expect(providerRewards.pendingBaseRewards).to.be.equal(BigNumber.from(0));
                            expect(providerRewards.totalClaimedRewards).to.be.equal(BigNumber.from(0));
                            expect(providerRewards.effectiveStakingTime).to.be.equal(BigNumber.from(0));
                            expect(providerRewards.baseRewardsDebt).to.be.equal(BigNumber.from(0));
                            expect(providerRewards.baseRewardsDebtMultiplier).to.be.equal(BigNumber.from(0));
                        }
                    });
                });
            });
        };

        context('single pool', async () => {
            beforeEach(async () => {
                programStartTime = now.add(duration.weeks(1));
                programEndTime = programStartTime.add(REWARDS_DURATION);

                await setTime(programStartTime);

                await addPoolProgram(poolToken, reserveToken, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                await addLiquidity(
                    providers[0],
                    poolToken,
                    reserveToken,
                    BigNumber.from(10000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                );
            });

            context('single sided staking', async () => {
                context('single provider', async () => {
                    // tests([providers[0]]);
                });

                context('multiple providers', async () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            BigNumber.from(222222).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                    });

                    // tests(providers);
                });
            });

            context('double sided staking', async () => {
                beforeEach(async () => {
                    await addLiquidity(
                        providers[0],
                        poolToken,
                        networkToken,
                        BigNumber.from(10000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                    );
                });

                context('single provider', async () => {
                    // tests([providers[0]]);
                });

                context('multiple providers', async () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            BigNumber.from(2222222).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );

                        await addLiquidity(
                            providers[1],
                            poolToken,
                            networkToken,
                            BigNumber.from(11000092).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                    });

                    // tests(providers);
                });
            });
        });

        context('multiple pools', async () => {
            beforeEach(async () => {
                programStartTime = now.add(duration.weeks(1));
                programEndTime = programStartTime.add(REWARDS_DURATION);

                await setTime(programStartTime);

                await addPoolProgram(poolToken, reserveToken, programEndTime, BIG_POOL_BASE_REWARD_RATE);
                await addPoolProgram(poolToken2, reserveToken2, programEndTime, SMALL_POOL_BASE_REWARD_RATE);
                await addPoolProgram(poolToken3, reserveToken3, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                await addLiquidity(
                    providers[0],
                    poolToken,
                    reserveToken,
                    BigNumber.from(605564).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                );
                await addLiquidity(
                    providers[0],
                    poolToken2,
                    reserveToken2,
                    BigNumber.from(11111111110).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                );
                await addLiquidity(
                    providers[0],
                    poolToken3,
                    reserveToken3,
                    BigNumber.from(33333333330).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                );
            });

            context('single sided staking', async () => {
                context('single provider', async () => {
                    // tests([providers[0]]);
                });

                context('multiple providers', async () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            BigNumber.from(666666).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken2,
                            reserveToken2,
                            BigNumber.from(88888888).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken3,
                            reserveToken3,
                            BigNumber.from(1111234).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                    });

                    // tests(providers);
                });
            });

            context('double sided staking', async () => {
                beforeEach(async () => {
                    await addLiquidity(
                        providers[0],
                        poolToken,
                        networkToken,
                        BigNumber.from(1000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                    );
                    await addLiquidity(
                        providers[0],
                        poolToken2,
                        networkToken,
                        BigNumber.from(8888888).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                    );
                    await addLiquidity(
                        providers[0],
                        poolToken3,
                        networkToken,
                        BigNumber.from(50000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                    );
                });

                context('single provider', async () => {
                    // tests([providers[0]]);
                });

                context('multiple providers', async () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            BigNumber.from(2342323432).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken2,
                            reserveToken2,
                            BigNumber.from(322222222222).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken3,
                            reserveToken3,
                            BigNumber.from(11100008).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );

                        await addLiquidity(
                            providers[1],
                            poolToken,
                            networkToken,
                            BigNumber.from(7777700).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken2,
                            networkToken,
                            BigNumber.from(234324).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken3,
                            networkToken,
                            BigNumber.from(100).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );
                    });

                    // tests(providers);
                });
            });
        });

        context('existing positions', async () => {
            let provider;

            before(async () => {
                provider = accounts[1];
            });

            beforeEach(async () => {
                programStartTime = now.add(duration.years(1));
                programEndTime = programStartTime.add(REWARDS_DURATION);

                expect(await store.isReserveParticipating(poolToken3.address, networkToken.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken3.address, reserveToken.address)).to.be.false;
            });

            for (const timeDiff of [duration.days(1), duration.weeks(1), duration.weeks(6)]) {
                context(
                    `staking ${humanizeDuration(timeDiff.mul(BigNumber.from(1000)).toString(), {
                        units: ['d']
                    })} before the start of the program`,
                    async () => {
                        beforeEach(async () => {
                            await setTime(programStartTime.sub(timeDiff));

                            expect(await staking.pendingRewards(provider.address)).to.be.equal(BigNumber.from(0));
                        });

                        it('should only take into account staking duration after the start of the program', async () => {
                            await addLiquidity(
                                provider,
                                poolToken3,
                                reserveToken3,
                                BigNumber.from(11100008).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );
                            expect(await staking.pendingRewards(provider.address)).to.be.equal(BigNumber.from(0));

                            await setTime(programStartTime);
                            await addPoolProgram(poolToken3, reserveToken3, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                            expect(await staking.pendingRewards(provider.address)).to.be.equal(BigNumber.from(0));

                            await setTime(now.add(duration.days(5)));
                            await testRewards(provider.address);

                            await setTime(now.add(duration.weeks(1)));
                            await testRewards(provider.address, duration.weeks(1));
                        });
                    }
                );

                context(
                    `staking ${humanizeDuration(timeDiff.mul(BigNumber.from(1000)).toString(), {
                        units: ['d']
                    })} after the start of the program`,
                    async () => {
                        beforeEach(async () => {
                            await setTime(programStartTime);

                            await addPoolProgram(poolToken3, reserveToken3, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                            await setTime(programStartTime.add(timeDiff));
                        });

                        it('should only take into account effective staking duration after the start of the program', async () => {
                            await addLiquidity(
                                provider,
                                poolToken3,
                                reserveToken3,
                                BigNumber.from(99999999).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            expect(await staking.pendingRewards(provider.address)).to.be.equal(BigNumber.from(0));

                            let stakingTime = BigNumber.from(0);
                            for (const stakingDuration of [duration.days(5), duration.weeks(1), duration.weeks(4)]) {
                                stakingTime = stakingTime.add(stakingDuration);

                                await setTime(now.add(stakingDuration));
                                expect(await staking.pendingRewards(provider.address)).to.be.equal(
                                    getExpectedRewards(provider.address, stakingTime)
                                );
                            }
                        });
                    }
                );
            }
        });
    });
});
