const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const Constants = require('../helpers/Constants');
const Contracts = require('../../components/Contracts').default;

const { ZERO_ADDRESS } = require('../helpers/Constants');
const { CONVERTER_FACTORY, CONVERTER_REGISTRY, CONVERTER_REGISTRY_DATA } = Constants.registry;
const { ROLE_SUPERVISOR, ROLE_OWNER, ROLE_MANAGER, ROLE_SEEDER } = Constants.roles;

const PPM_RESOLUTION = BigNumber.from(1000000);
const NETWORK_TOKEN_REWARDS_SHARE = BigNumber.from(700000); // 70%
const BASE_TOKEN_REWARDS_SHARE = BigNumber.from(300000); // 30%

const MAX_REWARD_RATE = BigNumber.from(2).pow(BigNumber.from(128)).sub(BigNumber.from(1));

const TOTAL_SUPPLY = BigNumber.from(10).pow(BigNumber.from(24));

const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_POOL_CONVERTER_WEIGHTS = [500_000, 500_000];

let now;
let converterRegistry;
let store;
let reserveToken;
let reserveToken2;
let networkToken;
let poolToken;
let poolToken2;

let supervisor;
let owner;
let nonOwner;
let manager;
let nonManager;
let accounts;

describe('StakingRewardsStore', () => {
    const setTime = async (time) => {
        now = time;

        for (const t of [store]) {
            if (t) {
                await t.setTime(now);
            }
        }
    };

    const getPoolProgram = async (poolToken) => {
        const data = await store.poolProgram(poolToken.address);

        return {
            startTime: data[0],
            endTime: data[1],
            rewardRate: data[2],
            reserveTokens: data[3],
            rewardShares: data[4]
        };
    };

    const getPoolPrograms = async () => {
        const data = await store.poolPrograms();

        const poolTokens = data[0];
        const startTimes = data[1];
        const endTimes = data[2];
        const rewardRates = data[3];
        const reserveTokens = data[4];
        const rewardShares = data[5];

        const programs = [];

        for (let i = 0; i < poolTokens.length; ++i) {
            programs.push({
                poolToken: poolTokens[i],
                startTime: startTimes[i],
                endTime: endTimes[i],
                rewardRate: rewardRates[i],
                reserveTokens: reserveTokens[i],
                rewardShares: rewardShares[i]
            });
        }

        return programs;
    };

    const getPoolRewards = async (poolToken, reserveToken) => {
        const data = await store.poolRewards(poolToken.address, reserveToken.address);

        return {
            lastUpdateTime: data[0],
            rewardPerToken: data[1],
            totalClaimedRewards: data[2]
        };
    };

    const getProviderRewards = async (provider, poolToken, reserveToken) => {
        const data = await store.providerRewards(provider.address, poolToken.address, reserveToken.address);

        return {
            rewardPerToken: data[0],
            pendingBaseRewards: data[1],
            totalClaimedRewards: data[2],
            effectiveStakingTime: data[3],
            baseRewardsDebt: data[4],
            baseRewardsDebtMultiplier: data[5]
        };
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

        const converterAddress = await converterRegistry.createdConverter();
        const converter = await Contracts.StandardPoolConverter.attach(converterAddress);
        await converter.acceptOwnership();

        return Contracts.TestStandardToken.attach(poolTokenAddress);
    };

    before(async () => {
        accounts = await ethers.getSigners();

        supervisor = accounts[0];
        owner = accounts[1];
        nonOwner = accounts[2];
        manager = accounts[3];
        nonManager = accounts[4];

        const contractRegistry = await Contracts.ContractRegistry.deploy();
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
        networkToken = await Contracts.TestStandardToken.deploy('TKN1', 'TKN1', TOTAL_SUPPLY);
        reserveToken = await Contracts.TestStandardToken.deploy('RSV1', 'RSV1', TOTAL_SUPPLY);
        reserveToken2 = await Contracts.TestStandardToken.deploy('RSV2', 'RSV2', TOTAL_SUPPLY);

        poolToken = await createPoolToken(reserveToken);
        poolToken2 = await createPoolToken(reserveToken2);

        store = await Contracts.TestStakingRewardsStore.deploy();

        await store.connect(supervisor).grantRole(ROLE_OWNER, owner.address);
        await store.connect(supervisor).grantRole(ROLE_MANAGER, manager.address);

        await setTime(BigNumber.from(1000));
    });

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            const newStore = await Contracts.TestStakingRewardsStore.deploy();

            expect(await newStore.getRoleMemberCount(ROLE_SUPERVISOR)).to.equal(BigNumber.from(1));
            expect(await newStore.getRoleMemberCount(ROLE_OWNER)).to.equal(BigNumber.from(0));
            expect(await newStore.getRoleMemberCount(ROLE_MANAGER)).to.equal(BigNumber.from(0));
            expect(await newStore.getRoleMemberCount(ROLE_SEEDER)).to.equal(BigNumber.from(0));

            expect(await newStore.getRoleAdmin(ROLE_SUPERVISOR)).to.equal(ROLE_SUPERVISOR);
            expect(await newStore.getRoleAdmin(ROLE_OWNER)).to.equal(ROLE_SUPERVISOR);
            expect(await newStore.getRoleAdmin(ROLE_MANAGER)).to.equal(ROLE_SUPERVISOR);
            expect(await newStore.getRoleAdmin(ROLE_SEEDER)).to.equal(ROLE_SUPERVISOR);

            expect(await newStore.hasRole(ROLE_SUPERVISOR, supervisor.address)).to.be.true;
            expect(await newStore.hasRole(ROLE_OWNER, supervisor.address)).to.be.false;
            expect(await newStore.hasRole(ROLE_MANAGER, supervisor.address)).to.be.false;
            expect(await newStore.hasRole(ROLE_SEEDER, supervisor.address)).to.be.false;
        });
    });

    describe('pool programs', () => {
        context('manager', async () => {
            it('should revert when a non-manager attempts to add a pool', async () => {
                await expect(
                    store
                        .connect(nonManager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            BigNumber.from(1000)
                        )
                ).to.be.revertedWith('ERR_ACCESS_DENIED');
            });

            it('should revert when adding a zero address pool', async () => {
                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            ZERO_ADDRESS,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            BigNumber.from(1000)
                        )
                ).to.be.revertedWith('ERR_INVALID_ADDRESS');
            });

            it('should revert when adding a pool with invalid ending time', async () => {
                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.sub(BigNumber.from(1)),
                            BigNumber.from(1000)
                        )
                ).to.be.revertedWith('ERR_INVALID_DURATION');
            });

            it('should revert when adding a pool with invalid reward shares', async () => {
                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE.sub(BigNumber.from(1)), BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            BigNumber.from(1000)
                        )
                ).to.be.revertedWith('ERR_INVALID_REWARD_SHARES');
            });

            it('should revert when adding a pool with invalid reserve tokens', async () => {
                const invalidToken = accounts[5].address;

                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [invalidToken, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            BigNumber.from(1000)
                        )
                ).to.be.revertedWith('ERR_INVALID_RESERVE_TOKENS');

                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, invalidToken],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            BigNumber.from(1000)
                        )
                ).to.be.revertedWith('ERR_INVALID_RESERVE_TOKENS');
            });

            it('should revert when adding pools without any rewards', async () => {
                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            BigNumber.from(0)
                        )
                ).to.be.revertedWith('ERR_ZERO_VALUE');
            });

            it('should revert when adding pools with too high reward rate', async () => {
                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(2000)),
                            MAX_REWARD_RATE.add(BigNumber.from(1))
                        )
                ).to.be.revertedWith('ERR_REWARD_RATE_TOO_HIGH');
            });

            it('should allow managing pools', async () => {
                expect(await store.isPoolParticipating(poolToken.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.false;

                const startTime = now;
                const endTime = startTime.add(BigNumber.from(2000));
                const rewardRate = BigNumber.from(1000);
                const res = await store
                    .connect(manager)
                    .addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        endTime,
                        rewardRate
                    );
                await expect(res)
                    .to.emit(store, 'PoolProgramAdded')
                    .withArgs(poolToken.address, startTime, endTime, rewardRate);

                expect(await store.isPoolParticipating(poolToken.address)).to.be.true;
                expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.true;
                expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.true;

                let program1 = await getPoolProgram(poolToken);
                expect(program1.startTime).to.equal(startTime);
                expect(program1.endTime).to.equal(endTime);
                expect(program1.rewardRate).to.equal(rewardRate);
                expect(program1.reserveTokens[0]).to.equal(networkToken.address);
                expect(program1.reserveTokens[1]).to.equal(reserveToken.address);
                expect(program1.rewardShares[0]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);
                expect(program1.rewardShares[1]).to.equal(BASE_TOKEN_REWARDS_SHARE);

                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(1)),
                            rewardRate
                        )
                ).to.be.revertedWith('ERR_ALREADY_PARTICIPATING');

                const programs = await getPoolPrograms();
                expect(programs.length).to.equal(1);

                program1 = programs[0];
                expect(program1.poolToken).to.equal(poolToken.address);
                expect(program1.startTime).to.equal(startTime);
                expect(program1.endTime).to.equal(endTime);
                expect(program1.rewardRate).to.equal(rewardRate);
                expect(program1.reserveTokens[0]).to.equal(networkToken.address);
                expect(program1.reserveTokens[1]).to.equal(reserveToken.address);
                expect(program1.rewardShares[0]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);
                expect(program1.rewardShares[1]).to.equal(BASE_TOKEN_REWARDS_SHARE);

                expect(await store.isPoolParticipating(poolToken2.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken2.address, networkToken.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken2.address, reserveToken2.address)).to.be.false;

                await setTime(now.add(BigNumber.from(100000)));

                const startTime2 = now;
                const endTime2 = startTime2.add(BigNumber.from(6000));
                const rewardRate2 = startTime2.add(BigNumber.from(9999));
                const res2 = await store
                    .connect(manager)
                    .addPoolProgram(
                        poolToken2.address,
                        [reserveToken2.address, networkToken.address],
                        [BASE_TOKEN_REWARDS_SHARE, NETWORK_TOKEN_REWARDS_SHARE],
                        endTime2,
                        rewardRate2
                    );
                await expect(res2)
                    .to.emit(store, 'PoolProgramAdded')
                    .withArgs(poolToken2.address, startTime2, endTime2, rewardRate2);

                expect(await store.isPoolParticipating(poolToken2.address)).to.be.true;
                expect(await store.isReserveParticipating(poolToken2.address, networkToken.address)).to.be.true;
                expect(await store.isReserveParticipating(poolToken2.address, reserveToken2.address)).to.be.true;

                let program2 = await getPoolProgram(poolToken2);
                expect(program2.startTime).to.equal(startTime2);
                expect(program2.endTime).to.equal(endTime2);
                expect(program2.rewardRate).to.equal(rewardRate2);
                expect(program2.reserveTokens[0]).to.equal(reserveToken2.address);
                expect(program2.reserveTokens[1]).to.equal(networkToken.address);
                expect(program2.rewardShares[0]).to.equal(BASE_TOKEN_REWARDS_SHARE);
                expect(program2.rewardShares[1]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);

                const programs2 = await getPoolPrograms();
                expect(programs2.length).to.equal(2);

                program2 = programs2[1];
                expect(program2.poolToken).to.equal(poolToken2.address);
                expect(program2.startTime).to.equal(startTime2);
                expect(program2.endTime).to.equal(endTime2);
                expect(program2.rewardRate).to.equal(rewardRate2);
                expect(program2.reserveTokens[0]).to.equal(reserveToken2.address);
                expect(program2.reserveTokens[1]).to.equal(networkToken.address);
                expect(program2.rewardShares[0]).to.equal(BASE_TOKEN_REWARDS_SHARE);
                expect(program2.rewardShares[1]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);

                await expect(
                    store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken2.address,
                            [networkToken.address, reserveToken2.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            now.add(BigNumber.from(1)),
                            rewardRate
                        )
                ).to.be.revertedWith('ERR_ALREADY_PARTICIPATING');
            });

            it('should allow adding program with reverse order of reserve tokens', async () => {
                expect(await store.isPoolParticipating(poolToken.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.false;
                expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.false;

                const startTime = now;
                const endTime = startTime.add(BigNumber.from(2000));
                const rewardRate = BigNumber.from(1000);
                const res = await store
                    .connect(manager)
                    .addPoolProgram(
                        poolToken.address,
                        [reserveToken.address, networkToken.address],
                        [BASE_TOKEN_REWARDS_SHARE, NETWORK_TOKEN_REWARDS_SHARE],
                        endTime,
                        rewardRate
                    );
                await expect(res)
                    .to.emit(store, 'PoolProgramAdded')
                    .withArgs(poolToken.address, startTime, endTime, rewardRate);

                expect(await store.isPoolParticipating(poolToken.address)).to.be.true;
                expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.true;
                expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.true;
            });

            context('with a registered pool', async () => {
                let startTime;
                let endTime;

                beforeEach(async () => {
                    startTime = now;
                    endTime = startTime.add(BigNumber.from(2000));
                    const rewardRate = BigNumber.from(1000);
                    await store
                        .connect(manager)
                        .addPoolProgram(
                            poolToken.address,
                            [networkToken.address, reserveToken.address],
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            endTime,
                            rewardRate
                        );
                });

                it('should revert when a non-manager attempts to remove a pool', async () => {
                    await expect(store.connect(nonManager).removePoolProgram(poolToken.address)).to.be.revertedWith(
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when removing an unregistered pool', async () => {
                    await expect(store.connect(manager).removePoolProgram(poolToken2.address)).to.be.revertedWith(
                        'ERR_POOL_NOT_PARTICIPATING'
                    );
                });

                it('should allow removing pools', async () => {
                    let programs = await getPoolPrograms();
                    expect(programs.length).to.equal(1);

                    const res = await store.connect(manager).removePoolProgram(poolToken.address);
                    await expect(res).to.emit(store, 'PoolProgramRemoved').withArgs(poolToken.address);

                    programs = await getPoolPrograms();
                    expect(programs.length).to.equal(0);

                    expect(await store.isPoolParticipating(poolToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.false;
                });

                it('should treat as non-participating pool after the ending time of the program', async () => {
                    expect(await store.isPoolParticipating(poolToken.address)).to.be.true;
                    expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.true;
                    expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.true;

                    await setTime(endTime);

                    expect(await store.isPoolParticipating(poolToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.false;
                });

                it('should revert when trying to update the ending time of a non-existing program', async () => {
                    await expect(
                        store.connect(manager).setPoolProgramEndTime(poolToken2.address, endTime.add(BigNumber.from(1)))
                    ).to.be.revertedWith('ERR_POOL_NOT_PARTICIPATING');
                });

                it('should revert when trying to update the ending time of an ended program', async () => {
                    const newEndTime = endTime.add(BigNumber.from(10000));

                    await setTime(endTime);

                    await expect(
                        store.connect(manager).setPoolProgramEndTime(poolToken.address, newEndTime)
                    ).to.be.revertedWith('ERR_POOL_NOT_PARTICIPATING');

                    await setTime(endTime.add(BigNumber.from(1000)));

                    await expect(
                        store.connect(manager).setPoolProgramEndTime(poolToken.address, newEndTime)
                    ).to.be.revertedWith('ERR_POOL_NOT_PARTICIPATING');
                });

                it('should revert when trying to reduce a program ending time to a point in the past', async () => {
                    await setTime(startTime.add(BigNumber.from(10)));

                    await expect(
                        store
                            .connect(manager)
                            .setPoolProgramEndTime(poolToken.address, startTime.add(BigNumber.from(1)))
                    ).to.be.revertedWith('ERR_INVALID_DURATION');
                });

                it('should allow reducing the ending time of an ongoing program', async () => {
                    const newEndTime = endTime.sub(BigNumber.from(10));
                    await store.connect(manager).setPoolProgramEndTime(poolToken.address, newEndTime);

                    const program = await getPoolProgram(poolToken);
                    expect(program.endTime).to.equal(newEndTime);
                });

                it('should allow extending an ongoing program', async () => {
                    const newEndTime = endTime.add(BigNumber.from(10000));
                    await store.connect(manager).setPoolProgramEndTime(poolToken.address, newEndTime);

                    const program = await getPoolProgram(poolToken);
                    expect(program.endTime).to.equal(newEndTime);
                });
            });
        });

        context('seeder', async () => {
            let seeder;

            before(async () => {
                seeder = accounts[5];
            });

            beforeEach(async () => {
                await store.connect(supervisor).grantRole(ROLE_SEEDER, seeder.address);
            });

            describe('pool programs', async () => {
                it('should revert when a non-seeder attempts to add programs', async () => {
                    await expect(
                        store
                            .connect(owner)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(1))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when adding zero address pools', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [ZERO_ADDRESS],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(1))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when adding programs with invalid starting time', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now],
                                [BigNumber.from(1000)],
                                [now.add(BigNumber.from(2000))]
                            )
                    ).to.be.revertedWith('ERR_INVALID_TIME');
                });

                it('should revert when adding programs with invalid ending time', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_DURATION');
                });

                it('should revert when adding programs with invalid reward shares', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE.sub(BigNumber.from(1)), BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_REWARD_SHARES');
                });

                it('should revert when adding programs with invalid reserve tokens', async () => {
                    const invalidToken = accounts[5].address;

                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[invalidToken, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_RESERVE_TOKENS');

                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, invalidToken]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_RESERVE_TOKENS');
                });

                it('should revert when adding programs without any rewards', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(0)]
                            )
                    ).to.be.revertedWith('ERR_ZERO_VALUE');
                });

                it('should revert when adding programs with invalid length data', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address, poolToken2.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store.connect(seeder).addPastPoolPrograms(
                            [poolToken.address],
                            [
                                [networkToken.address, reserveToken.address],
                                [networkToken.address, reserveToken.address]
                            ],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(BigNumber.from(100))],
                            [now.add(BigNumber.from(2000))],
                            [BigNumber.from(1000)]
                        )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store.connect(seeder).addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [
                                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]
                            ],
                            [now.sub(BigNumber.from(100))],
                            [now.add(BigNumber.from(2000))],
                            [BigNumber.from(1000)]
                        )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100)), now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000)), now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .addPastPoolPrograms(
                                [poolToken.address],
                                [[networkToken.address, reserveToken.address]],
                                [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                                [now.sub(BigNumber.from(100))],
                                [now.add(BigNumber.from(2000))],
                                [BigNumber.from(1000), BigNumber.from(1000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');
                });

                it('should allow seeding of programs', async () => {
                    expect(await store.isPoolParticipating(poolToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.false;

                    expect(await store.isPoolParticipating(poolToken2.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken2.address, networkToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken2.address, reserveToken2.address)).to.be.false;

                    const startTime = now.sub(BigNumber.from(1000));
                    const endTime = startTime.add(BigNumber.from(2000));
                    const rewardRate = BigNumber.from(1000);

                    const startTime2 = now.sub(BigNumber.from(10));
                    const endTime2 = startTime2.add(BigNumber.from(6000));
                    const rewardRate2 = startTime2.add(BigNumber.from(9999));

                    await store.connect(seeder).addPastPoolPrograms(
                        [poolToken.address, poolToken2.address],
                        [
                            [networkToken.address, reserveToken.address],
                            [reserveToken2.address, networkToken.address]
                        ],
                        [
                            [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                            [BASE_TOKEN_REWARDS_SHARE, NETWORK_TOKEN_REWARDS_SHARE]
                        ],
                        [startTime, startTime2],
                        [endTime, endTime2],
                        [rewardRate, rewardRate2]
                    );

                    expect(await store.isPoolParticipating(poolToken.address)).to.be.true;
                    expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.true;
                    expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.true;

                    expect(await store.isPoolParticipating(poolToken2.address)).to.be.true;
                    expect(await store.isReserveParticipating(poolToken2.address, networkToken.address)).to.be.true;
                    expect(await store.isReserveParticipating(poolToken2.address, reserveToken2.address)).to.be.true;

                    let program1 = await getPoolProgram(poolToken);
                    expect(program1.startTime).to.equal(startTime);
                    expect(program1.endTime).to.equal(endTime);
                    expect(program1.rewardRate).to.equal(rewardRate);
                    expect(program1.reserveTokens[0]).to.equal(networkToken.address);
                    expect(program1.reserveTokens[1]).to.equal(reserveToken.address);
                    expect(program1.rewardShares[0]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);
                    expect(program1.rewardShares[1]).to.equal(BASE_TOKEN_REWARDS_SHARE);

                    const programs = await getPoolPrograms();
                    expect(programs.length).to.equal(2);

                    program1 = programs[0];
                    expect(program1.poolToken).to.equal(poolToken.address);
                    expect(program1.startTime).to.equal(startTime);
                    expect(program1.endTime).to.equal(endTime);
                    expect(program1.rewardRate).to.equal(rewardRate);
                    expect(program1.reserveTokens[0]).to.equal(networkToken.address);
                    expect(program1.reserveTokens[1]).to.equal(reserveToken.address);
                    expect(program1.rewardShares[0]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);
                    expect(program1.rewardShares[1]).to.equal(BASE_TOKEN_REWARDS_SHARE);

                    let program2 = await getPoolProgram(poolToken2);
                    expect(program2.startTime).to.equal(startTime2);
                    expect(program2.endTime).to.equal(endTime2);
                    expect(program2.rewardRate).to.equal(rewardRate2);
                    expect(program2.reserveTokens[0]).to.equal(reserveToken2.address);
                    expect(program2.reserveTokens[1]).to.equal(networkToken.address);
                    expect(program2.rewardShares[0]).to.equal(BASE_TOKEN_REWARDS_SHARE);
                    expect(program2.rewardShares[1]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);

                    program2 = programs[1];
                    expect(program2.poolToken).to.equal(poolToken2.address);
                    expect(program2.startTime).to.equal(startTime2);
                    expect(program2.endTime).to.equal(endTime2);
                    expect(program2.rewardRate).to.equal(rewardRate2);
                    expect(program2.reserveTokens[0]).to.equal(reserveToken2.address);
                    expect(program2.reserveTokens[1]).to.equal(networkToken.address);
                    expect(program2.rewardShares[0]).to.equal(BASE_TOKEN_REWARDS_SHARE);
                    expect(program2.rewardShares[1]).to.equal(NETWORK_TOKEN_REWARDS_SHARE);
                });
            });

            describe('pool rewards', async () => {
                it('should revert when a non-seeder attempts to seed pool rewards', async () => {
                    await expect(
                        store
                            .connect(owner)
                            .setPoolsRewardData(
                                [poolToken.address],
                                [networkToken.address],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when seeding zero address pools', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [ZERO_ADDRESS],
                                [networkToken.address],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when seeding zero address reserves', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [poolToken.address],
                                [ZERO_ADDRESS],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when seeding pools with invalid length data', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [poolToken.address, poolToken2.address],
                                [networkToken.address],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [poolToken.address],
                                [networkToken.address, reserveToken.address],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [poolToken.address],
                                [networkToken.address],
                                [now.sub(BigNumber.from(1)), now],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [poolToken.address],
                                [networkToken.address],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000), BigNumber.from(1)],
                                [BigNumber.from(5000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setPoolsRewardData(
                                [poolToken.address],
                                [networkToken.address],
                                [now.sub(BigNumber.from(1))],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000), BigNumber.from(100000)]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');
                });

                it('should allow seeding pools rewards', async () => {
                    expect(await store.isPoolParticipating(poolToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, networkToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken.address, reserveToken.address)).to.be.false;

                    expect(await store.isPoolParticipating(poolToken2.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken2.address, networkToken.address)).to.be.false;
                    expect(await store.isReserveParticipating(poolToken2.address, reserveToken2.address)).to.be.false;

                    const lastUpdateTimeN1 = now.sub(BigNumber.from(1000));
                    const rewardsPerTokenN1 = BigNumber.from(2000);
                    const totalClaimedRewardsN1 = BigNumber.from(1000);
                    const lastUpdateTimeR1 = now.add(BigNumber.from(10000));
                    const rewardsPerTokenR1 = BigNumber.from(200000);
                    const totalClaimedRewardsR1 = BigNumber.from(99999);

                    const lastUpdateTimeN2 = now.sub(BigNumber.from(111));
                    const rewardsPerTokenN2 = BigNumber.from(9999999);
                    const totalClaimedRewardsN2 = BigNumber.from(5555);
                    const lastUpdateTimeR2 = now.add(BigNumber.from(32423423));
                    const rewardsPerTokenR2 = BigNumber.from(8);
                    const totalClaimedRewardsR2 = BigNumber.from(0);

                    await store
                        .connect(seeder)
                        .setPoolsRewardData(
                            [poolToken.address, poolToken.address, poolToken2.address, poolToken2.address],
                            [networkToken.address, reserveToken.address, networkToken.address, reserveToken2.address],
                            [lastUpdateTimeN1, lastUpdateTimeR1, lastUpdateTimeN2, lastUpdateTimeR2],
                            [rewardsPerTokenN1, rewardsPerTokenR1, rewardsPerTokenN2, rewardsPerTokenR2],
                            [totalClaimedRewardsN1, totalClaimedRewardsR1, totalClaimedRewardsN2, totalClaimedRewardsR2]
                        );

                    const poolDataN1 = await getPoolRewards(poolToken, networkToken);
                    expect(poolDataN1.lastUpdateTime).to.equal(lastUpdateTimeN1);
                    expect(poolDataN1.rewardPerToken).to.equal(rewardsPerTokenN1);
                    expect(poolDataN1.totalClaimedRewards).to.equal(totalClaimedRewardsN1);

                    const poolDataR1 = await getPoolRewards(poolToken, reserveToken);
                    expect(poolDataR1.lastUpdateTime).to.equal(lastUpdateTimeR1);
                    expect(poolDataR1.rewardPerToken).to.equal(rewardsPerTokenR1);
                    expect(poolDataR1.totalClaimedRewards).to.equal(totalClaimedRewardsR1);

                    const poolDataN2 = await getPoolRewards(poolToken2, networkToken);
                    expect(poolDataN2.lastUpdateTime).to.equal(lastUpdateTimeN2);
                    expect(poolDataN2.rewardPerToken).to.equal(rewardsPerTokenN2);
                    expect(poolDataN2.totalClaimedRewards).to.equal(totalClaimedRewardsN2);

                    const poolDataR2 = await getPoolRewards(poolToken2, reserveToken2);
                    expect(poolDataR2.lastUpdateTime).to.equal(lastUpdateTimeR2);
                    expect(poolDataR2.rewardPerToken).to.equal(rewardsPerTokenR2);
                    expect(poolDataR2.totalClaimedRewards).to.equal(totalClaimedRewardsR2);
                });
            });

            describe('provider rewards', async () => {
                let provider;
                let provider2;

                before(async () => {
                    provider = accounts[3];
                    provider2 = accounts[4];
                });

                it('should revert when a non-seeder attempts to seed provider rewards', async () => {
                    await expect(
                        store
                            .connect(owner)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when seeding zero address pools', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                ZERO_ADDRESS,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when seeding zero address reserves', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                ZERO_ADDRESS,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when seeding with an invalid multiplier', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION.sub(BigNumber.from(1))]
                            )
                    ).to.be.revertedWith('ERR_INVALID_MULTIPLIER');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION.mul(BigNumber.from(3))]
                            )
                    ).to.be.revertedWith('ERR_INVALID_MULTIPLIER');
                });

                it('should revert when seeding pools with invalid length data', async () => {
                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address, provider2.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000), BigNumber.from(12)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000), BigNumber.from(5000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000), BigNumber.from(50000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now, now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000), BigNumber.from(1)],
                                [PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');

                    await expect(
                        store
                            .connect(seeder)
                            .setProviderRewardData(
                                poolToken.address,
                                networkToken.address,
                                [provider.address],
                                [BigNumber.from(100000)],
                                [BigNumber.from(1000)],
                                [BigNumber.from(5000)],
                                [now],
                                [BigNumber.from(5000)],
                                [PPM_RESOLUTION, PPM_RESOLUTION]
                            )
                    ).to.be.revertedWith('ERR_INVALID_LENGTH');
                });

                it('should allow seeding provider rewards', async () => {
                    let providerRewards = await getProviderRewards(provider, poolToken, networkToken);
                    expect(providerRewards.rewardPerToken).to.equal(BigNumber.from(0));

                    let providerRewards2 = await getProviderRewards(provider, poolToken, networkToken);
                    expect(providerRewards2.rewardPerToken).to.equal(BigNumber.from(0));

                    const rewardPerToken = BigNumber.from(1);
                    const pendingBaseRewards = BigNumber.from(0);
                    const totalClaimedRewards = BigNumber.from(1000);
                    const effectiveStakingTime = now;
                    const baseRewardsDebt = BigNumber.from(1245);
                    const baseRewardsDebtMultiplier = PPM_RESOLUTION;

                    const rewardPerToken2 = BigNumber.from(1000000);
                    const pendingBaseRewards2 = BigNumber.from(555);
                    const totalClaimedRewards2 = BigNumber.from(13);
                    const effectiveStakingTime2 = now.add(BigNumber.from(6000));
                    const baseRewardsDebt2 = BigNumber.from(3333343);
                    const baseRewardsDebtMultiplier2 = PPM_RESOLUTION.mul(BigNumber.from(2));

                    await store
                        .connect(seeder)
                        .setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider.address, provider2.address],
                            [rewardPerToken, rewardPerToken2],
                            [pendingBaseRewards, pendingBaseRewards2],
                            [totalClaimedRewards, totalClaimedRewards2],
                            [effectiveStakingTime, effectiveStakingTime2],
                            [baseRewardsDebt, baseRewardsDebt2],
                            [baseRewardsDebtMultiplier, baseRewardsDebtMultiplier2]
                        );

                    providerRewards = await getProviderRewards(provider, poolToken, networkToken);
                    expect(providerRewards.rewardPerToken).to.equal(rewardPerToken);
                    expect(providerRewards.pendingBaseRewards).to.equal(pendingBaseRewards);
                    expect(providerRewards.totalClaimedRewards).to.equal(totalClaimedRewards);
                    expect(providerRewards.effectiveStakingTime).to.equal(effectiveStakingTime);
                    expect(providerRewards.baseRewardsDebt).to.equal(baseRewardsDebt);
                    expect(providerRewards.baseRewardsDebtMultiplier).to.equal(baseRewardsDebtMultiplier);

                    providerRewards2 = await getProviderRewards(provider2, poolToken, networkToken);
                    expect(providerRewards2.rewardPerToken).to.equal(rewardPerToken2);
                    expect(providerRewards2.pendingBaseRewards).to.equal(pendingBaseRewards2);
                    expect(providerRewards2.totalClaimedRewards).to.equal(totalClaimedRewards2);
                    expect(providerRewards2.effectiveStakingTime).to.equal(effectiveStakingTime2);
                    expect(providerRewards2.baseRewardsDebt).to.equal(baseRewardsDebt2);
                    expect(providerRewards2.baseRewardsDebtMultiplier).to.equal(baseRewardsDebtMultiplier2);
                });
            });
        });
    });

    describe('pool rewards data', () => {
        beforeEach(async () => {
            const startTime = now;
            const endTime = startTime.add(BigNumber.from(2000));
            const rewardRate = BigNumber.from(1000);
            await store
                .connect(manager)
                .addPoolProgram(
                    poolToken.address,
                    [networkToken.address, reserveToken.address],
                    [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                    endTime,
                    rewardRate
                );
        });

        it('should revert when a non-owner attempts to update pool rewards', async () => {
            await expect(
                store
                    .connect(nonOwner)
                    .updatePoolRewardsData(
                        poolToken.address,
                        reserveToken.address,
                        BigNumber.from(0),
                        BigNumber.from(1000),
                        BigNumber.from(1000)
                    )
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should update pool rewards data', async () => {
            let poolData = await getPoolRewards(poolToken, reserveToken);
            expect(poolData.lastUpdateTime).to.equal(BigNumber.from(0));
            expect(poolData.rewardPerToken).to.equal(BigNumber.from(0));
            expect(poolData.totalClaimedRewards).to.equal(BigNumber.from(0));

            const lastUpdateTime = BigNumber.from(123);
            const rewardPerToken = BigNumber.from(10000);
            const totalClaimedRewards = BigNumber.from(5555555);

            await store
                .connect(owner)
                .updatePoolRewardsData(
                    poolToken.address,
                    reserveToken.address,
                    lastUpdateTime,
                    rewardPerToken,
                    totalClaimedRewards
                );

            poolData = await getPoolRewards(poolToken, reserveToken);
            expect(poolData.lastUpdateTime).to.equal(lastUpdateTime);
            expect(poolData.rewardPerToken).to.equal(rewardPerToken);
            expect(poolData.totalClaimedRewards).to.equal(totalClaimedRewards);
        });
    });

    describe('provider rewards data', () => {
        let provider;

        before(async () => {
            provider = accounts[5];
        });

        beforeEach(async () => {
            const startTime = now;
            const endTime = startTime.add(BigNumber.from(2000));
            const rewardRate = BigNumber.from(1000);
            await store
                .connect(manager)
                .addPoolProgram(
                    poolToken.address,
                    [networkToken.address, reserveToken.address],
                    [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                    endTime,
                    rewardRate
                );
        });

        it('should revert when a non-owner attempts to update provider rewards data', async () => {
            await expect(
                store
                    .connect(nonOwner)
                    .updateProviderRewardsData(
                        provider.address,
                        poolToken.address,
                        reserveToken.address,
                        BigNumber.from(1000),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0),
                        BigNumber.from(0)
                    )
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should update provider rewards data', async () => {
            let providerData = await getProviderRewards(provider, poolToken, reserveToken);
            expect(providerData.rewardPerToken).to.equal(BigNumber.from(0));
            expect(providerData.pendingBaseRewards).to.equal(BigNumber.from(0));
            expect(providerData.totalClaimedRewards).to.equal(BigNumber.from(0));
            expect(providerData.effectiveStakingTime).to.equal(BigNumber.from(0));

            const rewardPerToken = BigNumber.from(10000);
            const pendingBaseRewards = BigNumber.from(123);
            const totalClaimedRewards = BigNumber.from(9999);
            const effectiveStakingTime = BigNumber.from(11111);
            const baseRewardsDebt = BigNumber.from(9999999);
            const baseRewardsDebtMultiplier = BigNumber.from(100000);
            await store
                .connect(owner)
                .updateProviderRewardsData(
                    provider.address,
                    poolToken.address,
                    reserveToken.address,
                    rewardPerToken,
                    pendingBaseRewards,
                    totalClaimedRewards,
                    effectiveStakingTime,
                    baseRewardsDebt,
                    baseRewardsDebtMultiplier
                );

            providerData = await getProviderRewards(provider, poolToken, reserveToken);
            expect(providerData.rewardPerToken).to.equal(rewardPerToken);
            expect(providerData.pendingBaseRewards).to.equal(pendingBaseRewards);
            expect(providerData.totalClaimedRewards).to.equal(totalClaimedRewards);
            expect(providerData.effectiveStakingTime).to.equal(effectiveStakingTime);
            expect(providerData.baseRewardsDebt).to.equal(baseRewardsDebt);
            expect(providerData.baseRewardsDebtMultiplier).to.equal(baseRewardsDebtMultiplier);
        });
    });

    describe('last claim times', () => {
        let provider;

        before(async () => {
            provider = accounts[5].address;
        });

        it('should revert when a non-owner attempts to update last claim time', async () => {
            await expect(store.connect(nonOwner).updateProviderLastClaimTime(provider)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
        });

        it('should allow to update last claim time', async () => {
            expect(await store.providerLastClaimTime(provider)).to.equal(BigNumber.from(0));

            await setTime(now.add(BigNumber.from(1)));
            const res = await store.connect(owner).updateProviderLastClaimTime(provider);
            expect(await store.providerLastClaimTime(provider)).to.equal(now);
            await expect(res).to.emit(store, 'ProviderLastClaimTimeUpdated').withArgs(provider, now);

            await setTime(now.add(BigNumber.from(100000)));
            const res2 = await store.connect(owner).updateProviderLastClaimTime(provider);
            await expect(res2).to.emit(store, 'ProviderLastClaimTimeUpdated').withArgs(provider, now);
            expect(await store.providerLastClaimTime(provider)).to.equal(now);
        });
    });
});
