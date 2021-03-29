import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import Constants from './helpers/Constants';
const { ROLE_OWNER, ROLE_SEEDER } = Constants.roles;

import Utils from './helpers/Utils';
import Contracts from './helpers/Contracts';
import { TestCheckpointStore } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

let checkpointStore: TestCheckpointStore;

let now: BigNumber;

let accounts: SignerWithAddress[];
let owner: SignerWithAddress;
let seeder: SignerWithAddress;
let nonSeeder: SignerWithAddress;
let nonOwner: SignerWithAddress;
let user: SignerWithAddress;
let user2: SignerWithAddress;

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
            expect(await checkpointStore.getRoleMemberCount(ROLE_OWNER)).to.be.equal(BigNumber.from(1));
            expect(await checkpointStore.getRoleMemberCount(ROLE_SEEDER)).to.be.equal(BigNumber.from(0));

            expect(await checkpointStore.getRoleAdmin(ROLE_OWNER)).to.eql(ROLE_OWNER);
            expect(await checkpointStore.getRoleAdmin(ROLE_SEEDER)).to.eql(ROLE_OWNER);

            expect(await checkpointStore.hasRole(ROLE_OWNER, owner.address)).to.be.true;
            expect(await checkpointStore.hasRole(ROLE_SEEDER, owner.address)).to.be.false;
        });
    });

    describe('adding checkpoints', () => {
        const testCheckpoint = async (user: string) => {
            const res = await checkpointStore.connect(owner).addCheckpoint(user);

            expect(res).to.emit(checkpointStore, 'CheckpointUpdated').withArgs(user, now);

            expect(await checkpointStore.checkpoint(user)).to.be.equal(now);
        };

        const testPastCheckpoint = async (user: string, time: BigNumber) => {
            const res = await checkpointStore.connect(seeder).addPastCheckpoint(user, time);

            expect(res).to.emit(checkpointStore, 'CheckpointUpdated').withArgs(user, time);

            expect(await checkpointStore.checkpoint(user)).to.be.equal(time);
        };

        const testPastCheckpoints = async (users: string[], times: BigNumber[]) => {
            const res = await checkpointStore.connect(seeder).addPastCheckpoints(users, times);

            for (let i = 0; i < users.length; i++) {
                expect(res).to.emit(checkpointStore, 'CheckpointUpdated').withArgs(users[i], times[i]);

                expect(await checkpointStore.checkpoint(users[i])).to.be.equal(times[i]);
            }
        };

        context('owner', async () => {
            it('should allow an owner to add checkpoints', async () => {
                await testCheckpoint(user.address);

                now = now.add(Utils.duration.days(1));
                await checkpointStore.setTime(now);
                await testCheckpoint(user.address);

                await testCheckpoint(user2.address);

                now = now.add(Utils.duration.days(5));
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

                now = now.sub(Utils.duration.days(1));
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
                        .addPastCheckpoints([user.address, user.address], [now.sub(Utils.duration.seconds(1)), future])
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
