const { expect } = require('chai');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { BN } = require('@openzeppelin/test-helpers/src/setup');

const TestReentrancyGuard = artifacts.require('TestReentrancyGuard');
const TestReentrancyGuardAttacker = artifacts.require('TestReentrancyGuardAttacker');

contract('ReentrancyGuard', () => {
    let guard;
    let attacker;

    beforeEach(async () => {
        guard = await TestReentrancyGuard.new();
        attacker = await TestReentrancyGuardAttacker.new(guard.address);
    });

    context('safe caller', async () => {
        it('should allow calling an unprotected method', async () => {
            await attacker.run();
            expect(await guard.calls.call()).to.be.bignumber.equal(new BN(1));
        });

        it('should allow calling a protected method', async () => {
            await attacker.setCallProtectedMethod(true);
            await attacker.run();
            expect(await guard.calls.call()).to.be.bignumber.equal(new BN(1));
        });
    });

    context('attacker', async () => {
        beforeEach(async () => {
            await attacker.setReentrancy(true);
        });

        it('should allow reentering an unprotected method', async () => {
            await attacker.run();
            expect(await guard.calls.call()).to.be.bignumber.equal(new BN(2));
        });

        it('should revert when attempting to reetner a protected method', async () => {
            await attacker.setCallProtectedMethod(true);
            await expectRevert(attacker.run(), 'ERR_REENTRANCY');
        });
    });
});
