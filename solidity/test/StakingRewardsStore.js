const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { ZERO_ADDRESS } = constants;
const {
    registry: { CONVERTER_FACTORY, CONVERTER_REGISTRY, CONVERTER_REGISTRY_DATA },
    roles: { ROLE_SUPERVISOR, ROLE_OWNER, ROLE_MANAGER, ROLE_SEEDER }
} = require('./helpers/Constants');

const TestStandardToken = contract.fromArtifact('TestStandardToken');
const ConverterRegistry = contract.fromArtifact('TestConverterRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterBase = contract.fromArtifact('ConverterBase');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');

const StakingRewardsStore = contract.fromArtifact('TestStakingRewardsStore');

const PPM_RESOLUTION = new BN(1000000);
const NETWORK_TOKEN_REWARDS_SHARE = new BN(700000); // 70%
const BASE_TOKEN_REWARDS_SHARE = new BN(300000); // 30%

const MAX_REWARD_RATE = new BN(2).pow(new BN(128)).sub(new BN(1));

const TOTAL_SUPPLY = new BN(10).pow(new BN(24));

describe('StakingRewardsStore', () => {
    let now;
    let converterRegistry;
    let store;
    let reserveToken;
    let reserveToken2;
    let networkToken;
    let poolToken;
    let poolToken2;
    const supervisor = defaultSender;
    const owner = accounts[0];
    const nonOwner = accounts[1];
    const manager = accounts[2];
    const nonManager = accounts[3];

    const setTime = async (time) => {
        now = time;

        for (const t of [store]) {
            if (t) {
                await t.setTime(now);
            }
        }
    };

    const getPoolProgram = async (poolToken) => {
        const data = await store.poolProgram.call(poolToken.address);

        return {
            startTime: data[0],
            endTime: data[1],
            rewardRate: data[2],
            reserveTokens: data[3],
            rewardShares: data[4]
        };
    };

    const getPoolPrograms = async () => {
        const data = await store.poolPrograms.call();

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
        const data = await store.poolRewards.call(poolToken.address, reserveToken.address);

        return {
            lastUpdateTime: data[0],
            rewardPerToken: data[1],
            totalClaimedRewards: data[2]
        };
    };

    const getProviderRewards = async (provider, poolToken, reserveToken) => {
        const data = await store.providerRewards.call(provider, poolToken.address, reserveToken.address);

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
        const weights = [500000, 500000];

        await converterRegistry.newConverter(
            3,
            'PT',
            'PT',
            18,
            PPM_RESOLUTION,
            [reserveToken.address, networkToken.address],
            weights
        );

        const anchorCount = await converterRegistry.getAnchorCount.call();
        const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);

        const converterAddress = await converterRegistry.createdConverter.call();
        const converter = await ConverterBase.at(converterAddress);
        await converter.acceptOwnership();

        return TestStandardToken.at(poolTokenAddress);
    };

    before(async () => {
        const contractRegistry = await ContractRegistry.new();
        converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

        const standardPoolConverterFactory = await StandardPoolConverterFactory.new();
        const converterFactory = await ConverterFactory.new();
        await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

        await contractRegistry.registerAddress(CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(CONVERTER_REGISTRY_DATA, converterRegistryData.address);
    });

    beforeEach(async () => {
        networkToken = await TestStandardToken.new('TKN1', 'TKN1', 18, TOTAL_SUPPLY);
        reserveToken = await TestStandardToken.new('RSV1', 'RSV1', 18, TOTAL_SUPPLY);
        reserveToken2 = await TestStandardToken.new('RSV2', 'RSV2', 18, TOTAL_SUPPLY);

        poolToken = await createPoolToken(reserveToken);
        poolToken2 = await createPoolToken(reserveToken2);

        store = await StakingRewardsStore.new();

        await store.grantRole(ROLE_OWNER, owner, { from: supervisor });
        await store.grantRole(ROLE_MANAGER, manager, { from: supervisor });

        await setTime(new BN(1000));
    });

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            const newStore = await StakingRewardsStore.new();

            expect(await newStore.getRoleMemberCount.call(ROLE_SUPERVISOR)).to.be.bignumber.equal(new BN(1));
            expect(await newStore.getRoleMemberCount.call(ROLE_OWNER)).to.be.bignumber.equal(new BN(0));
            expect(await newStore.getRoleMemberCount.call(ROLE_MANAGER)).to.be.bignumber.equal(new BN(0));
            expect(await newStore.getRoleMemberCount.call(ROLE_SEEDER)).to.be.bignumber.equal(new BN(0));

            expect(await newStore.getRoleAdmin.call(ROLE_SUPERVISOR)).to.eql(ROLE_SUPERVISOR);
            expect(await newStore.getRoleAdmin.call(ROLE_OWNER)).to.eql(ROLE_SUPERVISOR);
            expect(await newStore.getRoleAdmin.call(ROLE_MANAGER)).to.eql(ROLE_SUPERVISOR);
            expect(await newStore.getRoleAdmin.call(ROLE_SEEDER)).to.eql(ROLE_SUPERVISOR);

            expect(await newStore.hasRole.call(ROLE_SUPERVISOR, supervisor)).to.be.true();
            expect(await newStore.hasRole.call(ROLE_OWNER, supervisor)).to.be.false();
            expect(await newStore.hasRole.call(ROLE_MANAGER, supervisor)).to.be.false();
            expect(await newStore.hasRole.call(ROLE_SEEDER, supervisor)).to.be.false();
        });
    });

    describe('pool programs', () => {
        context('manager', async () => {
            it('should revert when a non-manager attempts to add a pool', async () => {
                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        new BN(1000),
                        { from: nonManager }
                    ),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should revert when adding a zero address pool', async () => {
                await expectRevert(
                    store.addPoolProgram(
                        ZERO_ADDRESS,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        new BN(1000),
                        { from: manager }
                    ),
                    'ERR_INVALID_ADDRESS'
                );
            });

            it('should revert when adding a pool with invalid ending time', async () => {
                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.sub(new BN(1)),
                        new BN(1000),
                        {
                            from: manager
                        }
                    ),
                    'ERR_INVALID_DURATION'
                );
            });

            it('should revert when adding a pool with invalid reward shares', async () => {
                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE.sub(new BN(1)), BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        new BN(1000),
                        {
                            from: manager
                        }
                    ),
                    'ERR_INVALID_REWARD_SHARES'
                );
            });

            it('should revert when adding a pool with invalid reserve tokens', async () => {
                const invalidToken = accounts[5];

                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [invalidToken, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        new BN(1000),
                        {
                            from: manager
                        }
                    ),
                    'ERR_INVALID_RESERVE_TOKENS'
                );

                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, invalidToken],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        new BN(1000),
                        {
                            from: manager
                        }
                    ),
                    'ERR_INVALID_RESERVE_TOKENS'
                );
            });

            it('should revert when adding pools without any rewards', async () => {
                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        new BN(0),
                        { from: manager }
                    ),
                    'ERR_ZERO_VALUE'
                );
            });

            it('should revert when adding pools with too high reward rate', async () => {
                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(2000)),
                        MAX_REWARD_RATE.add(new BN(1)),
                        { from: manager }
                    ),
                    'ERR_REWARD_RATE_TOO_HIGH'
                );
            });

            it('should allow managing pools', async () => {
                expect(await store.isPoolParticipating.call(poolToken.address)).to.be.false();
                expect(await store.isReserveParticipating.call(poolToken.address, networkToken.address)).to.be.false();
                expect(await store.isReserveParticipating.call(poolToken.address, reserveToken.address)).to.be.false();

                const startTime = now;
                const endTime = startTime.add(new BN(2000));
                const rewardRate = new BN(1000);
                const res = await store.addPoolProgram(
                    poolToken.address,
                    [networkToken.address, reserveToken.address],
                    [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                    endTime,
                    rewardRate,
                    { from: manager }
                );
                expectEvent(res, 'PoolProgramAdded', {
                    poolToken: poolToken.address,
                    startTime,
                    endTime,
                    rewardRate
                });

                expect(await store.isPoolParticipating.call(poolToken.address)).to.be.true();
                expect(await store.isReserveParticipating.call(poolToken.address, networkToken.address)).to.be.true();
                expect(await store.isReserveParticipating.call(poolToken.address, reserveToken.address)).to.be.true();

                let program1 = await getPoolProgram(poolToken);
                expect(program1.startTime).to.be.bignumber.equal(startTime);
                expect(program1.endTime).to.be.bignumber.equal(endTime);
                expect(program1.rewardRate).to.be.bignumber.equal(rewardRate);
                expect(program1.reserveTokens[0]).to.eql(networkToken.address);
                expect(program1.reserveTokens[1]).to.eql(reserveToken.address);
                expect(program1.rewardShares[0]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);
                expect(program1.rewardShares[1]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);

                await expectRevert(
                    store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(1)),
                        rewardRate,
                        { from: manager }
                    ),
                    'ERR_ALREADY_PARTICIPATING'
                );

                const programs = await getPoolPrograms();
                expect(programs.length).to.eql(1);

                program1 = programs[0];
                expect(program1.poolToken).to.eql(poolToken.address);
                expect(program1.startTime).to.be.bignumber.equal(startTime);
                expect(program1.endTime).to.be.bignumber.equal(endTime);
                expect(program1.rewardRate).to.be.bignumber.equal(rewardRate);
                expect(program1.reserveTokens[0]).to.eql(networkToken.address);
                expect(program1.reserveTokens[1]).to.eql(reserveToken.address);
                expect(program1.rewardShares[0]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);
                expect(program1.rewardShares[1]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);

                expect(await store.isPoolParticipating.call(poolToken2.address)).to.be.false();
                expect(await store.isReserveParticipating.call(poolToken2.address, networkToken.address)).to.be.false();
                expect(
                    await store.isReserveParticipating.call(poolToken2.address, reserveToken2.address)
                ).to.be.false();

                await setTime(now.add(new BN(100000)));

                const startTime2 = now;
                const endTime2 = startTime2.add(new BN(6000));
                const rewardRate2 = startTime2.add(new BN(9999));
                const res2 = await store.addPoolProgram(
                    poolToken2.address,
                    [reserveToken2.address, networkToken.address],
                    [BASE_TOKEN_REWARDS_SHARE, NETWORK_TOKEN_REWARDS_SHARE],
                    endTime2,
                    rewardRate2,
                    {
                        from: manager
                    }
                );
                expectEvent(res2, 'PoolProgramAdded', {
                    poolToken: poolToken2.address,
                    startTime: startTime2,
                    endTime: endTime2,
                    rewardRate: rewardRate2
                });

                expect(await store.isPoolParticipating.call(poolToken2.address)).to.be.true();
                expect(await store.isReserveParticipating.call(poolToken2.address, networkToken.address)).to.be.true();
                expect(await store.isReserveParticipating.call(poolToken2.address, reserveToken2.address)).to.be.true();

                let program2 = await getPoolProgram(poolToken2);
                expect(program2.startTime).to.be.bignumber.equal(startTime2);
                expect(program2.endTime).to.be.bignumber.equal(endTime2);
                expect(program2.rewardRate).to.be.bignumber.equal(rewardRate2);
                expect(program2.reserveTokens[0]).to.eql(reserveToken2.address);
                expect(program2.reserveTokens[1]).to.eql(networkToken.address);
                expect(program2.rewardShares[0]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);
                expect(program2.rewardShares[1]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);

                const programs2 = await getPoolPrograms();
                expect(programs2.length).to.eql(2);

                program2 = programs2[1];
                expect(program2.poolToken).to.eql(poolToken2.address);
                expect(program2.startTime).to.be.bignumber.equal(startTime2);
                expect(program2.endTime).to.be.bignumber.equal(endTime2);
                expect(program2.rewardRate).to.be.bignumber.equal(rewardRate2);
                expect(program2.reserveTokens[0]).to.eql(reserveToken2.address);
                expect(program2.reserveTokens[1]).to.eql(networkToken.address);
                expect(program2.rewardShares[0]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);
                expect(program2.rewardShares[1]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);

                await expectRevert(
                    store.addPoolProgram(
                        poolToken2.address,
                        [networkToken.address, reserveToken2.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        now.add(new BN(1)),
                        rewardRate,
                        { from: manager }
                    ),
                    'ERR_ALREADY_PARTICIPATING'
                );
            });

            it('should allow adding program with reverse order of reserve tokens', async () => {
                expect(await store.isPoolParticipating.call(poolToken.address)).to.be.false();
                expect(await store.isReserveParticipating.call(poolToken.address, networkToken.address)).to.be.false();
                expect(await store.isReserveParticipating.call(poolToken.address, reserveToken.address)).to.be.false();

                const startTime = now;
                const endTime = startTime.add(new BN(2000));
                const rewardRate = new BN(1000);
                const res = await store.addPoolProgram(
                    poolToken.address,
                    [reserveToken.address, networkToken.address],
                    [BASE_TOKEN_REWARDS_SHARE, NETWORK_TOKEN_REWARDS_SHARE],
                    endTime,
                    rewardRate,
                    { from: manager }
                );
                expectEvent(res, 'PoolProgramAdded', {
                    poolToken: poolToken.address,
                    startTime,
                    endTime,
                    rewardRate
                });

                expect(await store.isPoolParticipating.call(poolToken.address)).to.be.true();
                expect(await store.isReserveParticipating.call(poolToken.address, networkToken.address)).to.be.true();
                expect(await store.isReserveParticipating.call(poolToken.address, reserveToken.address)).to.be.true();
            });

            context('with a registered pool', async () => {
                let startTime;
                let endTime;

                beforeEach(async () => {
                    startTime = now;
                    endTime = startTime.add(new BN(2000));
                    const rewardRate = new BN(1000);
                    await store.addPoolProgram(
                        poolToken.address,
                        [networkToken.address, reserveToken.address],
                        [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                        endTime,
                        rewardRate,
                        { from: manager }
                    );
                });

                it('should revert when a non-manager attempts to remove a pool', async () => {
                    await expectRevert(
                        store.removePoolProgram(poolToken.address, { from: nonManager }),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when removing an unregistered pool', async () => {
                    await expectRevert(
                        store.removePoolProgram(poolToken2.address, { from: manager }),
                        'ERR_POOL_NOT_PARTICIPATING'
                    );
                });

                it('should allow removing pools', async () => {
                    let programs = await getPoolPrograms();
                    expect(programs.length).to.eql(1);

                    const res = await store.removePoolProgram(poolToken.address, { from: manager });
                    expectEvent(res, 'PoolProgramRemoved', { poolToken: poolToken.address });

                    programs = await getPoolPrograms();
                    expect(programs.length).to.eql(0);

                    expect(await store.isPoolParticipating.call(poolToken.address)).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, networkToken.address)
                    ).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, reserveToken.address)
                    ).to.be.false();
                });

                it('should treat as non-participating pool after the ending time of the program', async () => {
                    expect(await store.isPoolParticipating.call(poolToken.address)).to.be.true();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, networkToken.address)
                    ).to.be.true();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, reserveToken.address)
                    ).to.be.true();

                    await setTime(endTime);

                    expect(await store.isPoolParticipating.call(poolToken.address)).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, networkToken.address)
                    ).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, reserveToken.address)
                    ).to.be.false();
                });

                it('should revert when trying to update the ending time of a non-existing program', async () => {
                    await expectRevert(
                        store.setPoolProgramEndTime(poolToken2.address, endTime.add(new BN(1)), { from: manager }),
                        'ERR_POOL_NOT_PARTICIPATING'
                    );
                });

                it('should revert when trying to update the ending time of an ended program', async () => {
                    const newEndTime = endTime.add(new BN(10000));

                    await setTime(endTime);

                    await expectRevert(
                        store.setPoolProgramEndTime(poolToken.address, newEndTime, { from: manager }),
                        'ERR_POOL_NOT_PARTICIPATING'
                    );

                    await setTime(endTime.add(new BN(1000)));

                    await expectRevert(
                        store.setPoolProgramEndTime(poolToken.address, newEndTime, { from: manager }),
                        'ERR_POOL_NOT_PARTICIPATING'
                    );
                });

                it('should revert when trying to reduce a program ending time to a point in the past', async () => {
                    await setTime(startTime.add(new BN(10)));

                    await expectRevert(
                        store.setPoolProgramEndTime(poolToken.address, startTime.add(new BN(1)), { from: manager }),
                        'ERR_INVALID_DURATION'
                    );
                });

                it('should allow reducing the ending time of an ongoing program', async () => {
                    const newEndTime = endTime.sub(new BN(10));
                    await store.setPoolProgramEndTime(poolToken.address, newEndTime, { from: manager });

                    const program = await getPoolProgram(poolToken);
                    expect(program.endTime).to.be.bignumber.equal(newEndTime);
                });

                it('should allow extending an ongoing program', async () => {
                    const newEndTime = endTime.add(new BN(10000));
                    await store.setPoolProgramEndTime(poolToken.address, newEndTime, { from: manager });

                    const program = await getPoolProgram(poolToken);
                    expect(program.endTime).to.be.bignumber.equal(newEndTime);
                });
            });
        });

        context('seeder', async () => {
            const seeder = accounts[5];

            beforeEach(async () => {
                await store.grantRole(ROLE_SEEDER, seeder, { from: supervisor });
            });

            describe('pool programs', async () => {
                it('should revert when a non-seeder attempts to add programs', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(1))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: owner }
                        ),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when adding zero address pools', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [ZERO_ADDRESS],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(1))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when adding programs with invalid starting time', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now],
                            [new BN(1000)],
                            [now.add(new BN(2000))],
                            {
                                from: seeder
                            }
                        ),
                        'ERR_INVALID_TIME'
                    );
                });

                it('should revert when adding programs with invalid ending time', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            {
                                from: seeder
                            }
                        ),
                        'ERR_INVALID_DURATION'
                    );
                });

                it('should revert when adding programs with invalid reward shares', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE.sub(new BN(1)), BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            {
                                from: seeder
                            }
                        ),
                        'ERR_INVALID_REWARD_SHARES'
                    );
                });

                it('should revert when adding programs with invalid reserve tokens', async () => {
                    const invalidToken = accounts[5];

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[invalidToken, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            {
                                from: seeder
                            }
                        ),
                        'ERR_INVALID_RESERVE_TOKENS'
                    );

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, invalidToken]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            {
                                from: seeder
                            }
                        ),
                        'ERR_INVALID_RESERVE_TOKENS'
                    );
                });

                it('should revert when adding programs without any rewards', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(0)],
                            { from: seeder }
                        ),
                        'ERR_ZERO_VALUE'
                    );
                });

                it('should revert when adding programs with invalid length data', async () => {
                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address, poolToken2.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [
                                [networkToken.address, reserveToken.address],
                                [networkToken.address, reserveToken.address]
                            ],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [
                                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]
                            ],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100)), now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000)), now.add(new BN(2000))],
                            [new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.addPastPoolPrograms(
                            [poolToken.address],
                            [[networkToken.address, reserveToken.address]],
                            [[NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE]],
                            [now.sub(new BN(100))],
                            [now.add(new BN(2000))],
                            [new BN(1000), new BN(1000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );
                });

                it('should allow seeding of programs', async () => {
                    expect(await store.isPoolParticipating.call(poolToken.address)).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, networkToken.address)
                    ).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, reserveToken.address)
                    ).to.be.false();

                    expect(await store.isPoolParticipating.call(poolToken2.address)).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken2.address, networkToken.address)
                    ).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken2.address, reserveToken2.address)
                    ).to.be.false();

                    const startTime = now.sub(new BN(1000));
                    const endTime = startTime.add(new BN(2000));
                    const rewardRate = new BN(1000);

                    const startTime2 = now.sub(new BN(10));
                    const endTime2 = startTime2.add(new BN(6000));
                    const rewardRate2 = startTime2.add(new BN(9999));

                    await store.addPastPoolPrograms(
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
                        [rewardRate, rewardRate2],
                        {
                            from: seeder
                        }
                    );

                    expect(await store.isPoolParticipating.call(poolToken.address)).to.be.true();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, networkToken.address)
                    ).to.be.true();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, reserveToken.address)
                    ).to.be.true();

                    expect(await store.isPoolParticipating.call(poolToken2.address)).to.be.true();
                    expect(
                        await store.isReserveParticipating.call(poolToken2.address, networkToken.address)
                    ).to.be.true();
                    expect(
                        await store.isReserveParticipating.call(poolToken2.address, reserveToken2.address)
                    ).to.be.true();

                    let program1 = await getPoolProgram(poolToken);
                    expect(program1.startTime).to.be.bignumber.equal(startTime);
                    expect(program1.endTime).to.be.bignumber.equal(endTime);
                    expect(program1.rewardRate).to.be.bignumber.equal(rewardRate);
                    expect(program1.reserveTokens[0]).to.eql(networkToken.address);
                    expect(program1.reserveTokens[1]).to.eql(reserveToken.address);
                    expect(program1.rewardShares[0]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);
                    expect(program1.rewardShares[1]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);

                    const programs = await getPoolPrograms();
                    expect(programs.length).to.eql(2);

                    program1 = programs[0];
                    expect(program1.poolToken).to.eql(poolToken.address);
                    expect(program1.startTime).to.be.bignumber.equal(startTime);
                    expect(program1.endTime).to.be.bignumber.equal(endTime);
                    expect(program1.rewardRate).to.be.bignumber.equal(rewardRate);
                    expect(program1.reserveTokens[0]).to.eql(networkToken.address);
                    expect(program1.reserveTokens[1]).to.eql(reserveToken.address);
                    expect(program1.rewardShares[0]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);
                    expect(program1.rewardShares[1]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);

                    let program2 = await getPoolProgram(poolToken2);
                    expect(program2.startTime).to.be.bignumber.equal(startTime2);
                    expect(program2.endTime).to.be.bignumber.equal(endTime2);
                    expect(program2.rewardRate).to.be.bignumber.equal(rewardRate2);
                    expect(program2.reserveTokens[0]).to.eql(reserveToken2.address);
                    expect(program2.reserveTokens[1]).to.eql(networkToken.address);
                    expect(program2.rewardShares[0]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);
                    expect(program2.rewardShares[1]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);

                    program2 = programs[1];
                    expect(program2.poolToken).to.eql(poolToken2.address);
                    expect(program2.startTime).to.be.bignumber.equal(startTime2);
                    expect(program2.endTime).to.be.bignumber.equal(endTime2);
                    expect(program2.rewardRate).to.be.bignumber.equal(rewardRate2);
                    expect(program2.reserveTokens[0]).to.eql(reserveToken2.address);
                    expect(program2.reserveTokens[1]).to.eql(networkToken.address);
                    expect(program2.rewardShares[0]).to.be.bignumber.equal(BASE_TOKEN_REWARDS_SHARE);
                    expect(program2.rewardShares[1]).to.be.bignumber.equal(NETWORK_TOKEN_REWARDS_SHARE);
                });
            });

            describe('pool rewards', async () => {
                it('should revert when a non-seeder attempts to seed pool rewards', async () => {
                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address],
                            [networkToken.address],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            [new BN(5000)],
                            { from: owner }
                        ),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when seeding zero address pools', async () => {
                    await expectRevert(
                        store.setPoolsRewardData(
                            [ZERO_ADDRESS],
                            [networkToken.address],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            [new BN(5000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when seeding zero address reserves', async () => {
                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address],
                            [ZERO_ADDRESS],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            [new BN(5000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when seeding pools with invalid length data', async () => {
                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address, poolToken2.address],
                            [networkToken.address],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            [new BN(5000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address],
                            [networkToken.address, reserveToken.address],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            [new BN(5000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address],
                            [networkToken.address],
                            [now.sub(new BN(1)), now],
                            [new BN(1000)],
                            [new BN(5000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address],
                            [networkToken.address],
                            [now.sub(new BN(1))],
                            [new BN(1000), new BN(1)],
                            [new BN(5000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setPoolsRewardData(
                            [poolToken.address],
                            [networkToken.address],
                            [now.sub(new BN(1))],
                            [new BN(1000)],
                            [new BN(5000), new BN(100000)],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );
                });

                it('should allow seeding pools rewards', async () => {
                    expect(await store.isPoolParticipating.call(poolToken.address)).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, networkToken.address)
                    ).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken.address, reserveToken.address)
                    ).to.be.false();

                    expect(await store.isPoolParticipating.call(poolToken2.address)).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken2.address, networkToken.address)
                    ).to.be.false();
                    expect(
                        await store.isReserveParticipating.call(poolToken2.address, reserveToken2.address)
                    ).to.be.false();

                    const lastUpdateTimeN1 = now.sub(new BN(1000));
                    const rewardsPerTokenN1 = new BN(2000);
                    const totalClaimedRewardsN1 = new BN(1000);
                    const lastUpdateTimeR1 = now.add(new BN(10000));
                    const rewardsPerTokenR1 = new BN(200000);
                    const totalClaimedRewardsR1 = new BN(99999);

                    const lastUpdateTimeN2 = now.sub(new BN(111));
                    const rewardsPerTokenN2 = new BN(9999999);
                    const totalClaimedRewardsN2 = new BN(5555);
                    const lastUpdateTimeR2 = now.add(new BN(32423423));
                    const rewardsPerTokenR2 = new BN(8);
                    const totalClaimedRewardsR2 = new BN(0);

                    await store.setPoolsRewardData(
                        [poolToken.address, poolToken.address, poolToken2.address, poolToken2.address],
                        [networkToken.address, reserveToken.address, networkToken.address, reserveToken2.address],
                        [lastUpdateTimeN1, lastUpdateTimeR1, lastUpdateTimeN2, lastUpdateTimeR2],
                        [rewardsPerTokenN1, rewardsPerTokenR1, rewardsPerTokenN2, rewardsPerTokenR2],
                        [totalClaimedRewardsN1, totalClaimedRewardsR1, totalClaimedRewardsN2, totalClaimedRewardsR2],
                        { from: seeder }
                    );

                    const poolDataN1 = await getPoolRewards(poolToken, networkToken);
                    expect(poolDataN1.lastUpdateTime).to.be.bignumber.equal(lastUpdateTimeN1);
                    expect(poolDataN1.rewardPerToken).to.be.bignumber.equal(rewardsPerTokenN1);
                    expect(poolDataN1.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewardsN1);

                    const poolDataR1 = await getPoolRewards(poolToken, reserveToken);
                    expect(poolDataR1.lastUpdateTime).to.be.bignumber.equal(lastUpdateTimeR1);
                    expect(poolDataR1.rewardPerToken).to.be.bignumber.equal(rewardsPerTokenR1);
                    expect(poolDataR1.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewardsR1);

                    const poolDataN2 = await getPoolRewards(poolToken2, networkToken);
                    expect(poolDataN2.lastUpdateTime).to.be.bignumber.equal(lastUpdateTimeN2);
                    expect(poolDataN2.rewardPerToken).to.be.bignumber.equal(rewardsPerTokenN2);
                    expect(poolDataN2.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewardsN2);

                    const poolDataR2 = await getPoolRewards(poolToken2, reserveToken2);
                    expect(poolDataR2.lastUpdateTime).to.be.bignumber.equal(lastUpdateTimeR2);
                    expect(poolDataR2.rewardPerToken).to.be.bignumber.equal(rewardsPerTokenR2);
                    expect(poolDataR2.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewardsR2);
                });
            });

            describe('provider rewards', async () => {
                const provider = accounts[3];
                const provider2 = accounts[4];

                it('should revert when a non-seeder attempts to seed provider rewards', async () => {
                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: owner }
                        ),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when seeding zero address pools', async () => {
                    await expectRevert(
                        store.setProviderRewardData(
                            ZERO_ADDRESS,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when seeding zero address reserves', async () => {
                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            ZERO_ADDRESS,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when seeding with an invalid multiplier', async () => {
                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION.sub(new BN(1))],
                            { from: seeder }
                        ),
                        'ERR_INVALID_MULTIPLIER'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION.mul(new BN(3))],
                            { from: seeder }
                        ),
                        'ERR_INVALID_MULTIPLIER'
                    );
                });

                it('should revert when seeding pools with invalid length data', async () => {
                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider, provider2],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000), new BN(12)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000), new BN(5000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000), new BN(50000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now, now],
                            [new BN(5000)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000), new BN(1)],
                            [PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );

                    await expectRevert(
                        store.setProviderRewardData(
                            poolToken.address,
                            networkToken.address,
                            [provider],
                            [new BN(100000)],
                            [new BN(1000)],
                            [new BN(5000)],
                            [now],
                            [new BN(5000)],
                            [PPM_RESOLUTION, PPM_RESOLUTION],
                            { from: seeder }
                        ),
                        'ERR_INVALID_LENGTH'
                    );
                });

                it('should allow seeding provider rewards', async () => {
                    let providerRewards = await getProviderRewards(provider, poolToken, networkToken);
                    expect(providerRewards.rewardPerToken).to.be.bignumber.equal(new BN(0));

                    let providerRewards2 = await getProviderRewards(provider, poolToken, networkToken);
                    expect(providerRewards2.rewardPerToken).to.be.bignumber.equal(new BN(0));

                    const rewardPerToken = new BN(1);
                    const pendingBaseRewards = new BN(0);
                    const totalClaimedRewards = new BN(1000);
                    const effectiveStakingTime = now;
                    const baseRewardsDebt = new BN(1245);
                    const baseRewardsDebtMultiplier = PPM_RESOLUTION;

                    const rewardPerToken2 = new BN(1000000);
                    const pendingBaseRewards2 = new BN(555);
                    const totalClaimedRewards2 = new BN(13);
                    const effectiveStakingTime2 = now.add(new BN(6000));
                    const baseRewardsDebt2 = new BN(3333343);
                    const baseRewardsDebtMultiplier2 = PPM_RESOLUTION.mul(new BN(2));

                    await store.setProviderRewardData(
                        poolToken.address,
                        networkToken.address,
                        [provider, provider2],
                        [rewardPerToken, rewardPerToken2],
                        [pendingBaseRewards, pendingBaseRewards2],
                        [totalClaimedRewards, totalClaimedRewards2],
                        [effectiveStakingTime, effectiveStakingTime2],
                        [baseRewardsDebt, baseRewardsDebt2],
                        [baseRewardsDebtMultiplier, baseRewardsDebtMultiplier2],
                        { from: seeder }
                    );

                    providerRewards = await getProviderRewards(provider, poolToken, networkToken);
                    expect(providerRewards.rewardPerToken).to.be.bignumber.equal(rewardPerToken);
                    expect(providerRewards.pendingBaseRewards).to.be.bignumber.equal(pendingBaseRewards);
                    expect(providerRewards.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewards);
                    expect(providerRewards.effectiveStakingTime).to.be.bignumber.equal(effectiveStakingTime);
                    expect(providerRewards.baseRewardsDebt).to.be.bignumber.equal(baseRewardsDebt);
                    expect(providerRewards.baseRewardsDebtMultiplier).to.be.bignumber.equal(baseRewardsDebtMultiplier);

                    providerRewards2 = await getProviderRewards(provider2, poolToken, networkToken);
                    expect(providerRewards2.rewardPerToken).to.be.bignumber.equal(rewardPerToken2);
                    expect(providerRewards2.pendingBaseRewards).to.be.bignumber.equal(pendingBaseRewards2);
                    expect(providerRewards2.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewards2);
                    expect(providerRewards2.effectiveStakingTime).to.be.bignumber.equal(effectiveStakingTime2);
                    expect(providerRewards2.baseRewardsDebt).to.be.bignumber.equal(baseRewardsDebt2);
                    expect(providerRewards2.baseRewardsDebtMultiplier).to.be.bignumber.equal(
                        baseRewardsDebtMultiplier2
                    );
                });
            });
        });
    });

    describe('pool rewards data', () => {
        beforeEach(async () => {
            const startTime = now;
            const endTime = startTime.add(new BN(2000));
            const rewardRate = new BN(1000);
            await store.addPoolProgram(
                poolToken.address,
                [networkToken.address, reserveToken.address],
                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                endTime,
                rewardRate,
                { from: manager }
            );
        });

        it('should revert when a non-owner attempts to update pool rewards', async () => {
            await expectRevert(
                store.updatePoolRewardsData(
                    poolToken.address,
                    reserveToken.address,
                    new BN(0),
                    new BN(1000),
                    new BN(1000),
                    {
                        from: nonOwner
                    }
                ),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should update pool rewards data', async () => {
            let poolData = await getPoolRewards(poolToken, reserveToken);
            expect(poolData.lastUpdateTime).to.be.bignumber.equal(new BN(0));
            expect(poolData.rewardPerToken).to.be.bignumber.equal(new BN(0));
            expect(poolData.totalClaimedRewards).to.be.bignumber.equal(new BN(0));

            const lastUpdateTime = new BN(123);
            const rewardPerToken = new BN(10000);
            const totalClaimedRewards = new BN(5555555);

            await store.updatePoolRewardsData(
                poolToken.address,
                reserveToken.address,
                lastUpdateTime,
                rewardPerToken,
                totalClaimedRewards,
                {
                    from: owner
                }
            );

            poolData = await getPoolRewards(poolToken, reserveToken);
            expect(poolData.lastUpdateTime).to.be.bignumber.equal(lastUpdateTime);
            expect(poolData.rewardPerToken).to.be.bignumber.equal(rewardPerToken);
            expect(poolData.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewards);
        });
    });

    describe('provider rewards data', () => {
        const provider = accounts[5];

        beforeEach(async () => {
            const startTime = now;
            const endTime = startTime.add(new BN(2000));
            const rewardRate = new BN(1000);
            await store.addPoolProgram(
                poolToken.address,
                [networkToken.address, reserveToken.address],
                [NETWORK_TOKEN_REWARDS_SHARE, BASE_TOKEN_REWARDS_SHARE],
                endTime,
                rewardRate,
                { from: manager }
            );
        });

        it('should revert when a non-owner attempts to update provider rewards data', async () => {
            await expectRevert(
                store.updateProviderRewardsData(
                    provider,
                    poolToken.address,
                    reserveToken.address,
                    new BN(1000),
                    new BN(0),
                    new BN(0),
                    new BN(0),
                    new BN(0),
                    new BN(0),
                    {
                        from: nonOwner
                    }
                ),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should update provider rewards data', async () => {
            let providerData = await getProviderRewards(provider, poolToken, reserveToken);
            expect(providerData.rewardPerToken).to.be.bignumber.equal(new BN(0));
            expect(providerData.pendingBaseRewards).to.be.bignumber.equal(new BN(0));
            expect(providerData.totalClaimedRewards).to.be.bignumber.equal(new BN(0));
            expect(providerData.effectiveStakingTime).to.be.bignumber.equal(new BN(0));

            const rewardPerToken = new BN(10000);
            const pendingBaseRewards = new BN(123);
            const totalClaimedRewards = new BN(9999);
            const effectiveStakingTime = new BN(11111);
            const baseRewardsDebt = new BN(9999999);
            const baseRewardsDebtMultiplier = new BN(100000);
            await store.updateProviderRewardsData(
                provider,
                poolToken.address,
                reserveToken.address,
                rewardPerToken,
                pendingBaseRewards,
                totalClaimedRewards,
                effectiveStakingTime,
                baseRewardsDebt,
                baseRewardsDebtMultiplier,
                {
                    from: owner
                }
            );

            providerData = await getProviderRewards(provider, poolToken, reserveToken);
            expect(providerData.rewardPerToken).to.be.bignumber.equal(rewardPerToken);
            expect(providerData.pendingBaseRewards).to.be.bignumber.equal(pendingBaseRewards);
            expect(providerData.totalClaimedRewards).to.be.bignumber.equal(totalClaimedRewards);
            expect(providerData.effectiveStakingTime).to.be.bignumber.equal(effectiveStakingTime);
            expect(providerData.baseRewardsDebt).to.be.bignumber.equal(baseRewardsDebt);
            expect(providerData.baseRewardsDebtMultiplier).to.be.bignumber.equal(baseRewardsDebtMultiplier);
        });
    });

    describe('last claim times', () => {
        const provider = accounts[5];

        it('should revert when a non-owner attempts to update last claim time', async () => {
            await expectRevert(store.updateProviderLastClaimTime(provider, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should allow to update last claim time', async () => {
            expect(await store.providerLastClaimTime.call(provider)).to.be.bignumber.equal(new BN(0));

            await setTime(now.add(new BN(1)));
            const res = await store.updateProviderLastClaimTime(provider, { from: owner });
            expect(await store.providerLastClaimTime.call(provider)).to.be.bignumber.equal(now);
            expectEvent(res, 'ProviderLastClaimTimeUpdated', { provider, claimTime: now });

            await setTime(now.add(new BN(100000)));
            const res2 = await store.updateProviderLastClaimTime(provider, { from: owner });
            expectEvent(res2, 'ProviderLastClaimTimeUpdated', { provider, claimTime: now });
            expect(await store.providerLastClaimTime.call(provider)).to.be.bignumber.equal(now);
        });
    });
});
