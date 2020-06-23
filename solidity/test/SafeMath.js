import { expect } from 'chai';
import { expectRevert, BN } from '@openzeppelin/test-helpers';

const TestSafeMath = artifacts.require('TestSafeMath');

contract('SafeMath', () => {
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

    it('should throw on addition overflow', async () => {
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

    it('should throw on subtraction with negative result', async () => {
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

    it('should throw on multiplication overflow', async () => {
        const x = new BN('15792089237316195423570985008687907853269984665640564039457584007913129639935');
        const y = new BN(2000);

        await expectRevert(math.testSafeMul.call(x, y), 'ERR_OVERFLOW');
    });
});
