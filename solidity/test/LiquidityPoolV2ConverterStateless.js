const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');

contract('LiquidityPoolV2ConverterStateless', accounts => {
    let converter;

    before(async () => {
        const DUMMY_ADDRESS = '0x'.padEnd(42, 'f');
        converter = await LiquidityPoolV2Converter.new(DUMMY_ADDRESS, DUMMY_ADDRESS, 0);
    });

    describe('adjusted-fee', () => {
        const AMPLIFICATION_FACTOR = new BN(20);
        const bntStaked = AMPLIFICATION_FACTOR.mul(new BN(4));
        const tknWeight = new BN(1);
        const bntWeight = new BN(1);
        const tknRate = new BN(1);
        const bntRate = new BN(1);
        const feeFactor = new BN(10000);

        for (let n = -3; n <= 5; n++) {
            const expected = BN.min(BN.max(feeFactor.div(new BN(2)), feeFactor.mul(new BN(4)).div(new BN(4 + n))), feeFactor.mul(new BN(2)));
            it(`calculateAdjustedFee should return ${expected.toString()}`, async () => {
                const tknStaked = bntStaked.add(new BN(n));
                const actual = await converter.calculateAdjustedFeeTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, feeFactor);
                expect(actual).to.be.bignumber.equal(expected);
            });
        }
    });
});
