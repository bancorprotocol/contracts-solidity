const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');

const ROLE_OWNER = web3.utils.keccak256('ROLE_OWNER');

const PPM_RESOLUTION = new BN(1000000);

describe('LiquidityProtectionSettings', () => {
    const owner = defaultSender;
    const nonOwner = accounts[1];
    const poolToken = accounts[3];
    let settings;

    beforeEach(async () => {
        settings = await LiquidityProtectionSettings.new();
    });

    it('should properly initialize roles', async () => {
        expect(await settings.getRoleMemberCount.call(ROLE_OWNER)).to.be.bignumber.equal(new BN(1));

        expect(await settings.getRoleAdmin.call(ROLE_OWNER)).to.eql(ROLE_OWNER);

        expect(await settings.hasRole.call(ROLE_OWNER, owner)).to.be.true();
    });

    describe('high tier pools', () => {
        it('should allow the owner to add a high tier pool', async () => {
            expect(await settings.isHighTierPool(poolToken)).to.be.false();
            await settings.addHighTierPool(poolToken, { from: owner });
            expect(await settings.isHighTierPool(poolToken)).to.be.true();
        });

        it('should allow the owner to remove a high tier pool', async () => {
            await settings.addHighTierPool(poolToken, { from: owner });
            expect(await settings.isHighTierPool.call(poolToken)).to.be.true();
            await settings.removeHighTierPool(poolToken, { from: owner });
            expect(await settings.isHighTierPool.call(poolToken)).to.be.false();
        });

        it('should revert when a non owner attempts to add a high tier pool', async () => {
            await expectRevert(settings.addHighTierPool(poolToken, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.isHighTierPool(poolToken)).to.be.false();
        });

        it('should revert when a non owner attempts to remove a high tier pool', async () => {
            await settings.addHighTierPool(poolToken, { from: owner });
            await expectRevert(settings.removeHighTierPool(poolToken, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            expect(await settings.isHighTierPool(poolToken)).to.be.true();
        });

        it('should revert when the owner attempts to add a high tier pool that is already defined as high tier one', async () => {
            await settings.addHighTierPool(poolToken, { from: owner });
            await expectRevert(settings.addHighTierPool(poolToken, { from: owner }), 'ERR_POOL_ALREADY_EXISTS');
        });

        it('should revert when the owner attempts to remove a high tier pool that is not defined as a high tier one', async () => {
            await expectRevert(settings.removeHighTierPool(poolToken, { from: owner }), 'ERR_POOL_DOES_NOT_EXIST');
        });
    });

    describe('token limits', () => {
        it('verifies that the owner can set the system network token limits', async () => {
            const prevMaxSystemNetworkTokenAmount = await settings.maxSystemNetworkTokenAmount.call();
            const prevMaxSystemNetworkTokenRatio = await settings.maxSystemNetworkTokenRatio.call();
            const newMaxSystemNetworkTokenAmount = new BN(100);
            const newMaxSystemNetworkTokenRatio = new BN(200);

            const res = await settings.setSystemNetworkTokenLimits(
                newMaxSystemNetworkTokenAmount,
                newMaxSystemNetworkTokenRatio
            );

            expectEvent(res, 'SystemNetworkTokenLimitsUpdated', {
                _prevMaxSystemNetworkTokenAmount: prevMaxSystemNetworkTokenAmount,
                _newMaxSystemNetworkTokenAmount: newMaxSystemNetworkTokenAmount,
                _prevMaxSystemNetworkTokenRatio: prevMaxSystemNetworkTokenRatio,
                _newMaxSystemNetworkTokenRatio: newMaxSystemNetworkTokenRatio
            });

            const maxSystemNetworkTokenAmount = await settings.maxSystemNetworkTokenAmount.call();
            const maxSystemNetworkTokenRatio = await settings.maxSystemNetworkTokenRatio.call();

            expect(maxSystemNetworkTokenAmount).not.to.be.bignumber.equal(prevMaxSystemNetworkTokenAmount);
            expect(maxSystemNetworkTokenRatio).not.to.be.bignumber.equal(prevMaxSystemNetworkTokenRatio);

            expect(maxSystemNetworkTokenAmount).to.be.bignumber.equal(newMaxSystemNetworkTokenAmount);
            expect(maxSystemNetworkTokenRatio).to.be.bignumber.equal(newMaxSystemNetworkTokenRatio);
        });

        it('should revert when a non owner attempts to set the system network token limits', async () => {
            await expectRevert(
                settings.setSystemNetworkTokenLimits(100, 200, {
                    from: nonOwner
                }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when the owner attempts to set a system network token ratio that is larger than 100%', async () => {
            await expectRevert(
                settings.setSystemNetworkTokenLimits(200, PPM_RESOLUTION.add(new BN(1))),
                'ERR_INVALID_PORTION'
            );
        });
    });

    describe('protection delays', () => {
        it('verifies that the owner can set the protection delays', async () => {
            const prevMinProtectionDelay = await settings.minProtectionDelay.call();
            const prevMaxProtectionDelay = await settings.maxProtectionDelay.call();
            const newMinProtectionDelay = new BN(100);
            const newMaxProtectionDelay = new BN(200);

            const res = await settings.setProtectionDelays(newMinProtectionDelay, 200);

            expectEvent(res, 'ProtectionDelaysUpdated', {
                _prevMinProtectionDelay: prevMinProtectionDelay,
                _newMinProtectionDelay: newMinProtectionDelay,
                _prevMaxProtectionDelay: prevMaxProtectionDelay,
                _newMaxProtectionDelay: newMaxProtectionDelay
            });

            const minProtectionDelay = await settings.minProtectionDelay.call();
            const maxProtectionDelay = await settings.maxProtectionDelay.call();

            expect(minProtectionDelay).not.to.be.bignumber.equal(prevMinProtectionDelay);
            expect(maxProtectionDelay).not.to.be.bignumber.equal(prevMaxProtectionDelay);

            expect(minProtectionDelay).to.be.bignumber.equal(newMinProtectionDelay);
            expect(maxProtectionDelay).to.be.bignumber.equal(newMaxProtectionDelay);
        });

        it('should revert when a non owner attempts to set the protection delays', async () => {
            await expectRevert(settings.setProtectionDelays(100, 200, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should revert when the owner attempts to set a minimum protection delay that is larger than the maximum delay', async () => {
            await expectRevert(settings.setProtectionDelays(200, 100), 'ERR_INVALID_PROTECTION_DELAY');
        });
    });

    describe('minimum network compensation', () => {
        it('verifies that the owner can set the minimum network compensation', async () => {
            const prevMinNetworkCompensation = await settings.minNetworkCompensation.call();
            const newMinNetworkCompensation = new BN(100);

            const res = await settings.setMinNetworkCompensation(newMinNetworkCompensation);

            expectEvent(res, 'MinNetworkCompensationUpdated', {
                _prevMinNetworkCompensation: prevMinNetworkCompensation,
                _newMinNetworkCompensation: newMinNetworkCompensation
            });

            const minNetworkCompensation = await settings.minNetworkCompensation.call();

            expect(minNetworkCompensation).not.to.be.bignumber.equal(prevMinNetworkCompensation);
            expect(minNetworkCompensation).to.be.bignumber.equal(newMinNetworkCompensation);
        });

        it('should revert when a non owner attempts to set the minimum network compensation', async () => {
            await expectRevert(settings.setMinNetworkCompensation(100, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });

    describe('lock duration', () => {
        it('verifies that the owner can set the lock duration', async () => {
            const prevLockDuration = await settings.lockDuration.call();
            const newLockDuration = new BN(100);

            const res = await settings.setLockDuration(newLockDuration);
            expectEvent(res, 'LockDurationUpdated', {
                _prevLockDuration: prevLockDuration,
                _newLockDuration: newLockDuration
            });

            const lockDuration = await settings.lockDuration.call();

            expect(lockDuration).not.to.be.bignumber.equal(prevLockDuration);
            expect(lockDuration).to.be.bignumber.equal(new BN(100));
        });

        it('should revert when a non owner attempts to set the lock duration', async () => {
            await expectRevert(settings.setLockDuration(new BN(100), { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });
    });

    describe('maximum deviation of the average rate', () => {
        it('verifies that the owner can set the maximum deviation of the average rate from the actual rate', async () => {
            expect(await settings.averageRateMaxDeviation.call()).to.be.bignumber.equal(new BN(5000));

            const res = await settings.setAverageRateMaxDeviation(new BN(30000));
            expectEvent(res, 'AverageRateMaxDeviationUpdated', {
                _prevAverageRateMaxDeviation: new BN(5000),
                _newAverageRateMaxDeviation: new BN(30000)
            });

            expect(await settings.averageRateMaxDeviation.call()).to.be.bignumber.equal(new BN(30000));
        });

        it('should revert when a non owner attempts to set the maximum deviation of the average rate from the actual rate', async () => {
            await expectRevert(
                settings.setAverageRateMaxDeviation(new BN(30000), { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });
    });
});
