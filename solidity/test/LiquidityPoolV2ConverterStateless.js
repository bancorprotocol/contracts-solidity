const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');

contract('LiquidityPoolV2ConverterStateless', accounts => {
    let converter;

    before(async () => {
        const DUMMY_ADDRESS = '0x'.padEnd(42, 'f');
        converter = await LiquidityPoolV2Converter.new(DUMMY_ADDRESS, DUMMY_ADDRESS, 0);
    });

    describe('dynamic-fee:', () => {
        const AMPLIFICATION_FACTOR = new BN(20);
        const stakedValues = [1234, 2345, 3456, 4567, 5678, 6789].map(x => AMPLIFICATION_FACTOR.mul(new BN(x)));
        const factorValues = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(x => new BN(x * 10000));
        const tknWeight = new BN(1);
        const bntWeight = new BN(1);
        const tknRate = new BN(1);
        const bntRate = new BN(1);

        for (const tknStaked of stakedValues) {
            for (const bntStaked of stakedValues) {
                for (const feeFactor of factorValues) {
                    const x = tknStaked.mul(tknRate).mul(bntWeight);
                    const y = bntStaked.mul(bntRate).mul(tknWeight);
                    const expected = y.gt(x) ? y.sub(x).mul(feeFactor).mul(AMPLIFICATION_FACTOR).div(y) : new BN(0);
                    it(`calculateFeeToEquilibrium(${[tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, feeFactor]}) = ${expected.toString()}`, async () => {
                        const actual = await converter.calculateFeeToEquilibriumTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, feeFactor);
                        expect(actual).to.be.bignumber.equal(expected);
                    });
                }
            }
        }
    });
});
