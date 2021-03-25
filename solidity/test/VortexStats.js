const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const VortexStats = contract.fromArtifact('VortexStats');

describe('VortexStats', () => {
    let stats;

    const nonOwner = accounts[1];

    beforeEach(async () => {
        stats = await VortexStats.new();
    });

    describe('construction', () => {
        it('should be properly initialized', async () => {
            expect(await stats.totalBurnedAmount.call()).to.be.bignumber.equal(new BN(0));
            expect(await stats.lastVortexTime.call()).to.be.bignumber.equal(new BN(0));
        });
    });

    describe('total burned amount', () => {
        it('should revert when a non owner attempts to increase the total burned amount', async () => {
            await expectRevert(stats.incTotalBurnedAmount(new BN(1000), { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should allow the owner to increase the total burned amount', async () => {
            let prevTotalBurnedAmount = await stats.totalBurnedAmount.call();

            const value = new BN(10000);
            await stats.incTotalBurnedAmount(value);
            expect(await await stats.totalBurnedAmount.call()).to.be.bignumber.equal(
                prevTotalBurnedAmount.add(new BN(value))
            );

            prevTotalBurnedAmount = await stats.totalBurnedAmount.call();

            const value2 = new BN(1);
            await stats.incTotalBurnedAmount(value2);
            expect(await await stats.totalBurnedAmount.call()).to.be.bignumber.equal(
                prevTotalBurnedAmount.add(new BN(value2))
            );
        });
    });

    describe('last vortex time', () => {
        it('should revert when a non owner attempts to increase the last vortex time', async () => {
            await expectRevert(stats.setLastVortexTime(new BN(1000), { from: nonOwner }), 'ERR_ACCESS_DENIED');
        });

        it('should allow the owner to increase the last vortex time', async () => {
            const value = new BN(10000);
            await stats.setLastVortexTime(value);
            expect(await await stats.lastVortexTime.call()).to.be.bignumber.equal(value);

            const value2 = new BN(1);
            await stats.setLastVortexTime(value2);
            expect(await await stats.lastVortexTime.call()).to.be.bignumber.equal(value2);
        });
    });
});
