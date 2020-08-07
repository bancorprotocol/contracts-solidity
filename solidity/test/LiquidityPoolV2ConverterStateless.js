const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');

contract('LiquidityPoolV2ConverterStateless', accounts => {
    let converter;

    before(async () => {
        const DUMMY_ADDRESS = '0x'.padEnd(42, 'f');
        converter = await LiquidityPoolV2Converter.new(DUMMY_ADDRESS, DUMMY_ADDRESS, 0);
    });

    describe('function calculateFeeToEquilibrium', () => {
        const AMPLIFICATION_FACTOR = new BN(20);
        const WEIGHT_RESOLUTION = new BN(1000000);
        const stakedValues = [123456, 234567, 345678].map(x => AMPLIFICATION_FACTOR.mul(new BN(x)));
        const weightValues = [20, 35, 50, 65, 80].map(x => new BN(x * 10000));
        const rateValues   = [1234, 3456, 5678, 7890].map(x => new BN(x));
        const factorValues = [1, 2, 3, 4, 5].map(x => new BN(x * 10000));

        for (const tknStaked of stakedValues) {
            for (const bntStaked of stakedValues) {
                for (const tknWeight of weightValues) {
                    for (const tknRate of rateValues) {
                        for (const bntRate of rateValues) {
                            for (const feeFactor of factorValues) {
                                const bntWeight = WEIGHT_RESOLUTION.sub(tknWeight);
                                const x = tknStaked.mul(tknRate).mul(bntWeight);
                                const y = bntStaked.mul(bntRate).mul(tknWeight);
                                const expected = y.gt(x) ? y.sub(x).mul(feeFactor).mul(AMPLIFICATION_FACTOR).div(y) : new BN(0);
                                it(`should return ${expected.toString()}`, async () => {
                                    const actual = await converter.calculateFeeToEquilibriumTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, feeFactor);
                                    expect(actual).to.be.bignumber.equal(expected);
                                });
                            }
                        }
                    }
                }
            }
        }
    });
});
