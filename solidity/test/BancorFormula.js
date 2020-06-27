const { expect } = require('chai');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');

// We will be using BigNumber in some of formula tests, since it'd be much more convenient to work implicitily with
// decimal numbers.
const BigNumber = require('bignumber.js');
const Decimal = require('decimal.js');
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN });

const { MIN_PRECISION, MAX_PRECISION, maxExpArray, maxValArray } = require('./helpers/FormulaConstants');

const TestBancorFormula = artifacts.require('TestBancorFormula');

contract('BancorFormula', () => {
    let formula;
    beforeEach(async () => {
        formula = await TestBancorFormula.new();
    });

    const ILLEGAL_VAL = new BN(2).pow(new BN(256));
    const MAX_BASE_N = new BN(2).pow(new BN(256 - MAX_PRECISION)).sub(new BN(1));
    const MIN_BASE_D = new BN(1);
    const MAX_EXPONENT = 1000000;

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MAX_BASE_N.sub(new BN(1));
        const expN = MAX_EXPONENT * percent / 100;
        const expD = MAX_EXPONENT;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            await formula.powerTest.call(baseN, baseD, expN, expD);
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MAX_BASE_N.sub(new BN(1));
        const expN = MAX_EXPONENT;
        const expD = MAX_EXPONENT * percent / 100;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            await formula.powerTest.call(baseN, baseD, expN, expD);
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MIN_BASE_D;
        const expN = MAX_EXPONENT * percent / 100;
        const expD = MAX_EXPONENT;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            if (percent < 64) {
                await formula.powerTest.call(baseN, baseD, expN, expD);
            } else {
                await expectRevert.unspecified(formula.powerTest.call(baseN, baseD, expN, expD));
            }
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MIN_BASE_D;
        const expN = MAX_EXPONENT;
        const expD = MAX_EXPONENT * percent / 100;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            await expectRevert.unspecified(formula.powerTest.call(baseN, baseD, expN, expD));
        });
    }

    const values = [
        MAX_BASE_N.divRound(MIN_BASE_D),
        MAX_BASE_N.divRound(MAX_BASE_N.sub(new BN(1))),
        MIN_BASE_D.add(new BN(1)).divRound(MIN_BASE_D)
    ];

    for (const value of values) {
        it(`generalLog(0x${value.toString(16)})`, async () => {
            const retVal = await formula.generalLogTest.call(value);
            expect(retVal.mul(new BN(MAX_EXPONENT))).be.bignumber.lt(ILLEGAL_VAL);
        });
    }

    for (let precision = MIN_PRECISION; precision <= MAX_PRECISION; precision++) {
        const maxExp = new BN(maxExpArray[precision].slice(2), 16);
        const shlVal = new BN(2).pow(new BN(MAX_PRECISION - precision));
        const tuples = [
            { input: maxExp.add(new BN(0)).mul(shlVal).sub(new BN(1)), output: new BN(precision - 0) },
            { input: maxExp.add(new BN(0)).mul(shlVal).sub(new BN(0)), output: new BN(precision - 0) },
            { input: maxExp.add(new BN(1)).mul(shlVal).sub(new BN(1)), output: new BN(precision - 0) },
            { input: maxExp.add(new BN(1)).mul(shlVal).sub(new BN(0)), output: new BN(precision - 1) }
        ];

        for (const { input, output } of tuples) {
            it(`findPositionInMaxExpArray(0x${input.toString(16)})`, async () => {
                if (precision === MIN_PRECISION && output.lt(new BN(precision))) {
                    await expectRevert.unspecified(formula.findPositionInMaxExpArrayTest.call(input));
                } else {
                    const retVal = await formula.findPositionInMaxExpArrayTest.call(input);
                    expect(retVal).to.be.bignumber.equal(output);
                }
            });
        }
    }

    for (let precision = MIN_PRECISION; precision <= MAX_PRECISION; precision++) {
        const maxExp = new BN(maxExpArray[precision].slice(2), 16);
        const maxVal = new BN(maxValArray[precision].slice(2), 16);
        const errExp = maxExp.add(new BN(1));

        it(`generalExp(0x${maxExp.toString(16)}, ${precision})`, async () => {
            const retVal = await formula.generalExpTest.call(maxExp, precision);
            expect(retVal).to.be.bignumber.equal(maxVal);
        });

        it(`generalExp(0x${errExp.toString(16)}, ${precision})`, async () => {
            const retVal = await formula.generalExpTest.call(errExp, precision);
            expect(retVal).to.be.bignumber.lt(maxVal);
        });
    }

    for (let precision = MIN_PRECISION; precision <= MAX_PRECISION; precision++) {
        const minExp = new BN(maxExpArray[precision - 1].slice(2), 16).add(new BN(1));
        const minVal = new BN(2).pow(new BN(precision));

        it(`generalExp(0x${minExp.toString(16)}, ${precision})`, async () => {
            const retVal = await formula.generalExpTest.call(minExp, precision);
            expect(retVal).to.be.bignumber.gte(minVal);
        });
    }

    for (let n = 1; n <= 255; n++) {
        const tuples = [
            { input: new BN(2).pow(new BN(n)), output: new BN(n) },
            { input: new BN(2).pow(new BN(n)).add(new BN(1)), output: new BN(n) },
            { input: new BN(2).pow(new BN(n + 1)).sub(new BN(1)), output: new BN(n) }
        ];

        for (const { input, output } of tuples) {
            it(`floorLog2(0x${input.toString(16)})`, async () => {
                const retVal = await formula.floorLog2Test.call(input);
                expect(retVal).to.be.bignumber.equal(output);
            });
        }
    }

    describe('precision tests', async () => {
        const LOG_MIN = 1;
        const EXP_MIN = 0;
        const LOG_MAX = new BigNumber(Decimal.exp(1).toFixed());
        const EXP_MAX = new BigNumber(Decimal.pow(2, 4).toFixed());
        const FIXED_1 = new BigNumber(2).pow(MAX_PRECISION);
        const MIN_RATIO = new BigNumber('0.99999999999999999999999999999999999');
        const MAX_RATIO = new BigNumber(1);

        for (let percent = 0; percent < 100; percent++) {
            const x = new BigNumber(percent).dividedBy(100).multipliedBy(LOG_MAX.minus(LOG_MIN)).plus(LOG_MIN);

            it(`optimalLog(${x.toFixed()})`, async () => {
                const fixedPoint = new BigNumber(await formula.optimalLogTest(FIXED_1.multipliedBy(x).toFixed(0)));
                const floatPoint = new BigNumber(Decimal(x.toFixed()).ln().mul(FIXED_1.toFixed()).toFixed());

                const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                expect(ratio.gte(MIN_RATIO), 'below MIN_RATIO');
                expect(ratio.lte(MAX_RATIO), 'above MAX_RATIO');
            });
        }

        for (let percent = 0; percent < 100; percent++) {
            const x = new BigNumber(percent).multipliedBy(EXP_MAX.minus(EXP_MIN)).dividedBy(new BigNumber(100)).plus(EXP_MIN);

            it(`optimalExp(${x.toString()})`, async () => {
                const fixedPoint = new BigNumber(await formula.optimalExpTest.call(FIXED_1.multipliedBy(x).toFixed(0)));
                const floatPoint = new BigNumber(Decimal(x.toFixed()).exp().mul(FIXED_1.toFixed()).toFixed());

                const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                expect(ratio.gte(MIN_RATIO), 'below MIN_RATIO');
                expect(ratio.lte(MAX_RATIO), 'above MAX_RATIO');
            });
        }

        for (let n = 0; n < 256 - MAX_PRECISION; n++) {
            const values = [
                new BigNumber(2).pow(new BigNumber(n)),
                new BigNumber(2).pow(new BigNumber(n)).plus(new BigNumber(1)),
                new BigNumber(2).pow(new BigNumber(n)).multipliedBy(new BigNumber(1.5)),
                new BigNumber(2).pow(new BigNumber(n + 1)).minus(new BigNumber(1))
            ];

            for (const value of values) {
                it(`generalLog(${value.toString()})`, async () => {
                    const fixedPoint = new BigNumber(await formula.generalLogTest.call(FIXED_1.multipliedBy(value).toFixed(0)));
                    const floatPoint = new BigNumber(Decimal(value.toFixed()).ln().mul(FIXED_1.toFixed()).toFixed());

                    const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                    expect(ratio.gte(MIN_RATIO), 'below MIN_RATIO');
                    expect(ratio.lte(MAX_RATIO), 'above MAX_RATIO');
                });
            }
        }
    });
});
