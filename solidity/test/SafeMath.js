/* global artifacts, contract, it, assert, web3 */
/* eslint-disable prefer-reflect */

const TestSafeMath = artifacts.require('TestSafeMath.sol');
const utils = require('./helpers/Utils');

contract('SafeMath', () => {
    it('verifies successful addition', async () => {
        let math = await TestSafeMath.new();
        let x = 2957;
        let y = 1740;
        let z = await math.testSafeAdd.call(x, y);
        assert.equal(z, x + y);
    });

    it('should throw on addition overflow', async () => {
        let math = await TestSafeMath.new();
        let x = web3.toBigNumber('115792089237316195423570985008687907853269984665640564039457584007913129639935');
        let y = 1;

        try {
            await math.testSafeAdd.call(x, y);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies successful subtraction', async () => {
        let math = await TestSafeMath.new();
        let x = 2957;
        let y = 1740;
        let z = await math.testSafeSub.call(x, y);
        assert.equal(z, x - y);
    });

    it('should throw on subtraction with negative result', async () => {
        let math = await TestSafeMath.new();
        let x = 10;
        let y = 11;

        try {
            await math.testSafeSub.call(x, y);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies successful multiplication', async () => {
        let math = await TestSafeMath.new();
        let x = 2957;
        let y = 1740;
        let z = await math.testSafeMul.call(x, y);
        assert.equal(z, x * y);
    });

    it('should throw on multiplication overflow', async () => {
        let math = await TestSafeMath.new();
        let x = web3.toBigNumber('15792089237316195423570985008687907853269984665640564039457584007913129639935');
        let y = 2000;

        try {
            await math.testSafeMul.call(x, y);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
