const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { Decimal } = require('../helpers/MathUtils');
const humanizeDuration = require('humanize-duration');
const { set } = require('lodash');

const Constants = require('../helpers/Constants');
const Contracts = require('../../components/Contracts').default;

const { duration, latest } = require('../helpers/Time');

const { ZERO_ADDRESS } = require('../helpers/Constants');
const { CONVERTER_FACTORY, CONVERTER_REGISTRY, CONVERTER_REGISTRY_DATA, LIQUIDITY_PROTECTION } = Constants.registry;
const { ROLE_SUPERVISOR, ROLE_OWNER, ROLE_MANAGER, ROLE_GOVERNOR, ROLE_MINTER, ROLE_PUBLISHER, ROLE_UPDATER } =
    Constants.roles;

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
        const { address: providerAddress } = provider;

        const data = await store.providerRewards(
            providerAddress,
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

        await liquidityProtectionSettings.addPoolToWhitelist(poolTokenAddress);
        await liquidityProtectionSettings.setNetworkTokenMintingLimit(poolTokenAddress, TOTAL_SUPPLY);

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

        reserveToken = await Contracts.TestStandardToken.deploy('RSV1', 'RSV1', TOTAL_SUPPLY);
        reserveToken2 = await Contracts.TestStandardToken.deploy('RSV2', 'RSV2', TOTAL_SUPPLY);
        reserveToken3 = await Contracts.TestStandardToken.deploy('RSV3', 'RSV3', TOTAL_SUPPLY);

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

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            const newStaking = await Contracts.TestStakingRewards.deploy(
                store.address,
                networkTokenGovernance.address,
                checkpointStore.address,
                contractRegistry.address
            );

            expect(await newStaking.getRoleMemberCount(ROLE_SUPERVISOR)).to.equal(BigNumber.from(1));
            expect(await newStaking.getRoleMemberCount(ROLE_PUBLISHER)).to.equal(BigNumber.from(0));
            expect(await newStaking.getRoleMemberCount(ROLE_UPDATER)).to.equal(BigNumber.from(0));

            expect(await newStaking.getRoleAdmin(ROLE_SUPERVISOR)).to.equal(ROLE_SUPERVISOR);
            expect(await newStaking.getRoleAdmin(ROLE_PUBLISHER)).to.equal(ROLE_SUPERVISOR);
            expect(await newStaking.getRoleAdmin(ROLE_UPDATER)).to.equal(ROLE_SUPERVISOR);

            expect(await newStaking.hasRole(ROLE_SUPERVISOR, supervisor.address)).to.be.true;
            expect(await newStaking.hasRole(ROLE_PUBLISHER, supervisor.address)).to.be.false;
            expect(await newStaking.hasRole(ROLE_UPDATER, supervisor.address)).to.be.false;
        });

        it('should initialize the state', async () => {
            expect(await staking.store()).to.equal(store.address);
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

    describe('notifications', () => {
        const id = BigNumber.from(123);
        let provider;
        let providerAddress;
        let liquidityProtectionProxy;
        let nonLiquidityProtection;

        before(async () => {
            provider = accounts[1];
            ({ address: providerAddress } = provider);

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
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            await expect(
                staking
                    .connect(nonLiquidityProtection)
                    .onAddingLiquidity(providerAddress, poolTokenAddress, reserveTokenAddress, 0, 0)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');

            await expect(
                staking
                    .connect(nonLiquidityProtection)
                    .onRemovingLiquidity(id, providerAddress, poolTokenAddress, reserveTokenAddress, 0, 0)
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when notifying for a zero provider ', async () => {
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            await expect(
                staking
                    .connect(liquidityProtectionProxy)
                    .onAddingLiquidity(ZERO_ADDRESS, poolTokenAddress, reserveTokenAddress, 0, 0)
            ).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');

            await expect(
                staking
                    .connect(liquidityProtectionProxy)
                    .onRemovingLiquidity(id, ZERO_ADDRESS, poolTokenAddress, reserveTokenAddress, 0, 0)
            ).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');
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

                set(totalReserveAmounts, [poolTokenAddress, reserveTokenAddress], BigNumber.from(0));
                set(totalReserveAmounts, [poolTokenAddress, networkToken.address], BigNumber.from(0));

                set(programs, [poolTokenAddress, reserveTokenAddress], BigNumber.from(0));
                set(programs, [poolTokenAddress, networkToken.address], BigNumber.from(0));

                for (const provider of accounts) {
                    const { address: providerAddress } = provider;

                    set(positions, [providerAddress, poolTokenAddress, reserveTokenAddress], []);
                    set(positions, [providerAddress, poolTokenAddress, networkToken.address], []);

                    providerPools[providerAddress] = {};

                    set(reserveAmounts, [providerAddress, poolTokenAddress, reserveTokenAddress], BigNumber.from(0));
                    set(reserveAmounts, [providerAddress, poolTokenAddress, networkToken.address], BigNumber.from(0));
                }
            }
        });

        const addTestLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            const { address: providerAddress } = provider;
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            if (!providerPools[providerAddress][poolTokenAddress]) {
                providerPools[providerAddress][poolTokenAddress] = [];
            }

            const reserveTokens = providerPools[providerAddress][poolTokenAddress];
            if (!reserveTokens.includes(reserveTokenAddress)) {
                reserveTokens.push(reserveTokenAddress);
            }

            reserveAmounts[providerAddress][poolTokenAddress][reserveTokenAddress] =
                reserveAmounts[providerAddress][poolTokenAddress][reserveTokenAddress].add(reserveAmount);

            totalReserveAmounts[poolTokenAddress][reserveTokenAddress] =
                totalReserveAmounts[poolTokenAddress][reserveTokenAddress].add(reserveAmount);
        };

        const addLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            addTestLiquidity(provider, poolToken, reserveToken, reserveAmount);

            const { address: providerAddress } = provider;
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            if (reserveTokenAddress !== networkToken.address) {
                await reserveToken.transfer(providerAddress, reserveAmount);
            } else {
                await networkTokenGovernance.mint(providerAddress, reserveAmount);
            }
            await reserveToken.connect(provider).approve(liquidityProtection.address, reserveAmount);

            await liquidityProtection
                .connect(provider)
                .addLiquidity(poolTokenAddress, reserveTokenAddress, reserveAmount);

            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(providerAddress);
            const protectionId = protectionIds[0];
            positions[providerAddress][poolTokenAddress][reserveTokenAddress].push(protectionId);
        };

        const removeTestLiquidity = async (provider, poolToken, reserveToken, reserveAmount) => {
            const { address: providerAddress } = provider;
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            expect(reserveAmounts[providerAddress][poolTokenAddress][reserveTokenAddress]).to.be.gte(reserveAmount);

            expect(totalReserveAmounts[poolTokenAddress][reserveTokenAddress]).to.be.gte(reserveAmount);

            reserveAmounts[providerAddress][poolTokenAddress][reserveTokenAddress] =
                reserveAmounts[providerAddress][poolTokenAddress][reserveTokenAddress].sub(reserveAmount);

            totalReserveAmounts[poolTokenAddress][reserveTokenAddress] =
                totalReserveAmounts[poolTokenAddress][reserveTokenAddress].sub(reserveAmount);

            if (reserveAmounts[providerAddress][poolTokenAddress][reserveTokenAddress].eq(BigNumber.from(0))) {
                providerPools[providerAddress][poolTokenAddress].splice(
                    providerPools[providerAddress][poolTokenAddress].indexOf(reserveTokenAddress),
                    1
                );

                let reserveToken2;
                let reserveAmount2;
                if (providerPools[providerAddress][poolTokenAddress].length > 0) {
                    reserveToken2 = providerPools[providerAddress][poolTokenAddress][0];
                    reserveAmount2 = reserveAmounts[providerAddress][poolTokenAddress][reserveToken2.address];
                }

                if (!reserveToken2 || !reserveAmount2 || reserveAmount2.eq(BigNumber.from(0))) {
                    providerPools[providerAddress].poolTokens = [];
                }
            }
        };

        const removeLiquidity = async (provider, poolToken, reserveToken, portion) => {
            const { address: providerAddress } = provider;
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            const id = positions[providerAddress][poolTokenAddress][reserveTokenAddress][0];
            const position = await getPosition(provider, id);

            let reserveAmount;
            if (portion.eq(PPM_RESOLUTION)) {
                reserveAmount = position.reserveAmount;
            } else {
                reserveAmount = position.reserveAmount.mul(portion).div(PPM_RESOLUTION);
            }

            await liquidityProtection.connect(provider).removeLiquidity(id, portion);

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

            const { address: providerAddress } = provider;
            expect(providerAddress).to.equal(position[0]);

            return {
                provider: providerAddress,
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
            let reward = BigNumber.from(0);
            if (duration.lte(BigNumber.from(0))) {
                return reward;
            }

            const { address: providerAddress } = provider;

            for (const poolToken in providerPools[providerAddress]) {
                reward = reward.add(getExpectedPoolRewards(provider, poolToken, duration, multiplierDuration));
            }

            return reward;
        };

        const getExpectedPoolRewards = (provider, poolToken, duration, multiplierDuration = undefined) => {
            let reward = BigNumber.from(0);
            if (duration.lte(BigNumber.from(0))) {
                return reward;
            }

            const { address: providerAddress } = provider;
            const reserveTokens = providerPools[providerAddress][poolToken];

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

            const { address: providerAddress } = provider;

            return reserveAmounts[providerAddress][poolToken][reserveToken]
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
            const { address: providerAddress } = provider;

            const reward = await staking.pendingRewards(providerAddress);

            const effectiveTime = BigNumber.min(now, programEndTime);
            const expectedReward = getExpectedRewards(
                provider,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(providerAddress);
            expect(totalProviderClaimedRewards).to.equal(BigNumber.from(0));
        };

        const testPoolRewards = async (provider, poolToken, multiplierDuration = undefined) => {
            const { address: providerAddress } = provider;
            const { address: poolTokenAddress } = poolToken;

            const reward = await staking.pendingPoolRewards(providerAddress, poolTokenAddress);

            const effectiveTime = BigNumber.min(now, programEndTime);
            const expectedReward = getExpectedPoolRewards(
                provider,
                poolTokenAddress,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(providerAddress);
            expect(totalProviderClaimedRewards).to.equal(BigNumber.from(0));
        };

        const testReserveRewards = async (provider, poolToken, reserveToken, multiplierDuration = undefined) => {
            const { address: providerAddress } = provider;
            const { address: poolTokenAddress } = poolToken;
            const { address: reserveTokenAddress } = reserveToken;

            const reward = await staking.pendingReserveRewards(providerAddress, poolTokenAddress, reserveTokenAddress);

            const effectiveTime = BigNumber.min(now, programEndTime);
            const expectedReward = getExpectedReserveRewards(
                provider,
                poolTokenAddress,
                reserveTokenAddress,
                effectiveTime.sub(programStartTime),
                multiplierDuration
            );

            expect(reward).to.equal(expectedReward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(providerAddress);
            expect(totalProviderClaimedRewards).to.equal(BigNumber.from(0));
        };

        const testPartialRewards = async (provider, prevReward, multiplierDuration = undefined) => {
            const { address: providerAddress } = provider;

            const reward = await staking.pendingRewards(providerAddress);

            const effectiveTime = BigNumber.min(now, programEndTime);
            const extraReward = getExpectedRewards(provider, effectiveTime.sub(prevNow), multiplierDuration);
            const multiplier = getRewardsMultiplier(multiplierDuration || effectiveTime.sub(programStartTime));

            expectAlmostEqual(prevReward.mul(multiplier).div(PPM_RESOLUTION).add(extraReward), reward);

            const totalProviderClaimedRewards = await staking.totalClaimedRewards(providerAddress);
            expect(totalProviderClaimedRewards).to.equal(BigNumber.from(0));
        };

        const testClaim = async (provider, multiplierDuration = undefined) => {
            const { address: providerAddress } = provider;

            const reward = await staking.pendingRewards(providerAddress);

            const effectiveTime = BigNumber.min(now, programEndTime);
            const expectedReward = getExpectedRewards(provider, effectiveTime.sub(prevNow), multiplierDuration);

            expect(reward).to.equal(expectedReward);

            const claimed = await staking.connect(provider).callStatic.claimRewards();
            expect(claimed).to.equal(reward);

            const prevBalance = await networkToken.balanceOf(providerAddress);
            const prevTotalProviderClaimed = await staking.totalClaimedRewards(providerAddress);

            const tx = await staking.connect(provider).claimRewards();
            if (claimed.gt(BigNumber.from(0))) {
                await expect(tx).to.emit(staking, 'RewardsClaimed').withArgs(providerAddress, claimed);
            }

            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance.add(reward));
            expect(await staking.totalClaimedRewards(providerAddress)).to.equal(prevTotalProviderClaimed.add(reward));

            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));
        };

        const testStorePoolRewards = async (providers, poolToken) => {
            const pendingRewards = {};
            const effectiveStakingTimes = {};

            const { address: poolTokenAddress } = poolToken;

            for (const provider of providers) {
                const { address: providerAddress } = provider;

                for (const reserveTokenAddress of providerPools[providerAddress][poolTokenAddress] || []) {
                    set(
                        pendingRewards,
                        [providerAddress, poolTokenAddress, reserveTokenAddress],
                        await staking.pendingReserveRewards(providerAddress, poolTokenAddress, reserveTokenAddress)
                    );

                    const providerRewards = await getProviderRewards(provider, poolTokenAddress, reserveTokenAddress);

                    set(
                        effectiveStakingTimes,
                        [providerAddress, poolTokenAddress, reserveTokenAddress],
                        providerRewards.effectiveStakingTime
                    );
                }
            }

            await staking.connect(updater).storePoolRewards(
                providers.map((provider) => provider.address),
                poolTokenAddress
            );

            for (const provider of providers) {
                const { address: providerAddress } = provider;

                for (const reserveTokenAddress of providerPools[providerAddress][poolTokenAddress] || []) {
                    const providerRewards = await getProviderRewards(provider, poolTokenAddress, reserveTokenAddress);

                    const multiplier = await staking.rewardsMultiplier(
                        providerAddress,
                        poolTokenAddress,
                        reserveTokenAddress
                    );

                    expectAlmostEqual(
                        providerRewards.baseRewardsDebt
                            .mul(providerRewards.baseRewardsDebtMultiplier)
                            .mul(multiplier)
                            .div(PPM_RESOLUTION)
                            .div(PPM_RESOLUTION),
                        pendingRewards[providerAddress][poolTokenAddress][reserveTokenAddress]
                    );

                    expectAlmostEqual(
                        await staking.pendingReserveRewards(providerAddress, poolTokenAddress, reserveTokenAddress),
                        pendingRewards[providerAddress][poolTokenAddress][reserveTokenAddress]
                    );

                    expect(providerRewards.effectiveStakingTime).to.equal(
                        effectiveStakingTimes[providerAddress][poolTokenAddress][reserveTokenAddress]
                    );
                }
            }
        };

        const testStaking = async (provider, amount, newPoolToken, participating = false) => {
            const { address: providerAddress } = provider;
            const { address: newPoolTokenAddress } = newPoolToken;

            const reward = await staking.pendingRewards(providerAddress);

            const data = await staking.connect(provider).callStatic.stakeRewards(amount, newPoolTokenAddress);
            expect(data[0]).to.equal(amount);

            const prevTotalProviderClaimed = await staking.totalClaimedRewards(providerAddress);

            await expect(staking.connect(provider).stakeRewards(amount, newPoolTokenAddress))
                .to.emit(staking, 'RewardsStaked')
                .withArgs(providerAddress, newPoolTokenAddress, amount, data[1]);

            // If we're staking to a participating pool, don't forget to update the local liquidity state for staking.
            if (participating) {
                addTestLiquidity(provider, newPoolToken, networkToken, amount);
            }

            expect(await staking.totalClaimedRewards(providerAddress)).to.equal(prevTotalProviderClaimed.add(data[0]));

            const position = await getPosition(provider, data[1]);
            expect(position.poolToken).to.equal(newPoolTokenAddress);
            expect(position.reserveToken).to.equal(networkToken.address);
            expect(position.reserveAmount).to.equal(amount);

            const newReward = await staking.pendingRewards(providerAddress);

            // take into account that there might be very small imprecisions when dealing with
            // multipliers
            if (newReward.eq(BigNumber.from(0))) {
                expect(newReward).to.be.closeTo(reward.sub(amount), BigNumber.from(1));
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
            const { address: providerAddress } = provider;
            const { address: newPoolTokenAddress } = newPoolToken;

            const reward = await staking.pendingRewards(providerAddress);
            const poolReward = await staking.pendingPoolRewards(providerAddress, poolTokenAddress);
            const reserveReward = await staking.pendingReserveRewards(
                providerAddress,
                poolTokenAddress,
                reserveTokenAddress
            );

            const data = await staking
                .connect(provider)
                .callStatic.stakeReserveRewards(poolTokenAddress, reserveTokenAddress, amount, newPoolTokenAddress);
            const staked = data[0];
            const newId = data[1];

            const prevTotalProviderClaimed = await staking.totalClaimedRewards(providerAddress);
            await expect(
                staking
                    .connect(provider)
                    .stakeReserveRewards(poolTokenAddress, reserveTokenAddress, amount, newPoolTokenAddress)
            )
                .to.emit(staking, 'RewardsStaked')
                .withArgs(providerAddress, newPoolTokenAddress, amount, newId);

            // If we're staking to a participating pool, don't forget to update the local liquidity state for staking.
            if (participating) {
                addTestLiquidity(provider, newPoolToken, networkToken, amount);
            }

            expect(await staking.totalClaimedRewards(providerAddress)).to.equal(prevTotalProviderClaimed.add(staked));

            const position = await getPosition(provider, newId);
            expect(position.poolToken).to.equal(newPoolTokenAddress);
            expect(position.reserveToken).to.equal(networkToken.address);
            expect(position.reserveAmount).to.equal(amount);

            const newReserveReward = await staking.pendingReserveRewards(
                providerAddress,
                poolTokenAddress,
                reserveTokenAddress
            );

            // Take into account that there might be very small imprecisions when dealing with multipliers
            if (newReserveReward.eq(BigNumber.from(0))) {
                expect(newReserveReward).to.be.closeTo(reserveReward.sub(amount), BigNumber.from(1));
            } else {
                expectAlmostEqual(newReserveReward, reserveReward.sub(amount));
            }

            const diff = reserveReward.sub(newReserveReward);
            expect(await staking.pendingRewards(providerAddress)).to.equal(reward.sub(diff));
            expect(await staking.pendingPoolRewards(providerAddress, poolTokenAddress)).to.equal(poolReward.sub(diff));

            return newReserveReward;
        };

        const tests = (providersIndices = []) => {
            for (let i = 0; i < providersIndices.length; ++i) {
                context(`provider #${providersIndices[i]}`, () => {
                    let provider;
                    let providerAddress;

                    beforeEach(async () => {
                        provider = providers[providersIndices[i]];

                        ({ address: providerAddress } = provider);
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
                                BigNumber.from(1).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            // Should return the correct multiplier for a duration of one second.
                            let actualMultiplier;
                            let expectedMultiplier;
                            let stakingDuration = duration.seconds(1);
                            await setTime(now.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                providerAddress,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.equal(expectedMultiplier);

                            // Should return the correct multiplier for a duration of a single day after program start.
                            stakingDuration = duration.days(1);
                            await setTime(programStartTime.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                providerAddress,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.equal(expectedMultiplier);

                            // Should return the correct multiplier for a duration of a single week after program start.
                            stakingDuration = duration.weeks(1);
                            await setTime(programStartTime.add(stakingDuration));
                            actualMultiplier = await staking.rewardsMultiplier(
                                providerAddress,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.equal(expectedMultiplier);

                            // Should return full multiplier for a duration of at least 4 weeks after program start.
                            stakingDuration = duration.weeks(4);
                            await setTime(programEndTime);
                            actualMultiplier = await staking.rewardsMultiplier(
                                providerAddress,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.equal(expectedMultiplier);

                            // Should keep the current multiplier after staking
                            const reward = await staking.pendingRewards(providerAddress);
                            const amount = reward.div(BigNumber.from(10));
                            await testStaking(provider, amount, poolToken, true);
                            actualMultiplier = await staking.rewardsMultiplier(
                                providerAddress,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expect(actualMultiplier).to.equal(expectedMultiplier);

                            // Should return full multiplier after the ending time of the program.
                            stakingDuration = duration.weeks(4);
                            await setTime(programEndTime.add(duration.days(1)));
                            actualMultiplier = await staking.rewardsMultiplier(
                                providerAddress,
                                poolTokenAddress,
                                networkTokenAddress
                            );
                            expectedMultiplier = getRewardsMultiplier(stakingDuration);
                            expect(actualMultiplier).to.equal(expectedMultiplier);
                        });

                        it('should not affect the rewards, when adding liquidity in the same block', async () => {
                            const provider3 = accounts[3];

                            await setTime(programStartTime.add(duration.weeks(5)));

                            const reward = await staking.pendingRewards(providerAddress);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            expectAlmostEqual(await staking.pendingRewards(providerAddress), reward);

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

                            expectAlmostEqual(await staking.pendingRewards(providerAddress), reward);

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

                            expectAlmostEqual(await staking.pendingRewards(providerAddress), reward);
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

                            const reward = await staking.pendingRewards(providerAddress);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(1));
                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(1));

                            expectAlmostEqual(await staking.pendingRewards(providerAddress), reward);

                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(30));

                            expectAlmostEqual(await staking.pendingRewards(providerAddress), reward);

                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(50));

                            expectAlmostEqual(await staking.pendingRewards(providerAddress), reward);
                        });

                        it('should properly calculate all rewards when adding liquidity', async () => {
                            const provider3 = accounts[3];

                            let prevReward = await staking.pendingRewards(providerAddress);

                            await addLiquidity(
                                provider,
                                poolToken,
                                reserveToken,
                                BigNumber.from(1000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(providerAddress);

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

                            prevReward = await staking.pendingRewards(providerAddress);

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

                            let prevReward = await staking.pendingRewards(providerAddress);

                            // Should return all rewards for the duration of one second.
                            await setTime(now.add(duration.seconds(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(providerAddress);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(50));

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(providerAddress);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(10));

                            await setTime(now.add(duration.days(1)));
                            await testPartialRewards(provider, prevReward);

                            prevReward = await staking.pendingRewards(providerAddress);

                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(30));

                            await removeLiquidity(provider3, poolToken, reserveToken, toPPM(25));

                            await setTime(now.add(duration.weeks(3)));
                            await testPartialRewards(provider, prevReward, duration.weeks(3));
                        });

                        it('should keep all rewards when removing liquidity', async () => {
                            // Should return all rewards for four weeks, with the four weeks multiplier bonus
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const unclaimed = await staking.pendingRewards(providerAddress);
                            expect(unclaimed).to.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(providerAddress);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));
                            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance);

                            // Should not affect the claimable amount.
                            let reward = await staking.pendingRewards(providerAddress);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(1)));

                            // Should retroactively apply the two weeks multiplier on the debt rewards.
                            const multiplier2 = getRewardsMultiplier(duration.weeks(1));
                            let bestMultiplier = BigNumber.max(debMultiplier, multiplier2);
                            reward = await staking.pendingRewards(providerAddress);

                            let expectedRewards = getExpectedRewards(provider, duration.weeks(1)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);

                            // Should retroactively apply the four weeks multiplier on the unclaimed rewards.
                            await setTime(now.add(duration.weeks(2)));

                            const multiplier3 = getRewardsMultiplier(duration.weeks(3));
                            bestMultiplier = BigNumber.max(multiplier2, multiplier3);
                            reward = await staking.pendingRewards(providerAddress);

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

                            const unclaimed = await staking.pendingRewards(providerAddress);
                            expect(unclaimed).to.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(providerAddress);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance);

                            // Should not affect the claimable amount.
                            let reward = await staking.pendingRewards(providerAddress);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(2)));

                            // Should retroactively apply the two weeks multiplier on the debt rewards.
                            const multiplier2 = getRewardsMultiplier(duration.weeks(2));
                            let bestMultiplier = BigNumber.max(debMultiplier, multiplier2);
                            reward = await staking.pendingRewards(providerAddress);

                            let expectedRewards = getExpectedRewards(provider, duration.weeks(2)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);

                            // Should retroactively apply the four weeks multiplier on the unclaimed rewards.
                            await setTime(now.add(duration.weeks(2)));

                            const multiplier3 = getRewardsMultiplier(duration.weeks(4));
                            bestMultiplier = BigNumber.max(multiplier2, multiplier3);
                            reward = await staking.pendingRewards(providerAddress);

                            expectedRewards = getExpectedRewards(provider, duration.weeks(4)).add(
                                debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                            );

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, expectedRewards);

                            // Remove all the remaining liquidity after two weeks.
                            await setTime(now.add(duration.weeks(2)));

                            const unclaimed2 = await staking.pendingRewards(providerAddress);
                            expectAlmostEqual(
                                unclaimed2,
                                getExpectedRewards(provider, duration.weeks(6)).add(
                                    debt.mul(bestMultiplier).div(PPM_RESOLUTION)
                                )
                            );

                            const debMultiplier2 = getRewardsMultiplier(duration.weeks(2));
                            const debt2 = unclaimed2.mul(PPM_RESOLUTION).div(debMultiplier2);

                            const prevBalance2 = await networkToken.balanceOf(providerAddress);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(50));
                            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance2);

                            // Should not affect the claimable amount.
                            reward = await staking.pendingRewards(providerAddress);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt2.mul(debMultiplier2).div(PPM_RESOLUTION));

                            await setTime(now.add(duration.weeks(1)));

                            // Should retroactively apply the one weeks multiplier on the debt rewards.
                            const multiplier4 = getRewardsMultiplier(duration.weeks(1));
                            bestMultiplier = BigNumber.max(debMultiplier2, multiplier4);
                            reward = await staking.pendingRewards(providerAddress);

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

                            const reward = await staking.pendingRewards(provider3.address);
                            expect(reward).to.equal(BigNumber.from(0));

                            const claimed = await staking.connect(provider3).callStatic.claimRewards();
                            expect(claimed).to.equal(reward);
                        });

                        it('should return no rewards for non-participating reserves', async () => {
                            const nonParticipatingPoolToken = accounts[8];
                            const { address: poolTokenAddress } = poolToken;
                            const { address: reserveTokenAddress } = reserveToken;

                            expect(
                                await staking.pendingReserveRewards(
                                    providerAddress,
                                    nonParticipatingPoolToken.address,
                                    reserveTokenAddress
                                )
                            ).to.equal(BigNumber.from(0));

                            expect(
                                await staking.pendingReserveRewards(providerAddress, ZERO_ADDRESS, reserveTokenAddress)
                            ).to.equal(BigNumber.from(0));

                            expect(
                                await staking.pendingReserveRewards(providerAddress, poolTokenAddress, ZERO_ADDRESS)
                            ).to.equal(BigNumber.from(0));
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

                            const unclaimed = await staking.pendingRewards(providerAddress);
                            expect(unclaimed).to.equal(getExpectedRewards(provider, duration.weeks(1)));
                            const debMultiplier = getRewardsMultiplier(duration.weeks(1));
                            const debt = unclaimed.mul(PPM_RESOLUTION).div(debMultiplier);

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(providerAddress);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));
                            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance);

                            // Should not affect the claimable amount.
                            const reward = await staking.pendingRewards(providerAddress);

                            // take into account that there might be very small imprecisions when dealing with
                            // multipliers.
                            expectAlmostEqual(reward, debt.mul(debMultiplier).div(PPM_RESOLUTION));

                            const claimed = await staking.connect(provider).callStatic.claimRewards();
                            expect(claimed).to.equal(reward);
                            const prevBalance2 = await networkToken.balanceOf(providerAddress);
                            const tx = await staking.connect(provider).claimRewards();
                            if (claimed.gt(BigNumber.from(0))) {
                                await expect(tx).to.emit(staking, 'RewardsClaimed').withArgs(providerAddress, claimed);
                            }
                            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance2.add(reward));

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));
                        });
                    });

                    describe('staking', () => {
                        let reserveToken4;
                        let poolToken4;

                        beforeEach(async () => {
                            reserveToken4 = await Contracts.TestStandardToken.deploy('RSV4', 'RSV4', TOTAL_SUPPLY);

                            poolToken4 = await createPoolToken(reserveToken4);

                            const reserveAmount = BigNumber.from(100000000).mul(
                                BigNumber.from(10).pow(BigNumber.from(18))
                            );

                            await reserveToken4.transfer(providerAddress, reserveAmount);
                            await reserveToken4.connect(provider).approve(liquidityProtection.address, reserveAmount);

                            await liquidityProtection
                                .connect(provider)
                                .addLiquidity(poolToken4.address, reserveToken4.address, reserveAmount);
                        });

                        it('should partially stake rewards', async () => {
                            // Should partially claim rewards for the duration of 5 hours.
                            await setTime(now.add(duration.hours(5)));

                            let reward = await staking.pendingRewards(providerAddress);
                            expect(reward).to.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            let amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = BigNumber.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));

                            // Should return all rewards for a single day, excluding previously granted rewards.
                            await setTime(programStartTime.add(duration.days(1)));

                            reward = await staking.pendingRewards(providerAddress);
                            expect(reward).to.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = BigNumber.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));

                            // Should return all weekly rewards, excluding previously granted rewards, but without the
                            // multiplier bonus.
                            await setTime(now.add(duration.weeks(1)));
                            await testClaim(provider);

                            // Should return all the rewards for the two weeks, excluding previously granted rewards
                            await setTime(now.add(duration.weeks(2)));

                            reward = await staking.pendingRewards(providerAddress);
                            expect(reward).to.equal(getExpectedRewards(provider, now.sub(prevNow), duration.weeks(2)));

                            amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = BigNumber.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }

                            // Should return all program rewards, excluding previously granted rewards + max retroactive
                            // multipliers.
                            await setTime(programEndTime);

                            reward = await staking.pendingRewards(providerAddress);
                            expect(reward).to.equal(getExpectedRewards(provider, now.sub(prevNow), duration.weeks(4)));

                            amount = reward.div(BigNumber.from(2));
                            while (reward.gt(BigNumber.from(0))) {
                                amount = BigNumber.min(amount, reward);

                                reward = await testStaking(provider, amount, poolToken4);
                            }
                        });

                        it('should not allow staking more than the claimable rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const reward = await staking.pendingRewards(providerAddress);
                            expect(reward).to.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            const amount = reward.mul(BigNumber.from(10000));
                            const data = await staking
                                .connect(provider)
                                .callStatic.stakeRewards(amount, poolToken4.address);
                            expect(data[0]).to.equal(reward);

                            await expect(staking.connect(provider).stakeRewards(amount, poolToken4.address))
                                .to.emit(staking, 'RewardsStaked')
                                .withArgs(providerAddress, poolToken4.address, reward, data[1]);

                            const position = await getPosition(provider, data[1]);
                            expect(position.poolToken).to.equal(poolToken4.address);
                            expect(position.reserveToken).to.equal(networkToken.address);
                            expect(position.reserveAmount).to.equal(reward);

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));
                        });

                        it('should allow staking, removal, and then claiming of the rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            const reward = await staking.pendingRewards(providerAddress);
                            expect(reward).to.equal(getExpectedRewards(provider, now.sub(prevNow)));

                            const amount = reward.div(BigNumber.from(2));
                            const data = await staking
                                .connect(provider)
                                .callStatic.stakeRewards(amount, poolToken4.address);
                            expect(data[0]).to.equal(amount);

                            // Stake some of the rewards.
                            await staking.connect(provider).stakeRewards(amount, poolToken4.address);

                            let remainingReward = await staking.pendingRewards(providerAddress);
                            if (remainingReward.eq(BigNumber.from(0))) {
                                expect(remainingReward).to.be.closeTo(reward.sub(amount), BigNumber.from(1));
                            } else {
                                expectAlmostEqual(remainingReward, reward.sub(amount));
                            }

                            // Remove all the liquidity.
                            const prevBalance = await networkToken.balanceOf(providerAddress);
                            await removeLiquidity(provider, poolToken, reserveToken, toPPM(100));

                            expect(await networkToken.balanceOf(providerAddress)).to.equal(prevBalance);

                            // The removal shouldn't affect the pending rewards.
                            expectAlmostEqual(await staking.pendingRewards(providerAddress), remainingReward);
                            remainingReward = await staking.pendingRewards(providerAddress);

                            // Claim all the rewards.
                            const claimed = await staking.connect(provider).callStatic.claimRewards();
                            expect(claimed).to.equal(remainingReward);

                            const prevBalance2 = await networkToken.balanceOf(providerAddress);
                            const prevTotalProviderClaimed = await staking.totalClaimedRewards(providerAddress);

                            await staking.connect(provider).claimRewards();

                            expect(await networkToken.balanceOf(providerAddress)).to.equal(
                                prevBalance2.add(remainingReward)
                            );
                            expect(await staking.totalClaimedRewards(providerAddress)).to.equal(
                                prevTotalProviderClaimed.add(remainingReward)
                            );

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));
                        });

                        it('should partially stake reserve specific rewards', async () => {
                            // Should partially claim rewards for the duration of 5 hours.
                            await setTime(now.add(duration.hours(5)));

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    providerAddress,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow)
                                    )
                                );

                                let amount = reward.div(BigNumber.from(2));
                                while (reward.gt(BigNumber.from(0))) {
                                    amount = BigNumber.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }

                                expect(
                                    await staking.pendingReserveRewards(
                                        providerAddress,
                                        poolToken.address,
                                        token.address
                                    )
                                ).to.equal(BigNumber.from(0));
                            }

                            await setTime(programStartTime.add(duration.days(1)));

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    providerAddress,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow)
                                    )
                                );

                                let amount = reward.div(BigNumber.from(2));
                                while (reward.gt(BigNumber.from(0))) {
                                    amount = BigNumber.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }

                                expect(
                                    await staking.pendingReserveRewards(
                                        providerAddress,
                                        poolToken.address,
                                        token.address
                                    )
                                ).to.equal(BigNumber.from(0));
                            }

                            // Should return all weekly rewards, excluding previously granted rewards, but without the
                            // multiplier bonus.
                            await setTime(now.add(duration.weeks(1)));
                            await staking.connect(provider).claimRewards();

                            // Should return all the rewards for the two weeks, excluding previously granted rewards
                            await setTime(now.add(duration.weeks(2)));

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    providerAddress,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow),
                                        duration.weeks(2)
                                    )
                                );

                                let amount = reward.div(BigNumber.from(2));
                                while (reward.gt(BigNumber.from(0))) {
                                    amount = BigNumber.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }

                                expect(
                                    await staking.pendingReserveRewards(
                                        providerAddress,
                                        poolToken.address,
                                        token.address
                                    )
                                ).to.equal(BigNumber.from(0));
                            }

                            // Should return all program rewards, excluding previously granted rewards + max retroactive
                            // multipliers.
                            await setTime(programEndTime);

                            for (const token of [networkToken, reserveToken]) {
                                let reward = await staking.pendingReserveRewards(
                                    providerAddress,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow),
                                        duration.weeks(4)
                                    )
                                );

                                let amount = reward.div(BigNumber.from(2));
                                while (reward.gt(BigNumber.from(0))) {
                                    amount = BigNumber.min(amount, reward);

                                    reward = await testReserveStaking(provider, poolToken, token, amount, poolToken4);
                                }
                            }
                        });

                        it('should not allow staking more than the reserve specific claimable rewards', async () => {
                            await setTime(programStartTime.add(duration.weeks(1)));

                            for (const token of [networkToken, reserveToken]) {
                                const reward = await staking.pendingReserveRewards(
                                    providerAddress,
                                    poolToken.address,
                                    token.address
                                );
                                expect(reward).to.equal(
                                    getExpectedReserveRewards(
                                        provider,
                                        poolToken.address,
                                        token.address,
                                        now.sub(prevNow)
                                    )
                                );
                                if (reward.eq(BigNumber.from(0))) {
                                    continue;
                                }

                                const amount = reward.mul(BigNumber.from(10000));
                                const data = await staking
                                    .connect(provider)
                                    .callStatic.stakeReserveRewards(
                                        poolToken.address,
                                        token.address,
                                        amount,
                                        poolToken4.address
                                    );
                                const staked = data[0];
                                const newId = data[1];
                                expect(staked).to.equal(reward);

                                await expect(
                                    staking
                                        .connect(provider)
                                        .stakeReserveRewards(
                                            poolToken.address,
                                            token.address,
                                            amount,
                                            poolToken4.address
                                        )
                                )
                                    .to.emit(staking, 'RewardsStaked')
                                    .withArgs(providerAddress, poolToken4.address, reward, newId);

                                const position = await getPosition(provider, newId);
                                expect(position.poolToken).to.equal(poolToken4.address);
                                expect(position.reserveToken).to.equal(networkToken.address);
                                expect(position.reserveAmount).to.equal(reward);

                                expect(
                                    await staking.pendingReserveRewards(
                                        providerAddress,
                                        poolToken.address,
                                        token.address
                                    )
                                ).to.equal(BigNumber.from(0));
                            }
                        });
                    });
                });
            }

            describe('storing pool rewards', () => {
                it('should revert when a non-updater attempts store pool rewards', async () => {
                    await expect(
                        staking.storePoolRewards(
                            providers.map((p) => p.address),
                            poolToken.address
                        )
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
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
                        await staking.connect(updater).storePoolRewards(
                            providers.map((p) => p.address),
                            nonParticipatingPoolToken.address
                        );
                        for (const provider of providers) {
                            const providerRewards = await getProviderRewards(
                                provider,
                                nonParticipatingPoolToken,
                                ZERO_ADDRESS
                            );
                            expect(providerRewards.rewardPerToken).to.equal(BigNumber.from(0));
                            expect(providerRewards.pendingBaseRewards).to.equal(BigNumber.from(0));
                            expect(providerRewards.totalClaimedRewards).to.equal(BigNumber.from(0));
                            expect(providerRewards.effectiveStakingTime).to.equal(BigNumber.from(0));
                            expect(providerRewards.baseRewardsDebt).to.equal(BigNumber.from(0));
                            expect(providerRewards.baseRewardsDebtMultiplier).to.equal(BigNumber.from(0));
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
                    BigNumber.from(10000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
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
                            BigNumber.from(222222).mul(BigNumber.from(10).pow(BigNumber.from(18)))
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
                        BigNumber.from(10000000).mul(BigNumber.from(10).pow(BigNumber.from(18)))
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
                            BigNumber.from(2222222).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                        );

                        await addLiquidity(
                            providers[1],
                            poolToken,
                            networkToken,
                            BigNumber.from(11000092).mul(BigNumber.from(10).pow(BigNumber.from(18)))
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

                    tests([0, 1]);
                });
            });

            context('double sided staking', () => {
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

                context('single provider', () => {
                    tests([0]);
                });

                context('multiple providers', () => {
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

                    tests([0, 1]);
                });
            });
        });

        context('existing positions', () => {
            let provider;
            let providerAddress;

            before(async () => {
                provider = accounts[1];
                ({ address: providerAddress } = provider);
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
                    () => {
                        beforeEach(async () => {
                            await setTime(programStartTime.sub(timeDiff));

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));
                        });

                        it('should only take into account staking duration after the start of the program', async () => {
                            await addLiquidity(
                                provider,
                                poolToken3,
                                reserveToken3,
                                BigNumber.from(11100008).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );
                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));

                            await setTime(programStartTime);
                            await addPoolProgram(poolToken3, reserveToken3, programEndTime, BIG_POOL_BASE_REWARD_RATE);

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));

                            await setTime(now.add(duration.days(5)));
                            await testRewards(provider);

                            await setTime(now.add(duration.weeks(1)));
                            await testRewards(provider, duration.weeks(1));
                        });
                    }
                );

                context(
                    `staking ${humanizeDuration(timeDiff.mul(BigNumber.from(1000)).toString(), {
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
                                BigNumber.from(99999999).mul(BigNumber.from(10).pow(BigNumber.from(18)))
                            );

                            expect(await staking.pendingRewards(providerAddress)).to.equal(BigNumber.from(0));

                            let stakingTime = BigNumber.from(0);
                            for (const stakingDuration of [duration.days(5), duration.weeks(1), duration.weeks(4)]) {
                                stakingTime = stakingTime.add(stakingDuration);

                                await setTime(now.add(stakingDuration));
                                expect(await staking.pendingRewards(providerAddress)).to.equal(
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
