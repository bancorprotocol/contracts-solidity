const { expect } = require('chai');
const { expectRevert, BN } = require('@openzeppelin/test-helpers');

// We will be using BigNumber in some of formula tests, since it'd be much more convenient to work implicitily with
// decimal numbers.
const BigNumber = require('bignumber.js');
const Decimal = require('decimal.js');

const { MIN_PRECISION, MAX_PRECISION, MAX_WEIGHT, maxExpArray, maxValArray } = require('./helpers/FormulaConstants');
const { normalizedWeights, balancedWeights } = require('./helpers/FormulaFunctions');

const TestBancorFormula = artifacts.require('TestBancorFormula');

contract('BancorFormula', () => {
    let formula;
    before(async () => {
        formula = await TestBancorFormula.new();
        await formula.init();
    });

    const ILLEGAL_VAL = new BN(2).pow(new BN(256));
    const MAX_BASE_N = new BN(2).pow(new BN(256 - MAX_PRECISION)).sub(new BN(1));
    const MIN_BASE_D = new BN(1);
    const MAX_EXP = new BN(MAX_WEIGHT);

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MAX_BASE_N.sub(new BN(1));
        const expN = MAX_EXP * percent / 100;
        const expD = MAX_EXP;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            await formula.powerTest.call(baseN, baseD, expN, expD);
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MAX_BASE_N.sub(new BN(1));
        const expN = MAX_EXP;
        const expD = MAX_EXP * percent / 100;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            await formula.powerTest.call(baseN, baseD, expN, expD);
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MIN_BASE_D;
        const expN = MAX_EXP * percent / 100;
        const expD = MAX_EXP;

        it(`power(0x${baseN.toString(16)}, 0x${baseD.toString(16)}, ${expN}, ${expD})`, async () => {
            if (percent < 64) {
                await formula.powerTest.call(baseN, baseD, expN, expD);
            }
            else {
                await expectRevert.unspecified(formula.powerTest.call(baseN, baseD, expN, expD));
            }
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MIN_BASE_D;
        const expN = MAX_EXP;
        const expD = MAX_EXP * percent / 100;

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
            expect(retVal.mul(new BN(MAX_EXP))).be.bignumber.lt(ILLEGAL_VAL);
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
                }
                else {
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
                expect(ratio.gte(MIN_RATIO)).to.be.true(`${ratio.toString()} is below MIN_RATIO`);
                expect(ratio.lte(MAX_RATIO)).to.be.true(`${ratio.toString()} is above MAX_RATIO`);
            });
        }

        for (let percent = 0; percent < 100; percent++) {
            const x = new BigNumber(percent).multipliedBy(EXP_MAX.minus(EXP_MIN)).dividedBy(new BigNumber(100)).plus(EXP_MIN);

            it(`optimalExp(${x.toString()})`, async () => {
                const fixedPoint = new BigNumber(await formula.optimalExpTest.call(FIXED_1.multipliedBy(x).toFixed(0)));
                const floatPoint = new BigNumber(Decimal(x.toFixed()).exp().mul(FIXED_1.toFixed()).toFixed());

                const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                expect(ratio.gte(MIN_RATIO)).to.be.true(`${ratio.toString()} is below MIN_RATIO`);
                expect(ratio.lte(MAX_RATIO)).to.be.true(`${ratio.toString()} is above MAX_RATIO`);
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
                    expect(ratio.gte(MIN_RATIO)).to.be.true(`${ratio.toString()} is below MIN_RATIO`);
                    expect(ratio.lte(MAX_RATIO)).to.be.true(`${ratio.toString()} is above MAX_RATIO`);
                });
            }
        }

        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`normalizedWeights(${a}, ${b})`, async () => {
                    const expectedWeights = normalizedWeights(a, b);
                    const expectedX = expectedWeights[0];
                    const expectedY = expectedWeights[1];

                    const weights = await formula.normalizedWeightsTest.call(new BN(a), new BN(b));
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.bignumber.equal(new BN(expectedX.toFixed()));
                    expect(actualY).to.be.bignumber.equal(new BN(expectedY.toFixed()));
                });
            }
        }

        for (let i = 1; i <= MAX_WEIGHT; i *= 10) {
            const a = Decimal(ILLEGAL_VAL.toString()).sub(1).divToInt(MAX_WEIGHT).mul(i).add(1);
            for (let j = 1; j <= MAX_WEIGHT; j *= 10) {
                const b = Decimal(ILLEGAL_VAL.toString()).sub(1).divToInt(MAX_WEIGHT).mul(j).add(1);
                it(`normalizedWeights(${a.toFixed()}, ${b.toFixed()})`, async () => {
                    const expectedWeights = normalizedWeights(a, b);
                    const expectedX = expectedWeights[0];
                    const expectedY = expectedWeights[1];

                    const weights = await formula.normalizedWeightsTest.call(new BN(a.toFixed()), new BN(b.toFixed()));
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.bignumber.equal(new BN(expectedX.toFixed()));
                    expect(actualY).to.be.bignumber.equal(new BN(expectedY.toFixed()));
                });
            }
        }

        for (let a = 0; a < 10; a++) {
            for (let b = Math.max(a, 1); b <= 10; b++) {
                it(`accurateWeights(${a}, ${b})`, async () => {
                    const expectedX = Math.round(MAX_WEIGHT * a / (a + b));
                    const expectedY = MAX_WEIGHT - expectedX;

                    const weights = await formula.accurateWeightsTest.call(new BN(a.toFixed()), new BN(b.toFixed()));
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.bignumber.equal(new BN(expectedX));
                    expect(actualY).to.be.bignumber.equal(new BN(expectedY));
                });
            }
        }

        for (let i = 1; i <= MAX_WEIGHT; i *= 10) {
            const a = Decimal(ILLEGAL_VAL.toString()).sub(1).divToInt(MAX_WEIGHT).mul(i).add(1);
            for (let j = 1; j <= MAX_WEIGHT; j *= 10) {
                const b = Decimal(ILLEGAL_VAL.toString()).sub(1).divToInt(MAX_WEIGHT).mul(j).add(1);
                it(`accurateWeightsTest(${a.toFixed()}, ${b.toFixed()})`, async () => {
                    const expectedWeights = normalizedWeights(a, b);
                    const expectedX = expectedWeights[0];
                    const expectedY = expectedWeights[1];

                    const weights = await formula.accurateWeightsTest.call(new BN(a.toFixed()), new BN(b.toFixed()));
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.bignumber.equal(new BN(expectedX.toFixed()));
                    expect(actualY).to.be.bignumber.equal(new BN(expectedY.toFixed()));
                });
            }
        }

        for (let n = 0; n < 10; n++) {
            for (let d = 1; d <= 10; d++) {
                it(`roundDiv(${n}, ${d})`, async () => {
                    const expected = Math.round(n / d);
                    const actual = await formula.roundDivTest.call(new BN(n.toFixed()), new BN(d.toFixed()));
                    expect(actual).to.be.bignumber.equal(new BN(expected));
                });
            }
        }

        for (const i of [-2, -1, 0, 1, 2]) {
            const n = Decimal(ILLEGAL_VAL.toString()).add(i).mod(Decimal(ILLEGAL_VAL.toString()));
            for (const j of [-2, -1, 1, 2]) {
                const d = Decimal(ILLEGAL_VAL.toString()).add(j).mod(Decimal(ILLEGAL_VAL.toString()));
                it(`roundDiv(${n.toFixed()}, ${d.toFixed()})`, async () => {
                    const expected = n.div(d).toFixed(0, Decimal.ROUND_HALF_UP);
                    const actual = await formula.roundDivTest.call(new BN(n.toFixed()), new BN(d.toFixed()));
                    expect(actual).to.be.bignumber.equal(new BN(expected));
                });
            }
        }

        const balancedWeightsExpected = (t, s, r, q, p) => {
            try {
                return balancedWeights(t, s, r, q, p);
            }
            catch (error) {
                return error.message;
            }
        };

        const balancedWeightsActual = async (t, s, r, q, p) => {
            try {
                const weights = await formula.balancedWeights(t, s, r, q, p);
                return [Decimal(weights[0].toString()), Decimal(weights[1].toString())];
            }
            catch (error) {
                return error.message;
            }
        };

        const getRatio = (a, b, c, d) => {
            if (a.isZero()) {
                return d.div(b);
            }
            if (b.isZero()) {
                return a.div(c);
            }
            return a.div(b).div(c.div(d));
        };

        for (let t = 0; t < 5; t++) {
            for (let s = 0; s < 5; s++) {
                for (let r = 0; r < 5; r++) {
                    for (let q = 0; q < 5; q++) {
                        for (let p = 0; p < 5; p++) {
                            it(`balancedWeights(${[t, s, r, q, p]})`, async () => {
                                let expected = balancedWeightsExpected(t, s, r, q, p);
                                let actual = await balancedWeightsActual(t, s, r, q, p);
                                if (Array.isArray(actual)) {
                                    const ratio = getRatio(actual[0], actual[1], expected[0], expected[1]);
                                    expect(ratio.gte('0.932714') && ratio.lte('1.078991'), `ratio = ${ratio}`);
                                }
                                else {
                                    expect(actual.startsWith('VM Exception'), actual);
                                    expect(expected.startsWith('ERR_INVALID'), expected);
                                }
                            });
                        }
                    }
                }
            }
        }
    });
});
