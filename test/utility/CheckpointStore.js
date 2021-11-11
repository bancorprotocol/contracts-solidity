const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { duration } = require('../helpers/Time');
const { roles } = require('../helpers/Constants');
const { ROLE_OWNER, ROLE_SEEDER } = roles;

const Contracts = require('../../components/Contracts').default;

let checkpointStore;

let now;

let accounts;
let owner;
let seeder;
let nonSeeder;
let nonOwner;
let user;
let user2;

describe('CheckpointStore', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        seeder = accounts[1];
        nonSeeder = accounts[2];
        nonOwner = accounts[5];
        user = accounts[6];
        user2 = accounts[7];

        now = BigNumber.from(1000000000);
    });

    beforeEach(async () => {
        checkpointStore = await Contracts.TestCheckpointStore.deploy();
        await checkpointStore.setTime(now);
    });

    describe('construction', () => {
        it('should properly initialize roles', async () => {
            expect(await checkpointStore.getRoleMemberCount(ROLE_OWNER)).to.equal(BigNumber.from(1));
            expect(await checkpointStore.getRoleMemberCount(ROLE_SEEDER)).to.equal(BigNumber.from(0));

            expect(await checkpointStore.getRoleAdmin(ROLE_OWNER)).to.equal(ROLE_OWNER);
            expect(await checkpointStore.getRoleAdmin(ROLE_SEEDER)).to.equal(ROLE_OWNER);

            expect(await checkpointStore.hasRole(ROLE_OWNER, owner.address)).to.be.true;
            expect(await checkpointStore.hasRole(ROLE_SEEDER, owner.address)).to.be.false;
        });
    });

    describe('adding checkpoints', () => {
        const testCheckpoint = async (user) => {
            const res = await checkpointStore.connect(owner).addCheckpoint(user);

            await expect(res).to.emit(checkpointStore, 'CheckpointUpdated').withArgs(user, now);

            expect(await checkpointStore.checkpoint(user)).to.equal(now);
        };

        const testPastCheckpoint = async (user, time) => {
            const res = await checkpointStore.connect(seeder).addPastCheckpoint(user, time);

            await expect(res).to.emit(checkpointStore, 'CheckpointUpdated').withArgs(user, time);

            expect(await checkpointStore.checkpoint(user)).to.equal(time);
        };

        const testPastCheckpoints = async (users, times) => {
            const res = await checkpointStore.connect(seeder).addPastCheckpoints(users, times);

            for (let i = 0; i < users.length; i++) {
                await expect(res).to.emit(checkpointStore, 'CheckpointUpdated').withArgs(users[i], times[i]);

                expect(await checkpointStore.checkpoint(users[i])).to.equal(times[i]);
            }
        };

        context('owner', async () => {
            it('should allow an owner to add checkpoints', async () => {
                await testCheckpoint(user.address);

                now = now.add(duration.days(1));
                await checkpointStore.setTime(now);
                await testCheckpoint(user.address);

                await testCheckpoint(user2.address);

                now = now.add(duration.days(5));
                await checkpointStore.setTime(now);
                await testCheckpoint(user2.address);
            });

            it('should revert when a non-owner attempts to add checkpoints', async () => {
                await expect(checkpointStore.connect(nonOwner).addCheckpoint(user.address)).to.be.revertedWith(
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should revert when an owner attempts to add a checkpoint for the zero address user', async () => {
                await expect(
                    checkpointStore.connect(owner).addCheckpoint(ethers.constants.AddressZero)
                ).to.be.revertedWith('ERR_INVALID_ADDRESS');
            });

            it('should revert when an owner attempts to add checkpoints in an incorrect order', async () => {
                await testCheckpoint(user.address);

                now = now.sub(duration.days(1));
                await checkpointStore.setTime(now);

                await expect(checkpointStore.connect(owner).addCheckpoint(user.address)).to.be.revertedWith(
                    'ERR_WRONG_ORDER'
                );
            });
        });

        context('seeder', async () => {
            beforeEach(async () => {
                await checkpointStore.connect(owner).grantRole(ROLE_SEEDER, seeder.address);
            });

            it('should allow a seeder to add past checkpoints', async () => {
                let past = now.sub(BigNumber.from(20000));
                await testPastCheckpoint(user.address, past);

                past = past.add(BigNumber.from(1000));
                await testPastCheckpoint(user.address, past);

                past = past.add(BigNumber.from(5000));
                await testPastCheckpoint(user2.address, past);
            });

            it('should allow a seeder to batch add past checkpoints', async () => {
                const past = now.sub(BigNumber.from(20000));

                await testPastCheckpoints([user.address, user2.address], [past, past.add(BigNumber.from(1000))]);
            });

            it('should revert when a seeder attempts to add past checkpoints in an incorrect order', async () => {
                let past = now.sub(BigNumber.from(1));

                await testPastCheckpoint(user.address, past);

                past = past.sub(BigNumber.from(1000));

                await expect(checkpointStore.connect(seeder).addPastCheckpoint(user.address, past)).to.be.revertedWith(
                    'ERR_WRONG_ORDER'
                );
                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoints([user.address], [past])
                ).to.be.revertedWith('ERR_WRONG_ORDER');
            });

            it('should revert when a non-seeder attempts to add past checkpoints', async () => {
                const past = now.sub(BigNumber.from(1));

                await expect(
                    checkpointStore.connect(nonSeeder).addPastCheckpoint(user.address, past)
                ).to.be.revertedWith('ERR_ACCESS_DENIED');
                await expect(
                    checkpointStore.connect(nonSeeder).addPastCheckpoints([user.address], [past])
                ).to.be.revertedWith('ERR_ACCESS_DENIED');
            });

            it('should revert when a seeder attempts to add a past checkpoint for the zero address user', async () => {
                const past = now.sub(BigNumber.from(1));

                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoint(ethers.constants.AddressZero, past)
                ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoints([ethers.constants.AddressZero], [past])
                ).to.be.revertedWith('ERR_INVALID_ADDRESS');
            });

            it('should revert when a seeder attempts to add a future checkpoint', async () => {
                await expect(checkpointStore.connect(seeder).addPastCheckpoint(user.address, now)).to.be.revertedWith(
                    'ERR_INVALID_TIME'
                );
                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoints([user.address, user.address], [now, now])
                ).to.be.revertedWith('ERR_INVALID_TIME');

                const future = now.add(BigNumber.from(100));
                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoint(user.address, future)
                ).to.be.revertedWith('ERR_INVALID_TIME');
                await expect(
                    checkpointStore
                        .connect(seeder)
                        .addPastCheckpoints([user.address, user.address], [now.sub(duration.seconds(1)), future])
                ).to.be.revertedWith('ERR_INVALID_TIME');
            });

            it('should revert when a seeder attempts to add batch checkpoints in an invalid length', async () => {
                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoints([user.address], [now, now])
                ).to.be.revertedWith('ERR_INVALID_LENGTH');
                await expect(
                    checkpointStore.connect(seeder).addPastCheckpoints([user.address, user.address], [now])
                ).to.be.revertedWith('ERR_INVALID_LENGTH');
            });
        });
    });
});
