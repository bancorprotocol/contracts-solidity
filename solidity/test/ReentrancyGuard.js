const { expect } = require('chai');

const { BigNumber } = require('ethers');

const TestReentrancyGuard = ethers.getContractFactory('TestReentrancyGuard');
const TestReentrancyGuardAttacker = ethers.getContractFactory('TestReentrancyGuardAttacker');

describe('ReentrancyGuard', () => {
    let guard;
    let attacker;

    beforeEach(async () => {
        guard = await (await TestReentrancyGuard).deploy();
        attacker = await (await TestReentrancyGuardAttacker).deploy(guard.address);
    });

    context('safe caller', async () => {
        it('should allow calling an unprotected method', async () => {
            await attacker.run();
            expect(await guard.calls()).to.be.equal(BigNumber.from(1));
        });

        it('should allow calling a protected method', async () => {
            await attacker.setCallProtectedMethod(true);
            await attacker.run();
            expect(await guard.calls()).to.be.equal(BigNumber.from(1));
        });
    });

    context('attacker', async () => {
        beforeEach(async () => {
            await attacker.setReentrancy(true);
        });

        it('should allow reentering an unprotected method', async () => {
            await attacker.run();
            expect(await guard.calls()).to.be.equal(BigNumber.from(2));
        });

        it('should revert when attempting to reetner a protected method', async () => {
            await attacker.setCallProtectedMethod(true);
            await expect(attacker.run(), 'ERR_REENTRANCY').to.be.reverted;
        });
    });
});
