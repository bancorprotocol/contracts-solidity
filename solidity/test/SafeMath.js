const { contract } = require('@openzeppelin/test-environment');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const TestSafeMath = contract.fromArtifact('TestSafeMath');

describe('SafeMath', () => {
    let math;

    beforeEach(async () => {
        math = await TestSafeMath.new();
    });

    it('verifies successful addition', async () => {
        const x = new BN(2957);
        const y = new BN(1740);
        const z = await math.testSafeAdd.call(x, y);

        expect(z).to.be.bignumber.equal(x.add(y));
    });

    it('should revert on addition overflow', async () => {
        const x = new BN('115792089237316195423570985008687907853269984665640564039457584007913129639935');
        const y = new BN(1);

        await expectRevert(math.testSafeAdd.call(x, y), 'ERR_OVERFLOW');
    });

    it('verifies successful subtraction', async () => {
        const x = new BN(2957);
        const y = new BN(1740);
        const z = await math.testSafeSub.call(x, y);

        expect(z).to.be.bignumber.equal(x.sub(y));
    });

    it('should revert on subtraction with negative result', async () => {
        const x = new BN(10);
        const y = new BN(11);

        await expectRevert(math.testSafeSub.call(x, y), 'ERR_UNDERFLOW');
    });

    it('verifies successful multiplication', async () => {
        const x = new BN(2957);
        const y = new BN(1740);
        const z = await math.testSafeMul.call(x, y);

        expect(z).to.be.bignumber.equal(x.mul(y));
    });

    it('should revert on multiplication overflow', async () => {
        const x = new BN('15792089237316195423570985008687907853269984665640564039457584007913129639935');
        const y = new BN(2000);

        await expectRevert(math.testSafeMul.call(x, y), 'ERR_OVERFLOW');
    });

    it('verifies successful division correctly', async function () {
        const a = new BN(1000);
        const b = new BN(25);

        expect(await math.testSafeDiv(a, b)).to.be.bignumber.equal(a.div(b));
    });

    it('divides zero correctly', async function () {
        const a = new BN('0');
        const b = new BN('5678');

        expect(await math.testSafeDiv(a, b)).to.be.bignumber.equal('0');
    });

    it('should revert on on division by zero', async function () {
        const a = new BN(1234);
        const b = new BN(0);

        await expectRevert(math.testSafeDiv(a, b), 'ERR_DIVIDE_BY_ZERO');
    });
});
