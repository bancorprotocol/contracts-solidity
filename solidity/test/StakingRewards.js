const { accounts, contract, defaultSender } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN, constants, time } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { registry, roles } = require('./helpers/Constants');
const Decimal = require('decimal.js');
const humanizeDuration = require('humanize-duration');
const { set } = require('lodash');

const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('TestStandardPoolConverterFactory');
const StandardPoolConverter = contract.fromArtifact('TestStandardPoolConverter');
const DSToken = contract.fromArtifact('DSToken');
const TestStandardToken = contract.fromArtifact('TestStandardToken');
const TestConverterRegistry = contract.fromArtifact('TestConverterRegistry');
const TestStakingRewardsStore = contract.fromArtifact('TestStakingRewardsStore');
const TestTokenGovernance = contract.fromArtifact('TestTokenGovernance');
const TestCheckpointStore = contract.fromArtifact('TestCheckpointStore');
const TestStakingRewards = contract.fromArtifact('TestStakingRewards');
const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionStore = contract.fromArtifact('LiquidityProtectionStore');
const LiquidityProtectionStats = contract.fromArtifact('LiquidityProtectionStats');
const LiquidityProtectionSystemStore = contract.fromArtifact('LiquidityProtectionSystemStore');
const TokenHolder = contract.fromArtifact('TokenHolder');
const TestLiquidityProtection = contract.fromArtifact('TestLiquidityProtection');

const { ZERO_ADDRESS } = constants;
const { duration, latest } = time;
const { ROLE_SUPERVISOR, ROLE_OWNER, ROLE_MANAGER, ROLE_GOVERNOR, ROLE_MINTER, ROLE_UPDATER, ROLE_PUBLISHER } = roles;
const { CONVERTER_FACTORY, CONVERTER_REGISTRY, CONVERTER_REGISTRY_DATA, LIQUIDITY_PROTECTION } = registry;

const PPM_RESOLUTION = new BN(1000000);
const MULTIPLIER_INCREMENT = PPM_RESOLUTION.div(new BN(4)); // 25%
const NETWORK_TOKEN_REWARDS_SHARE = new BN(700000); // 70%
const BASE_TOKEN_REWARDS_SHARE = new BN(300000); // 30%

const REWARD_RATE_FACTOR = new BN(10).pow(new BN(18));
const REWARDS_DURATION = duration.weeks(12);
const BIG_POOL_BASE_REWARD_RATE = new BN(100000).mul(new BN(10).pow(new BN(18))).div(duration.weeks(1));
const SMALL_POOL_BASE_REWARD_RATE = new BN(10000).mul(new BN(10).pow(new BN(18))).div(duration.weeks(1));

const RESERVE1_AMOUNT = new BN(10000000).mul(new BN(10).pow(new BN(18)));
const RESERVE2_AMOUNT = new BN(25000000).mul(new BN(10).pow(new BN(18)));
const TOTAL_SUPPLY = new BN(10).pow(new BN(36));

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

    const toPPM = (percent) => new BN(percent).mul(PPM_RESOLUTION).div(new BN(100));

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
            return PPM_RESOLUTION.add(MULTIPLIER_INCREMENT.mul(new BN(2)));
        }

        // For 3 <= x < 4 weeks: 175% PPM
        if (stakingDuration.gte(duration.weeks(3)) && stakingDuration.lt(duration.weeks(4))) {
            return PPM_RESOLUTION.add(MULTIPLIER_INCREMENT.mul(new BN(3)));
        }

        // For x >= 4 weeks: 200% PPM
        return PPM_RESOLUTION.mul(new BN(2));
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
            const error = new Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
            expect(error.lte(maxError)).to.equal(true, `error = ${error.toFixed(maxError.length)}`);
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
        const poolToken = await DSToken.at(poolTokenAddress);
        const converterAddress = await poolToken.owner();
        const converter = await StandardPoolConverter.at(converterAddress);
        await converter.acceptOwnership();

        await reserveToken.approve(converter.address, RESERVE1_AMOUNT);
        await networkToken.approve(converter.address, RESERVE2_AMOUNT);

        await converter.addLiquidity(
            [reserveToken.address, networkToken.address],
            [RESERVE1_AMOUNT, RESERVE2_AMOUNT],
            1
        );

        await liquidityProtectionSettings.addPoolToWhitelist(poolTokenAddress);
        await liquidityProtectionSettings.setNetworkTokenMintingLimit(poolTokenAddress, TOTAL_SUPPLY);

        return poolToken;
    };

    before(async () => {
        supervisor = defaultSender;
        updater = accounts[1];

        contractRegistry = await ContractRegistry.new();
        converterRegistry = await TestConverterRegistry.new(contractRegistry.address);
        const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

        const standardPoolConverterFactory = await StandardPoolConverterFactory.new();
        const converterFactory = await ConverterFactory.new();
        await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

        await contractRegistry.registerAddress(CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY_DATA, converterRegistryData.address);
    });

    beforeEach(async () => {
        networkToken = await DSToken.new('BNT', 'BNT', 18);
        await networkToken.issue(supervisor, TOTAL_SUPPLY);

        reserveToken = await TestStandardToken.new('RSV1', 'RSV1', 18, TOTAL_SUPPLY);
        reserveToken2 = await TestStandardToken.new('RSV2', 'RSV2', 18, TOTAL_SUPPLY);
        reserveToken3 = await TestStandardToken.new('RSV3', 'RSV3', 18, TOTAL_SUPPLY);

        networkTokenGovernance = await TestTokenGovernance.new(networkToken.address);
        await networkTokenGovernance.grantRole(ROLE_GOVERNOR, supervisor);
        await networkTokenGovernance.grantRole(ROLE_MINTER, supervisor);
        await networkToken.transferOwnership(networkTokenGovernance.address);
        await networkTokenGovernance.acceptTokenOwnership();

        const govToken = await DSToken.new('vBNT', 'vBNT', 18);
        const govTokenGovernance = await TestTokenGovernance.new(govToken.address);
        await govTokenGovernance.grantRole(ROLE_GOVERNOR, supervisor);
        await govToken.transferOwnership(govTokenGovernance.address);
        await govTokenGovernance.acceptTokenOwnership();

        checkpointStore = await TestCheckpointStore.new();

        store = await TestStakingRewardsStore.new();
        staking = await TestStakingRewards.new(
            store.address,
            networkTokenGovernance.address,
            checkpointStore.address,
            contractRegistry.address
        );

        await staking.grantRole(ROLE_UPDATER, updater);
        await store.grantRole(ROLE_OWNER, staking.address);
        await store.grantRole(ROLE_MANAGER, supervisor);
        await networkTokenGovernance.grantRole(ROLE_MINTER, staking.address);

        liquidityProtectionSettings = await LiquidityProtectionSettings.new(
            networkToken.address,
            contractRegistry.address
        );

        await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(new BN(0));

        liquidityProtectionStore = await LiquidityProtectionStore.new();
        liquidityProtectionStats = await LiquidityProtectionStats.new();
        liquidityProtectionSystemStore = await LiquidityProtectionSystemStore.new();
        liquidityProtectionWallet = await TokenHolder.new();
        liquidityProtection = await TestLiquidityProtection.new(
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

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            const newStaking = await TestStakingRewards.new(
                store.address,
                networkTokenGovernance.address,
                checkpointStore.address,
                contractRegistry.address
            );

            expect(await newStaking.getRoleMemberCount(ROLE_SUPERVISOR)).to.be.bignumber.equal(new BN(1));
            expect(await newStaking.getRoleMemberCount(ROLE_PUBLISHER)).to.be.bignumber.equal(new BN(0));
            expect(await newStaking.getRoleMemberCount(ROLE_UPDATER)).to.be.bignumber.equal(new BN(0));

            expect(await newStaking.getRoleAdmin(ROLE_SUPERVISOR)).to.equal(ROLE_SUPERVISOR);
            expect(await newStaking.getRoleAdmin(ROLE_PUBLISHER)).to.equal(ROLE_SUPERVISOR);
            expect(await newStaking.getRoleAdmin(ROLE_UPDATER)).to.equal(ROLE_SUPERVISOR);

            expect(await newStaking.hasRole(ROLE_SUPERVISOR, supervisor)).to.be.true();
            expect(await newStaking.hasRole(ROLE_PUBLISHER, supervisor)).to.be.false();
            expect(await newStaking.hasRole(ROLE_UPDATER, supervisor)).to.be.false();
        });

        it('should initialize the state', async () => {
            expect(await staking.store()).to.equal(store.address);
        });

        it('should revert if initialized with a zero address store', async () => {
            await expectRevert(
                TestStakingRewards.new(
                    ZERO_ADDRESS,
                    networkTokenGovernance.address,
                    checkpointStore.address,
                    contractRegistry.address
                ),
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert if initialized with a zero address network governance', async () => {
            await expectRevert(
                TestStakingRewards.new(store.address, ZERO_ADDRESS, checkpointStore.address, contractRegistry.address),
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert if initialized with a zero address checkpoint store', async () => {
            await expectRevert(
                TestStakingRewards.new(
                    store.address,
                    networkTokenGovernance.address,
                    ZERO_ADDRESS,
                    contractRegistry.address
                ),
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert if initialized with a zero address registry', async () => {
            await expect(
                TestStakingRewards.new(
                    store.address,
                    networkTokenGovernance.address,
                    checkpointStore.address,
                    ZERO_ADDRESS
                ),
                'ERR_INVALID_ADDRESS'
            );
        });
    });

    describe('notifications', () => {
        const id = new BN(123);
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

            await staking.grantRole(ROLE_PUBLISHER, liquidityProtectionProxy);

            await store.addPoolProgram(
                poolToken.address,
                [networkToken.address, reserveToken.address],
                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                now.add(REWARDS_DURATION),
                BIG_POOL_BASE_REWARD_RATE
            );
        });

        it('should revert when a non-LP contract attempts to notify', async () => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            await expect(
                staking.onAddingLiquidity(provider, poolTokenAddress, reserveTokenAddress, 0, 0, {
                    from: nonLiquidityProtection
                }),
                'ERR_ACCESS_DENIED'
            );

            await expect(
                staking.onRemovingLiquidity(id, provider, poolTokenAddress, reserveTokenAddress, 0, 0, {
                    from: nonLiquidityProtection
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when notifying for a zero provider ', async () => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            await expect(
                staking.onAddingLiquidity(ZERO_ADDRESS, poolTokenAddress, reserveTokenAddress, 0, 0, {
                    from: liquidityProtectionProxy
                }),
                'ERR_INVALID_EXTERNAL_ADDRESS'
            );

            await expect(
                staking.onRemovingLiquidity(id, ZERO_ADDRESS, poolTokenAddress, reserveTokenAddress, 0, 0, {
                    from: liquidityProtectionProxy
                }),
                'ERR_INVALID_EXTERNAL_ADDRESS'
            );
        });
    });

    describe('rewards', () => {
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

            for (const { address: poolTokenAddress } of poolTokens) {
                const reserveTokenAddress = reserveTokens[poolTokenAddress];

                set(totalReserveAmounts, [poolTokenAddress, reserveTokenAddress], new BN(0));
                set(totalReserveAmounts, [poolTokenAddress, networkToken.address], new BN(0));

                set(programs, [poolTokenAddress, reserveTokenAddress], new BN(0));
                set(programs, [poolTokenAddress, networkToken.address], new BN(0));

                for (const provider of accounts) {
                    set(positions, [provider, poolTokenAddress, reserveTokenAddress], []);
                    set(positions, [provider, poolTokenAddress, networkToken.address], []);

                    providerPools[provider] = {};

                    set(reserveAmounts, [provider, poolTokenAddress, reserveTokenAddress], new BN(0));
                    set(reserveAmounts, [provider, poolTokenAddress, networkToken.address], new BN(0));
                }
            }
        });

        const addTestLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            if (!providerPools[provider][poolTokenAddress]) {
                providerPools[provider][poolTokenAddress] = [];
            }

            const reserveTokens = providerPools[provider][poolTokenAddress];
            if (!reserveTokens.includes(reserveTokenAddress)) {
                reserveTokens.push(reserveTokenAddress);
            }

            reserveAmounts[provider][poolTokenAddress][reserveTokenAddress] = reserveAmounts[provider][
                poolTokenAddress
            ][reserveTokenAddress].add(reserveAmount);

            totalReserveAmounts[poolTokenAddress][reserveTokenAddress] = totalReserveAmounts[poolTokenAddress][
                reserveTokenAddress
            ].add(reserveAmount);
        };

        const addLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            addTestLiquidity(provider, poolToken, reserveToken, reserveAmount);

            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            if (reserveTokenAddress !== networkToken.address) {
                await reserveToken.transfer(provider, reserveAmount);
            } else {
                await networkTokenGovernance.mint(provider, reserveAmount);
            }
            await reserveToken.approve(liquidityProtection.address, reserveAmount, { from: provider });

            await liquidityProtection.addLiquidity(poolTokenAddress, reserveTokenAddress, reserveAmount, {
                from: provider
            });

            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(provider);
            const protectionId = protectionIds[0];
            positions[provider][poolTokenAddress][reserveTokenAddress].push(protectionId);
        };

        const removeTestLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            expect(reserveAmounts[provider][poolTokenAddress][reserveTokenAddress]).to.be.bignumber.gte(reserveAmount);
            expect(totalReserveAmounts[poolTokenAddress][reserveTokenAddress]).to.be.bignumber.gte(reserveAmount);

            reserveAmounts[provider][poolTokenAddress][reserveTokenAddress] = reserveAmounts[provider][
                poolTokenAddress
            ][reserveTokenAddress].sub(reserveAmount);

            totalReserveAmounts[poolTokenAddress][reserveTokenAddress] = totalReserveAmounts[poolTokenAddress][
                reserveTokenAddress
            ].sub(reserveAmount);

            if (reserveAmounts[provider][poolTokenAddress][reserveTokenAddress].eq(new BN(0))) {
                providerPools[provider][poolTokenAddress].splice(
                    providerPools[provider][poolTokenAddress].indexOf(reserveTokenAddress),
                    1
                );

                let reserveToken2;
                let reserveAmount2;
                if (providerPools[provider][poolTokenAddress].length > 0) {
                    reserveToken2 = providerPools[provider][poolTokenAddress][0];
                    reserveAmount2 = reserveAmounts[provider][poolTokenAddress][reserveToken2.address];
                }

                if (!reserveToken2 || !reserveAmount2 || reserveAmount2.eq(new BN(0))) {
                    providerPools[provider].poolTokens = [];
                }
            }
        };

        const removeLiquidity = async (provider, poolToken, reserveToken, portion) => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            const id = positions[provider][poolTokenAddress][reserveTokenAddress][0];
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
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            programs[poolTokenAddress] = {
                now,
                programEndTime,
                rewardRate
            };

            await store.addPoolProgram(
                poolTokenAddress,
                [networkToken.address, reserveTokenAddress],
                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                programEndTime,
                rewardRate
            );
        };

        const getPosition = async (provider, id) => {
            const position = await liquidityProtectionStore.protectedLiquidity(id);

            expect(provider).to.equal(position[0]);

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

        const getExpectedRewards = (provider, duration, multiplierDuration = undefined) => {
            let reward = new BN(0);
            if (duration.lte(new BN(0))) {
                return reward;
            }

            for (const poolToken in providerPools[provider]) {
                reward = reward.add(getExpectedPoolRewards(provider, poolToken, duration, multiplierDuration));
            }

            return reward;
        };

        const getExpectedPoolRewards = (provider, poolToken, duration, multiplierDuration = undefined) => {
            let reward = new BN(0);
            if (duration.lte(new BN(0))) {
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
            const reward = new BN(0);
            if (duration.lte(new BN(0))) {
                return reward;
            }

            const rewardShare =
                reserveToken === networkToken.address ? NETWORK_TOKEN_REWARDS_SHARE : BASE_TOKEN_REWARDS_SHARE;

            if (totalReserveAmounts[poolToken][reserveToken].eq(new BN(0))) {
                return new BN(0);
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

            const effectiveTime = BN.min(now, programEndTime);
            const expectedReward = getExpectedRewards(
                provider,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.be.bignumber.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.bignumber.equal(new BN(0));
        };

        const testPoolRewards = async (provider, poolToken, multiplierDuration = undefined) => {
            const { address: poolTokenAddress } = poolToken;

            const reward = await staking.pendingPoolRewards(provider, poolTokenAddress);

            const effectiveTime = BN.min(now, programEndTime);
            const expectedReward = getExpectedPoolRewards(
                provider,
                poolTokenAddress,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.be.bignumber.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.bignumber.equal(new BN(0));
        };

        const testReserveRewards = async (provider, poolToken, reserveToken, multiplierDuration = undefined) => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            const reward = await staking.pendingReserveRewards(provider, poolTokenAddress, reserveTokenAddress);

            const effectiveTime = BN.min(now, programEndTime);
            const expectedReward = getExpectedReserveRewards(
                provider,
                poolTokenAddress,
                reserveTokenAddress,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.be.bignumber.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.bignumber.equal(new BN(0));
        };

        const testPartialRewards = async (provider, prevReward, multiplierDuration = undefined) => {
            const reward = await staking.pendingRewards(provider);

            const effectiveTime = BN.min(now, programEndTime);
            const extraReward = getExpectedRewards(provider, effectiveTime.sub(prevNow), multiplierDuration);
            const multiplier = getRewardsMultiplier(multiplierDuration || effectiveTime.sub(programStartTime));

            expectAlmostEqual(prevReward.mul(multiplier).div(PPM_RESOLUTION).add(extraReward), reward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(provider);
            expect(totalProviderClaimedRewards).to.be.bignumber.equal(new BN(0));
        };

        const testClaim = async (provider, multiplierDuration = undefined) => {
            const reward = await staking.pendingRewards(provider);

            const effectiveTime = BN.min(now, programEndTime);
            const expectedReward = getExpectedRewards(provider, effectiveTime.sub(prevNow), multiplierDuration);

            expect(reward).to.be.bignumber.equal(expectedReward);

            const claimed = await staking.claimRewards.call({ from: provider });
            expect(claimed).to.be.bignumber.equal(reward);

            const prevBalance = await networkToken.balanceOf(provider);
            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

            const tx = await staking.claimRewards({ from: provider });
            if (claimed.gt(new BN(0))) {
                expectEvent(tx, 'RewardsClaimed', { provider, amount: claimed });
            }

            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(prevBalance.add(reward));
            expect(await staking.totalClaimedRewards(provider)).to.be.bignumber.equal(
                prevTotalProviderClaimed.add(reward)
            );

            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));
        };

        const testStorePoolRewards = async (providers, poolToken) => {
            const pendingRewards = {};
            const effectiveStakingTimes = {};

            const { address: poolTokenAddress } = poolToken;

            for (const provider of providers) {
                for (const reserveTokenAddress of providerPools[provider][poolTokenAddress] || []) {
                    set(
                        pendingRewards,
                        [provider, poolTokenAddress, reserveTokenAddress],
                        await staking.pendingReserveRewards(provider, poolTokenAddress, reserveTokenAddress)
                    );

                    const providerRewards = await getProviderRewards(provider, poolTokenAddress, reserveTokenAddress);

                    set(
                        effectiveStakingTimes,
                        [provider, poolTokenAddress, reserveTokenAddress],
                        providerRewards.effectiveStakingTime
                    );
                }
            }

            await staking.storePoolRewards(providers, poolTokenAddress, { from: updater });

            for (const provider of providers) {
                for (const reserveTokenAddress of providerPools[provider][poolTokenAddress] || []) {
                    const providerRewards = await getProviderRewards(provider, poolTokenAddress, reserveTokenAddress);

                    const multiplier = await staking.rewardsMultiplier(provider, poolTokenAddress, reserveTokenAddress);

                    expectAlmostEqual(
                        providerRewards.baseRewardsDebt
                            .mul(providerRewards.baseRewardsDebtMultiplier)
                            .mul(multiplier)
                            .div(PPM_RESOLUTION)
                            .div(PPM_RESOLUTION),
                        pendingRewards[provider][poolTokenAddress][reserveTokenAddress]
                    );

                    expectAlmostEqual(
                        await staking.pendingReserveRewards(provider, poolTokenAddress, reserveTokenAddress),
                        pendingRewards[provider][poolTokenAddress][reserveTokenAddress]
                    );

                    expect(providerRewards.effectiveStakingTime).to.be.bignumber.equal(
                        effectiveStakingTimes[provider][poolTokenAddress][reserveTokenAddress]
                    );
                }
            }
        };

        const testStaking = async (provider, amount, newPoolToken, participating = false) => {
            const { address: newPoolTokenAddress } = newPoolToken;

            const reward = await staking.pendingRewards(provider);

            const data = await staking.stakeRewards.call(amount, newPoolTokenAddress, { from: provider });
            expect(data[0]).to.be.bignumber.equal(amount);

            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

            expectEvent(await staking.stakeRewards(amount, newPoolTokenAddress, { from: provider }), 'RewardsStaked', {
                provider,
                poolToken: newPoolTokenAddress,
                amount,
                newId: data[1]
            });

            // If we're staking to a participating pool, don't forget to update the local liquidity state for staking.
            if (participating) {
                addTestLiquidity(provider, newPoolToken, networkToken, amount);
            }

            expect(await staking.totalClaimedRewards(provider)).to.be.bignumber.equal(
                prevTotalProviderClaimed.add(data[0])
            );

            const position = await getPosition(provider, data[1]);
            expect(position.poolToken).to.equal(newPoolTokenAddress);
            expect(position.reserveToken).to.equal(networkToken.address);
            expect(position.reserveAmount).to.be.bignumber.equal(amount);

            const newReward = await staking.pendingRewards(provider);

            // take into account that there might be very small imprecisions when dealing with
            // multipliers
            if (newReward.eq(new BN(0))) {
                expect(newReward).to.be.bignumber.closeTo(reward.sub(amount), new BN(1));
            } else {
                expectAlmostEqual(newReward, reward.sub(amount));
            }

            return newReward;
        };

        const testReserveStaking = async (
            provider,
            poolToken,
            reserveToken,
            amount,
            newPoolToken,
            participating = false
        ) => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;
            const { address: newPoolTokenAddress } = newPoolToken;

            const reward = await staking.pendingRewards(provider);
            const poolReward = await staking.pendingPoolRewards(provider, poolTokenAddress);
            const reserveReward = await staking.pendingReserveRewards(provider, poolTokenAddress, reserveTokenAddress);

            const data = await staking.stakeReserveRewards.call(
                poolTokenAddress,
                reserveTokenAddress,
                amount,
                newPoolTokenAddress,
                { from: provider }
            );
            const staked = data[0];
            const newId = data[1];

            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

            expectEvent(
                await staking.stakeReserveRewards(poolTokenAddress, reserveTokenAddress, amount, newPoolTokenAddress, {
                    from: provider
                }),
                'RewardsStaked',
                { provider, poolToken: newPoolTokenAddress, amount, newId }
            );

            // If we're staking to a participating pool, don't forget to update the local liquidity state for staking.
            if (participating) {
                addTestLiquidity(provider, newPoolToken, networkToken, amount);
            }

            expect(await staking.totalClaimedRewards(provider)).to.be.bignumber.equal(
                prevTotalProviderClaimed.add(staked)
            );

            const position = await getPosition(provider, newId);
            expect(position.poolToken).to.equal(newPoolTokenAddress);
            expect(position.reserveToken).to.equal(networkToken.address);
            expect(position.reserveAmount).to.be.bignumber.equal(amount);

            const newReserveReward = await staking.pendingReserveRewards(
                provider,
                poolTokenAddress,
                reserveTokenAddress
            );

            // Take into account that there might be very small imprecisions when dealing with multipliers
            if (newReserveReward.eq(new BN(0))) {
                expect(newReserveReward).to.be.bignumber.closeTo(reserveReward.sub(amount), new BN(1));
            } else {
                expectAlmostEqual(newReserveReward, reserveReward.sub(amount));
            }

            const diff = reserveReward.sub(newReserveReward);
            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(reward.sub(diff));
            expect(await staking.pendingPoolRewards(provider, poolTokenAddress)).to.be.bignumber.equal(
                poolReward.sub(diff)
            );

            return newReserveReward;
        };

        const tests = (providersIndices = []) => {
            for (let i = 0; i < providersIndices.length; ++i) {
                context(`provider #${providersIndices[i]}`, () => {
                    let provider;

                    beforeEach(async () => {
                        provider = providers[providersIndices[i]];
                    });

                    describe('querying', () => {
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
                            const { address: poolTokenAddress } = poolToken;
                            const { address: networkTokenAddress } = networkToken;

                            await addLiquidity(
                                provider,
                                poolToken,
                                networkToken,
                                new BN(1).mul(new BN(10).pow(new BN(18)))
                            );

                            // Should return the correct multiplier for a duration of one second.
                            let actualMultiplier;
                            let expectedMultiplier;
                            let stakingDuration = duration.seconds(1);
                            await setTime(now.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.bignumber.equal(expectedMultiplier);

                            // Should return the correct multiplier for a duration of a single day after program start.
                            stakingDuration = duration.days(1);
                            await setTime(programStartTime.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.bignumber.equal(expectedMultiplier);

                            // Should return the correct multiplier for a duration of a single week after program start.
                            stakingDuration = duration.weeks(1);
                            await setTime(programStartTime.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.bignumber.equal(expectedMultiplier);

                            // Should return full multiplier for a duration of at least 4 weeks after program start.
                            stakingDuration = duration.weeks(4);
                            await setTime(programEndTime);
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.bignumber.equal(expectedMultiplier);

                            // Should keep the current multiplier after staking
                            const reward = await staking.pendingRewards(provider);
                            const amount = reward.div(new BN(10));
                            await testStaking(provider, amount, poolToken, true);
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expect(actualMultiplier).to.be.bignumber.equal(expectedMultiplier);

                            // Should return full multiplier after the ending time of the program.
                            stakingDuration = duration.weeks(4);
                            await setTime(programEndTime.add(duration.days(1)));
                            actualMultiplier = await staking.rewardsMultiplier(
                                provider,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.be.bignumber.equal(expectedMultiplier);
                        });

                        it('should not affect the rewards, when adding liquidity in the same block', async () => {
                            const provider3 = accounts[3];

                            await setTime(programStartTime.add(duration.weeks(5)));

                            const reward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                new BN(1).mul(new BN(10).pow(new BN(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                new BN(11111).mul(new BN(10).pow(new BN(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                new BN(1000000).mul(new BN(10).pow(new BN(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                new BN(11111).mul(new BN(10).pow(new BN(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                new BN(1).mul(new BN(10).pow(new BN(18)))
                            );

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                new BN(234324234234).mul(new BN(10).pow(new BN(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(provider), reward);
                        });

                        it('should not affect the rewards, when removing liquidity in the same block', async () => {
                            const provider3 = accounts[3];

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                new BN(1000000).mul(new BN(10).pow(new BN(18)))
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
                                new BN(1000).mul(new BN(10).pow(new BN(18)))
                            );

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                new BN(28238238).mul(new BN(10).pow(new BN(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                new BN(50000).mul(new BN(10).pow(new BN(18)))
                            );

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(provider);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                new BN(990930923).mul(new BN(10).pow(new BN(18)))
                            );

                            await addLiquidity(
                                provider3,
                                poolToken,
                                reserveToken,
                                new BN(2666678).mul(new BN(10).pow(new BN(18)))
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
                                new BN(1000000).mul(new BN(10).pow(new BN(18)))
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
                            expect(unclaimed).to.be.bignumber.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));
                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(prevBalance);

                            // Should not affect the claimable amount.
                            let reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(1)));

                            // Should retroactively apply the two weeks multiplier on the debt rewards.
                            const multiplier2 = getRewardsMultiplier(duration.weeks(1));
                            let bestMultiplier = BN.max(debMultiplier, multiplier2);
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
                            bestMultiplier = BN.max(multiplier2, multiplier3);
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
                            expect(unclaimed).to.be.bignumber.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(prevBalance);

                            // Should not affect the claimable amount.
                            let reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(2)));

                            // Should retroactively apply the two weeks multiplier on the debt rewards.
                            const multiplier2 = getRewardsMultiplier(duration.weeks(2));
                            let bestMultiplier = BN.max(debMultiplier, multiplier2);
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
                            bestMultiplier = BN.max(multiplier2, multiplier3);
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
                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(prevBalance2);

                            // Should not affect the claimable amount.
                            reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt2.mul(debMultiplier2).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(1)));

                            // Should retroactively apply the one weeks multiplier on the debt rewards.
                            const multiplier4 = getRewardsMultiplier(duration.weeks(1));
                            bestMultiplier = BN.max(debMultiplier2, multiplier4);
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
                                new BN(1000000).mul(new BN(10).pow(new BN(18)))
                            );

                            const reward = await staking.pendingRewards(provider3);
                            expect(reward).to.be.bignumber.be.bignumber.equal(new BN(0));

                            const claimed = await staking.claimRewards.call({ from: provider3 });
                            expect(claimed).to.be.bignumber.equal(reward);
                        });

                        it('should return no rewards for non-participating reserves', async () => {
                            const nonParticipatingPoolToken = accounts[8];
                            const { address: poolTokenAddress } = poolToken;
                            const { address: reserveTokenAddress } = reserveToken;

                            expect(
                                await staking.pendingReserveRewards(
                                    provider,
                                    nonParticipatingPoolToken,
                                    reserveTokenAddress
                                )
                            ).to.be.bignumber.be.bignumber.equal(new BN(0));

                            expect(
                                await staking.pendingReserveRewards(provider, ZERO_ADDRESS, reserveTokenAddress)
                            ).to.be.bignumber.be.bignumber.equal(new BN(0));

                            expect(
                                await staking.pendingReserveRewards(provider, poolTokenAddress, ZERO_ADDRESS)
                            ).to.be.bignumber.be.bignumber.equal(new BN(0));
                        });
                    });

                    describe('claiming', () => {
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
                            expect(unclaimed).to.be.bignumber.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));
                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(prevBalance);

                            // Should not affect the claimable amount.
                            const reward = await staking.pendingRewards(provider);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            const claimed = await staking.claimRewards.call({ from: provider });
                            expect(claimed).to.be.bignumber.equal(reward);
                            const prevBalance2 = await networkToken.balanceOf(provider);
                            const tx = await staking.claimRewards({ from: provider });
                            if (claimed.gt(new BN(0))) {
                                expectEvent(tx, 'RewardsClaimed', { provider, amount: claimed });
                            }

                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(
                                prevBalance2.add(reward)
                            );

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.be.bignumber.equal(
                                new BN(0)
                            );
                        });
                    });

                    describe('staking', () => {
                        let reserveToken4;
                        let poolToken4;

                        beforeEach(async () => {
                            reserveToken4 = await TestStandardToken.new('RSV4', 'RSV4', 18, TOTAL_SUPPLY);

                            poolToken4 = await createPoolToken(reserveToken4);

                            const reserveAmount = new BN(100000000).mul(new BN(10).pow(new BN(18)));

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
                            expect(reward).to.be.bignumber.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            let amount = reward.div(new BN(2));
                            while (reward.gt(new BN(0))) {
                                amount = BN.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));

                            // Should return all rewards for a single day, excluding previously granted rewards.
                            await setTime(programStartTime.add(duration.days(1)));

                            reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.bignumber.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            amount = reward.div(new BN(2));
                            while (reward.gt(new BN(0))) {
                                amount = BN.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));

                            // Should return all weekly rewards, excluding previously granted rewards, but without the
                            // multiplier bonus.
                            await setTime(now.add(duration.weeks(1)));
                            await testClaim(provider);

                            // Should return all the rewards for the two weeks, excluding previously granted rewards
                            await setTime(now.add(duration.weeks(2)));

                            reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.bignumber.equal(
                                getExpectedRewards(provider, now.sub(prevNow), duration.weeks(2))
                            );

                            amount = reward.div(new BN(2));
                            while (reward.gt(new BN(0))) {
                                amount = BN.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            // Should return all program rewards, excluding previously granted rewards + max retroactive
                            // multipliers.
                            await setTime(programEndTime);

                            reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.bignumber.equal(
                                getExpectedRewards(provider, now.sub(prevNow), duration.weeks(4))
                            );

                            amount = reward.div(new BN(2));
                            while (reward.gt(new BN(0))) {
                                amount = BN.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }
                        });

                        it('should not allow staking more than the claimable rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.bignumber.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            const amount = reward.mul(new BN(10000));
                            const data = await staking.stakeRewards.call(amount, poolToken4.address, {
                                from: provider
                            });
                            expect(data[0]).to.be.bignumber.equal(reward);

                            expectEvent(
                                await staking.stakeRewards(amount, poolToken4.address, { from: provider }),
                                'RewardsStaked',
                                {
                                    provider,
                                    poolToken: poolToken4.address,
                                    amount: reward,
                                    newId: data[1]
                                }
                            );

                            const position = await getPosition(provider, data[1]);
                            expect(position.poolToken).to.equal(poolToken4.address);
                            expect(position.reserveToken).to.equal(networkToken.address);
                            expect(position.reserveAmount).to.be.bignumber.equal(reward);

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));
                        });

                        it('should allow staking, removal, and then claiming of the rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const reward = await staking.pendingRewards(provider);
                            expect(reward).to.be.bignumber.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            const amount = reward.div(new BN(2));
                            const data = await staking.stakeRewards.call(amount, poolToken4.address, {
                                from: provider
                            });
                            expect(data[0]).to.be.bignumber.equal(amount);

                            // Stake some of the rewards.
                            await staking.stakeRewards(amount, poolToken4.address, { from: provider });

                            let remainingReward = await staking.pendingRewards(provider);
                            if (remainingReward.eq(new BN(0))) {
                                expect(remainingReward).to.be.bignumber.closeTo(reward.sub(amount), new BN(1));
                            } else {
                                expectAlmostEqual(remainingReward, reward.sub(amount));
                            }

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(provider);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));

                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(prevBalance);

                            // The removal shouldn't affect the pending rewards.
                            expectAlmostEqual(await staking.pendingRewards(provider), remainingReward);
                            remainingReward = await staking.pendingRewards(provider);

                            // Claim all the rewards.
                            const claimed = await staking.claimRewards.call({ from: provider });
                            expect(claimed).to.be.bignumber.equal(remainingReward);

                            const prevBalance2 = await networkToken.balanceOf(provider);
                            const prevTotalProviderClaimed = await staking.totalClaimedRewards(provider);

                            await staking.claimRewards({ from: provider });

                            expect(await networkToken.balanceOf(provider)).to.be.bignumber.equal(
                                prevBalance2.add(remainingReward)
                            );
                            expect(await staking.totalClaimedRewards(provider)).to.be.bignumber.equal(
                                prevTotalProviderClaimed.add(remainingReward)
                            );

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));
                        });

                        it('should partially stake reserve specific rewards', async () => {
                            // Should partially claim rewards for the duration of 5 hours.
                            await setTime(now.add(duration.hours(5)));

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    provider,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.be.bignumber.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow)
                                    )
                                );

                                let amount = reward.div(new BN(2));
                                while (reward.gt(new BN(0))) {
                                    amount = BN.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }

                                expect(
                                    await staking.pendingReserveRewards(provider, poolToken.address, token.address)
                                ).to.be.bignumber.equal(new BN(0));
                            }

                            await setTime(programStartTime.add(duration.days(1)));

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    provider,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.be.bignumber.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow)
                                    )
                                );

                                let amount = reward.div(new BN(2));
                                while (reward.gt(new BN(0))) {
                                    amount = BN.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }

                                expect(
                                    await staking.pendingReserveRewards(provider, poolToken.address, token.address)
                                ).to.be.bignumber.equal(new BN(0));
                            }

                            // Should return all weekly rewards, excluding previously granted rewards, but without the
                            // multiplier bonus.
                            await setTime(now.add(duration.weeks(1)));
                            await staking.claimRewards({ from: provider });

                            // Should return all the rewards for the two weeks, excluding previously granted rewards
                            await setTime(now.add(duration.weeks(2)));

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    provider,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.be.bignumber.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow),
                                        duration.weeks(2)
                                    )
                                );

                                let amount = reward.div(new BN(2));
                                while (reward.gt(new BN(0))) {
                                    amount = BN.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }

                                expect(
                                    await staking.pendingReserveRewards(provider, poolToken.address, token.address)
                                ).to.be.bignumber.equal(new BN(0));
                            }

                            // Should return all program rewards, excluding previously granted rewards + max retroactive
                            // multipliers.
                            await setTime(programEndTime);

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    provider,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.be.bignumber.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow),
                                        duration.weeks(4)
                                    )
                                );

                                let amount = reward.div(new BN(2));
                                while (reward.gt(new BN(0))) {
                                    amount = BN.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }
                            }
                        });

                        it('should not allow staking more than the reserve specific claimable rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            for (const token of [networkToken, reserveToken]) {
                                const reward = await staking.pendingReserveRewards(
                                    provider,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.be.bignumber.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow)
                                    )
                                );
                                if (reward.eq(new BN(0))) {
                                    continue;
                                }

                                const amount = reward.mul(new BN(10000));
                                const data = await staking.stakeReserveRewards.call(
                                    poolToken.address,
                                    token.address,
                                    amount,
                                    poolToken4.address,
                                    { from: provider }
                                );
                                const staked = data[0];
                                const newId = data[1];
                                expect(staked).to.be.bignumber.equal(reward);

                                expectEvent(
                                    await staking.stakeReserveRewards(
                                        poolToken.address,
                                        token.address,
                                        amount,
                                        poolToken4.address,
                                        { from: provider }
                                    ),
                                    'RewardsStaked',
                                    { provider, poolToken: poolToken4.address, amount: reward, newId }
                                );

                                const position = await getPosition(provider, newId);
                                expect(position.poolToken).to.equal(poolToken4.address);
                                expect(position.reserveToken).to.equal(networkToken.address);
                                expect(position.reserveAmount).to.be.bignumber.equal(reward);

                                expect(
                                    await staking.pendingReserveRewards(provider, poolToken.address, token.address)
                                ).to.be.bignumber.equal(new BN(0));
                            }
                        });
                    });
                });
            }

            describe('storing pool rewards', () => {
                it('should revert when a non-updater attempts store pool rewards', async () => {
                    await expect(staking.storePoolRewards(providers, poolToken.address), 'ERR_ACCESS_DENIED');
                });

                context('updater', () => {
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
                            expect(providerRewards.rewardPerToken).to.be.bignumber.equal(new BN(0));
                            expect(providerRewards.pendingBaseRewards).to.be.bignumber.equal(new BN(0));
                            expect(providerRewards.totalClaimedRewards).to.be.bignumber.equal(new BN(0));
                            expect(providerRewards.effectiveStakingTime).to.be.bignumber.equal(new BN(0));
                            expect(providerRewards.baseRewardsDebt).to.be.bignumber.equal(new BN(0));
                            expect(providerRewards.baseRewardsDebtMultiplier).to.be.bignumber.equal(new BN(0));
                        }
                    });
                });
            });
        };

        context('single pool', () => {
            beforeEach(async () => {
                programStartTime = now.add(duration.weeks(1));
                programEndTime = programStartTime.add(REWARDS_DURATION);

                await setTime(programStartTime);

                await addPoolProgram(poolToken, reserveToken, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                await addLiquidity(
                    providers[0],
                    poolToken,
                    reserveToken,
                    new BN(10000000).mul(new BN(10).pow(new BN(18)))
                );
            });

            context('single sided staking', () => {
                context('single provider', () => {
                    tests([0]);
                });

                context('multiple providers', () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            new BN(222222).mul(new BN(10).pow(new BN(18)))
                        );
                    });

                    tests([0, 1]);
                });
            });

            context('double sided staking', () => {
                beforeEach(async () => {
                    await addLiquidity(
                        providers[0],
                        poolToken,
                        networkToken,
                        new BN(10000000).mul(new BN(10).pow(new BN(18)))
                    );
                });

                context('single provider', () => {
                    tests([0]);
                });

                context('multiple providers', () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            new BN(2222222).mul(new BN(10).pow(new BN(18)))
                        );

                        await addLiquidity(
                            providers[1],
                            poolToken,
                            networkToken,
                            new BN(11000092).mul(new BN(10).pow(new BN(18)))
                        );
                    });

                    tests([0, 1]);
                });
            });
        });

        context('multiple pools', () => {
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
                    new BN(605564).mul(new BN(10).pow(new BN(18)))
                );
                await addLiquidity(
                    providers[0],
                    poolToken2,
                    reserveToken2,
                    new BN(11111111110).mul(new BN(10).pow(new BN(18)))
                );
                await addLiquidity(
                    providers[0],
                    poolToken3,
                    reserveToken3,
                    new BN(33333333330).mul(new BN(10).pow(new BN(18)))
                );
            });

            context('single sided staking', () => {
                context('single provider', () => {
                    tests([0]);
                });

                context('multiple providers', () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            new BN(666666).mul(new BN(10).pow(new BN(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken2,
                            reserveToken2,
                            new BN(88888888).mul(new BN(10).pow(new BN(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken3,
                            reserveToken3,
                            new BN(1111234).mul(new BN(10).pow(new BN(18)))
                        );
                    });

                    tests([0, 1]);
                });
            });

            context('double sided staking', () => {
                beforeEach(async () => {
                    await addLiquidity(
                        providers[0],
                        poolToken,
                        networkToken,
                        new BN(1000000).mul(new BN(10).pow(new BN(18)))
                    );
                    await addLiquidity(
                        providers[0],
                        poolToken2,
                        networkToken,
                        new BN(8888888).mul(new BN(10).pow(new BN(18)))
                    );
                    await addLiquidity(
                        providers[0],
                        poolToken3,
                        networkToken,
                        new BN(50000).mul(new BN(10).pow(new BN(18)))
                    );
                });

                context('single provider', () => {
                    tests([0]);
                });

                context('multiple providers', () => {
                    beforeEach(async () => {
                        await addLiquidity(
                            providers[1],
                            poolToken,
                            reserveToken,
                            new BN(2342323432).mul(new BN(10).pow(new BN(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken2,
                            reserveToken2,
                            new BN(322222222222).mul(new BN(10).pow(new BN(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken3,
                            reserveToken3,
                            new BN(11100008).mul(new BN(10).pow(new BN(18)))
                        );

                        await addLiquidity(
                            providers[1],
                            poolToken,
                            networkToken,
                            new BN(7777700).mul(new BN(10).pow(new BN(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken2,
                            networkToken,
                            new BN(234324).mul(new BN(10).pow(new BN(18)))
                        );
                        await addLiquidity(
                            providers[1],
                            poolToken3,
                            networkToken,
                            new BN(100).mul(new BN(10).pow(new BN(18)))
                        );
                    });

                    tests([0, 1]);
                });
            });
        });

        context('existing positions', () => {
            let provider;

            before(async () => {
                provider = accounts[1];
            });

            beforeEach(async () => {
                programStartTime = now.add(duration.years(1));
                programEndTime = programStartTime.add(REWARDS_DURATION);

                expect(await store.isReserveParticipating(poolToken3.address, networkToken.address)).to.be.false();
                expect(await store.isReserveParticipating(poolToken3.address, reserveToken.address)).to.be.false();
            });

            for (const timeDiff of [duration.days(1), duration.weeks(1), duration.weeks(6)]) {
                context(
                    `staking ${humanizeDuration(timeDiff.mul(new BN(1000)).toString(), {
                        units: ['d']
                    })} before the start of the program`,
                    () => {
                        beforeEach(async () => {
                            await setTime(programStartTime.sub(timeDiff));

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));
                        });

                        it('should only take into account staking duration after the start of the program', async () => {
                            await addLiquidity(
                                provider,
                                poolToken3,
                                reserveToken3,
                                new BN(11100008).mul(new BN(10).pow(new BN(18)))
                            );
                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));

                            await setTime(programStartTime);
                            await addPoolProgram(poolToken3, reserveToken3, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));

                            await setTime(now.add(duration.days(5)));
                            await testRewards(provider);

                            await setTime(now.add(duration.weeks(1)));
                            await testRewards(provider, duration.weeks(1));
                        });
                    }
                );

                context(
                    `staking ${humanizeDuration(timeDiff.mul(new BN(1000)).toString(), {
                        units: ['d']
                    })} after the start of the program`,
                    () => {
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
                                new BN(99999999).mul(new BN(10).pow(new BN(18)))
                            );

                            expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(new BN(0));

                            let stakingTime = new BN(0);
                            for (const stakingDuration of [duration.days(5), duration.weeks(1), duration.weeks(4)]) {
                                stakingTime = stakingTime.add(stakingDuration);

                                await setTime(now.add(stakingDuration));
                                expect(await staking.pendingRewards(provider)).to.be.bignumber.equal(
                                    getExpectedRewards(provider, stakingTime)
                                );
                            }
                        });
                    }
                );
            }
        });
    });
});
