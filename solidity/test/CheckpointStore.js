const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN, time } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { roles } = require('./helpers/Constants');

const { ZERO_ADDRESS } = constants;
const { duration } = time;
const { ROLE_OWNER, ROLE_SEEDER } = roles;

const CheckpointStore = contract.fromArtifact('TestCheckpointStore');

describe('CheckpointStore', () => {
    const owner = defaultSender;
    const seeder = accounts[1];
    const nonOwner = accounts[5];
    const user = accounts[6];
    const user2 = accounts[7];

    let checkpointStore;
    let now = new BN(1000000000);

    beforeEach(async () => {
        checkpointStore = await CheckpointStore.new({ from: owner });
        await checkpointStore.setTime(now);
    });

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            expect(await checkpointStore.getRoleMemberCount.call(ROLE_OWNER)).to.be.bignumber.equal(new BN(1));
            expect(await checkpointStore.getRoleMemberCount.call(ROLE_SEEDER)).to.be.bignumber.equal(new BN(0));

            expect(await checkpointStore.getRoleAdmin.call(ROLE_OWNER)).to.eql(ROLE_OWNER);
            expect(await checkpointStore.getRoleAdmin.call(ROLE_SEEDER)).to.eql(ROLE_OWNER);

            expect(await checkpointStore.hasRole.call(ROLE_OWNER, owner)).to.be.true();
            expect(await checkpointStore.hasRole.call(ROLE_SEEDER, owner)).to.be.false();
        });
    });

    describe('adding checkpoints', () => {
        const testCheckpoint = async (user) => {
            const res = await checkpointStore.addCheckpoint(user, { from: owner });

            expectEvent(res, 'CheckpointUpdated', {
                _address: user,
                _time: now
            });

            expect(await checkpointStore.checkpoint.call(user)).to.be.bignumber.equal(now);
        };

        const testPastCheckpoint = async (user, time) => {
            const res = await checkpointStore.addPastCheckpoint(user, time, { from: seeder });

            expectEvent(res, 'CheckpointUpdated', {
                _address: user,
                _time: time
            });

            expect(await checkpointStore.checkpoint.call(user)).to.be.bignumber.equal(time);
        };

        const testPastCheckpoints = async (users, times) => {
            const res = await checkpointStore.addPastCheckpoints(users, times, { from: seeder });

            for (let i = 0; i < users.length; i++) {
                expectEvent(res, 'CheckpointUpdated', {
                    _address: users[i],
                    _time: times[i]
                });

                expect(await checkpointStore.checkpoint.call(users[i])).to.be.bignumber.equal(times[i]);
            }
        };

        context('owner', async () => {
            it('should allow an owner to add checkpoints', async () => {
                await testCheckpoint(user);

                now = now.add(duration.days(1));
                await checkpointStore.setTime(now);
                await testCheckpoint(user);

                await testCheckpoint(user2);

                now = now.add(duration.days(5));
                await checkpointStore.setTime(now);
                await testCheckpoint(user2);
            });

            it('should revert when a non-owner attempts to add checkpoints', async () => {
                await expectRevert(checkpointStore.addCheckpoint(user, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when an owner attempts to add a checkpoint for the zero address user', async () => {
                await expectRevert(checkpointStore.addCheckpoint(ZERO_ADDRESS, { from: owner }), 'ERR_INVALID_ADDRESS');
            });

            it('should revert when an owner attempts to add checkpoints in an incorrect order', async () => {
                await testCheckpoint(user);

                now = now.sub(duration.days(1));
                await checkpointStore.setTime(now);

                await expectRevert(checkpointStore.addCheckpoint(user, { from: owner }), 'ERR_WRONG_ORDER');
            });
        });

        context('seeder', async () => {
            const nonSeeder = accounts[2];
            let initTime;

            beforeEach(async () => {
                await checkpointStore.grantRole(ROLE_SEEDER, seeder, { from: owner });
            });

            it('should allow a seeder to add past checkpoints', async () => {
                let past = now.sub(new BN(20000));
                await testPastCheckpoint(user, past);

                past = past.add(new BN(1000));
                await testPastCheckpoint(user, past);

                past = past.add(new BN(5000));
                await testPastCheckpoint(user2, past);
            });

            it('should allow a seeder to batch add past checkpoints', async () => {
                const past = now.sub(new BN(20000));

                await testPastCheckpoints([user, user2], [past, past.add(new BN(1000))]);
            });

            it('should revert when a seeder attempts to add past checkpoints in an incorrect order', async () => {
                let past = now.sub(new BN(1));

                await testPastCheckpoint(user, past);

                past = past.sub(new BN(1000));

                await expectRevert(checkpointStore.addPastCheckpoint(user, past, { from: seeder }), 'ERR_WRONG_ORDER');
                await expectRevert(
                    checkpointStore.addPastCheckpoints([user], [past], { from: seeder }),
                    'ERR_WRONG_ORDER'
                );
            });

            it('should revert when a non-seeder attempts to add past checkpoints', async () => {
                const past = now.sub(new BN(1));

                await expectRevert(
                    checkpointStore.addPastCheckpoint(user, past, { from: nonSeeder }),
                    'ERR_ACCESS_DENIED'
                );
                await expectRevert(
                    checkpointStore.addPastCheckpoints([user], [past], { from: nonSeeder }),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should revert when a seeder attempts to add a past checkpoint for the zero address user', async () => {
                const past = now.sub(new BN(1));

                await expectRevert(
                    checkpointStore.addPastCheckpoint(ZERO_ADDRESS, past, { from: seeder }),
                    'ERR_INVALID_ADDRESS'
                );
                await expectRevert(
                    checkpointStore.addPastCheckpoints([ZERO_ADDRESS], [past], { from: seeder }),
                    'ERR_INVALID_ADDRESS'
                );
            });

            it('should revert when a seeder attempts to add a future checkpoint', async () => {
                await expectRevert(checkpointStore.addPastCheckpoint(user, now, { from: seeder }), 'ERR_INVALID_TIME');
                await expectRevert(
                    checkpointStore.addPastCheckpoints([user, user], [now, now], { from: seeder }),
                    'ERR_INVALID_TIME'
                );

                const future = now.add(new BN(100));
                await expectRevert(
                    checkpointStore.addPastCheckpoint(user, future, { from: seeder }),
                    'ERR_INVALID_TIME'
                );
                await expectRevert(
                    checkpointStore.addPastCheckpoints([user, user], [now.sub(duration.seconds(1)), future], {
                        from: seeder
                    }),
                    'ERR_INVALID_TIME'
                );
            });

            it('should revert when a seeder attempts to add batch checkpoints in an invalid length', async () => {
                await expectRevert(
                    checkpointStore.addPastCheckpoints([user], [now, now], { from: seeder }),
                    'ERR_INVALID_LENGTH'
                );
                await expectRevert(
                    checkpointStore.addPastCheckpoints([user, user], [now], { from: seeder }),
                    'ERR_INVALID_LENGTH'
                );
            });
        });
    });
});
