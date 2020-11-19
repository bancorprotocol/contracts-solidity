const { contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');

const TestReentrancyGuard = contract.fromArtifact('TestReentrancyGuard');
const TestReentrancyGuardAttacker = contract.fromArtifact('TestReentrancyGuardAttacker');

describe('ReentrancyGuard', () => {
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
