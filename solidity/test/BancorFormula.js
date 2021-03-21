const { expect } = require('chai');

const { BigNumber } = require('ethers');

// We will be using BigNumber in some of formula tests, since it'd be much more convenient to work implicitily with
// decimal numbers.
const BigNumberr = require('bignumber.js');
const Decimal = require('decimal.js');

Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN, toExpPos: 40 });

const { divRound } = require('./helpers/MathUtils');

const { MIN_PRECISION, MAX_PRECISION, MAX_WEIGHT, maxExpArray, maxValArray } = require('./helpers/FormulaConstants');
const { normalizedWeights, balancedWeights } = require('./helpers/FormulaFunctions');

const TestBancorFormula = ethers.getContractFactory('TestBancorFormula');

describe('BancorFormula', () => {
    let formula;
    before(async () => {
        formula = await (await TestBancorFormula).deploy();
        await formula.init();
    });

    const ILLEGAL_VAL = BigNumber.from(2).pow(BigNumber.from(256));
    const MAX_BASE_N = BigNumber.from(2)
        .pow(BigNumber.from(256 - MAX_PRECISION))
        .sub(BigNumber.from(1));
    const MIN_BASE_D = BigNumber.from(1);
    const MAX_EXP = BigNumber.from(MAX_WEIGHT);

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MAX_BASE_N.sub(BigNumber.from(1));
        const expN = (MAX_EXP * percent) / 100;
        const expD = MAX_EXP;

        it(`power(${baseN.toHexString()}, ${baseD.toHexString()}, ${expN}, ${expD})`, async () => {
            await formula.powerTest(baseN, baseD, expN, expD);
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MAX_BASE_N.sub(BigNumber.from(1));
        const expN = MAX_EXP;
        const expD = (MAX_EXP * percent) / 100;

        it(`power(${baseN.toHexString()}, ${baseD.toHexString()}, ${expN}, ${expD})`, async () => {
            await formula.powerTest(baseN, baseD, expN, expD);
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MIN_BASE_D;
        const expN = (MAX_EXP * percent) / 100;
        const expD = MAX_EXP;

        it(`power(${baseN.toHexString()}, ${baseD.toHexString()}, ${expN}, ${expD})`, async () => {
            if (percent < 64) {
                await formula.powerTest(baseN, baseD, expN, expD);
            } else {
                await expect(formula.powerTest(baseN, baseD, expN, expD)).to.be.reverted;
            }
        });
    }

    for (let percent = 1; percent <= 100; percent++) {
        const baseN = MAX_BASE_N;
        const baseD = MIN_BASE_D;
        const expN = MAX_EXP;
        const expD = (MAX_EXP * percent) / 100;

        it(`power(${baseN.toHexString()}, ${baseD.toHexString()}, ${expN}, ${expD})`, async () => {
            await expect(formula.powerTest(baseN, baseD, expN, expD)).to.be.reverted;
        });
    }

    const values = [
        divRound(MAX_BASE_N, MIN_BASE_D),
        divRound(MAX_BASE_N, MAX_BASE_N.sub(BigNumber.from(1))),
        divRound(MIN_BASE_D.add(BigNumber.from(1)), MIN_BASE_D)
    ];

    for (const value of values) {
        it(`generalLog(${value.toHexString()})`, async () => {
            const retVal = await formula.generalLogTest(value);
            expect(retVal.mul(BigNumber.from(MAX_EXP))).be.lt(ILLEGAL_VAL);
        });
    }

    for (let precision = MIN_PRECISION; precision <= MAX_PRECISION; precision++) {
        const maxExp = BigNumber.from(maxExpArray[precision]);
        const shlVal = BigNumber.from(2).pow(BigNumber.from(MAX_PRECISION - precision));
        const tuples = [
            {
                input: maxExp.add(BigNumber.from(0)).mul(shlVal).sub(BigNumber.from(1)),
                output: BigNumber.from(precision - 0)
            },
            {
                input: maxExp.add(BigNumber.from(0)).mul(shlVal).sub(BigNumber.from(0)),
                output: BigNumber.from(precision - 0)
            },
            {
                input: maxExp.add(BigNumber.from(1)).mul(shlVal).sub(BigNumber.from(1)),
                output: BigNumber.from(precision - 0)
            },
            {
                input: maxExp.add(BigNumber.from(1)).mul(shlVal).sub(BigNumber.from(0)),
                output: BigNumber.from(precision - 1)
            }
        ];

        for (const { input, output } of tuples) {
            it(`findPositionInMaxExpArray(${input.toHexString()})`, async () => {
                if (precision === MIN_PRECISION && output.lt(BigNumber.from(precision))) {
                    await expect(formula.findPositionInMaxExpArrayTest(input)).to.be.reverted;
                } else {
                    const retVal = await formula.findPositionInMaxExpArrayTest(input);
                    expect(retVal).to.be.equal(output);
                }
            });
        }
    }

    for (let precision = MIN_PRECISION; precision <= MAX_PRECISION; precision++) {
        const maxExp = BigNumber.from(maxExpArray[precision]);
        const maxVal = BigNumber.from(maxValArray[precision]);
        const errExp = maxExp.add(BigNumber.from(1));

        it(`generalExp(${maxExp.toHexString()}, ${precision})`, async () => {
            const retVal = await formula.generalExpTest(maxExp, precision);
            expect(retVal).to.be.equal(maxVal);
        });

        it(`generalExp(${errExp.toHexString()}, ${precision})`, async () => {
            const retVal = await formula.generalExpTest(errExp, precision);
            expect(retVal).to.be.lt(maxVal);
        });
    }

    for (let precision = MIN_PRECISION; precision <= MAX_PRECISION; precision++) {
        const minExp = BigNumber.from(maxExpArray[precision - 1]).add(BigNumber.from(1));
        const minVal = BigNumber.from(2).pow(BigNumber.from(precision));

        it(`generalExp(${minExp.toHexString()}, ${precision})`, async () => {
            const retVal = await formula.generalExpTest(minExp, precision);
            expect(retVal).to.be.gte(minVal);
        });
    }

    for (let n = 1; n <= 255; n++) {
        const tuples = [
            { input: BigNumber.from(2).pow(BigNumber.from(n)), output: BigNumber.from(n) },
            { input: BigNumber.from(2).pow(BigNumber.from(n)).add(BigNumber.from(1)), output: BigNumber.from(n) },
            {
                input: BigNumber.from(2)
                    .pow(BigNumber.from(n + 1))
                    .sub(BigNumber.from(1)),
                output: BigNumber.from(n)
            }
        ];

        for (const { input, output } of tuples) {
            it(`floorLog2(${input.toHexString()})`, async () => {
                const retVal = await formula.floorLog2Test(input);
                expect(retVal).to.be.equal(output);
            });
        }
    }

    describe('precision tests', async () => {
        const LOG_MIN = 1;
        const EXP_MIN = 0;
        const LOG_MAX = new BigNumberr(Decimal.exp(1).toFixed());
        const EXP_MAX = new BigNumberr(Decimal.pow(2, 4).toFixed());
        const FIXED_1 = new BigNumberr(2).pow(MAX_PRECISION);
        const MIN_RATIO = new BigNumberr('0.99999999999999999999999999999999999');
        const MAX_RATIO = new BigNumberr(1);

        for (let percent = 0; percent < 100; percent++) {
            const x = new BigNumberr(percent).dividedBy(100).multipliedBy(LOG_MAX.minus(LOG_MIN)).plus(LOG_MIN);

            it(`optimalLog(${x.toFixed()})`, async () => {
                const fixedPoint = new BigNumberr(
                    (await formula.optimalLogTest(FIXED_1.multipliedBy(x).toFixed(0))).toString()
                );
                const floatPoint = new BigNumberr(Decimal(x.toFixed()).ln().mul(FIXED_1.toFixed()).toFixed());

                const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                expect(ratio.gte(MIN_RATIO)).to.be.true;
                expect(ratio.lte(MAX_RATIO)).to.be.true;
            });
        }

        for (let percent = 0; percent < 100; percent++) {
            const x = new BigNumberr(percent)
                .multipliedBy(EXP_MAX.minus(EXP_MIN))
                .dividedBy(new BigNumberr(100))
                .plus(EXP_MIN);

            it(`optimalExp(${x.toString()})`, async () => {
                const fixedPoint = new BigNumberr(
                    (await formula.callStatic.optimalExpTest(FIXED_1.multipliedBy(x).toFixed(0))).toString()
                );
                const floatPoint = new BigNumberr(Decimal(x.toFixed()).exp().mul(FIXED_1.toFixed()).toFixed());

                const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                expect(ratio.gte(MIN_RATIO)).to.be.true;
                expect(ratio.lte(MAX_RATIO)).to.be.true;
            });
        }

        for (let n = 0; n < 256 - MAX_PRECISION; n++) {
            const values = [
                new BigNumberr(2).pow(new BigNumberr(n)),
                new BigNumberr(2).pow(new BigNumberr(n)).plus(new BigNumberr(1)),
                new BigNumberr(2).pow(new BigNumberr(n)).multipliedBy(new BigNumberr(1.5)),
                new BigNumberr(2).pow(new BigNumberr(n + 1)).minus(new BigNumberr(1))
            ];

            for (const value of values) {
                it(`generalLog(${value.toString()})`, async () => {
                    const fixedPoint = new BigNumberr(
                        (await formula.generalLogTest(FIXED_1.multipliedBy(value).toFixed(0))).toString()
                    );
                    const floatPoint = new BigNumberr(Decimal(value.toFixed()).ln().mul(FIXED_1.toFixed()).toFixed());

                    const ratio = fixedPoint.eq(floatPoint) ? MAX_RATIO : fixedPoint.dividedBy(floatPoint);
                    expect(ratio.gte(MIN_RATIO)).to.be.true;
                    expect(ratio.lte(MAX_RATIO)).to.be.true;
                });
            }
        }

        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`normalizedWeights(${a}, ${b})`, async () => {
                    const expectedWeights = normalizedWeights(a, b);
                    const expectedX = expectedWeights[0];
                    const expectedY = expectedWeights[1];

                    const weights = await formula.normalizedWeightsTest(BigNumber.from(a), BigNumber.from(b));
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.equal(BigNumber.from(expectedX.toFixed()));
                    expect(actualY).to.be.equal(BigNumber.from(expectedY.toFixed()));
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

                    const weights = await formula.normalizedWeightsTest(
                        BigNumber.from(a.toFixed()),
                        BigNumber.from(b.toFixed())
                    );
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.equal(BigNumber.from(expectedX.toFixed()));
                    expect(actualY).to.be.equal(BigNumber.from(expectedY.toFixed()));
                });
            }
        }

        for (let a = 0; a < 10; a++) {
            for (let b = Math.max(a, 1); b <= 10; b++) {
                it(`accurateWeights(${a}, ${b})`, async () => {
                    const expectedX = Math.round((MAX_WEIGHT * a) / (a + b));
                    const expectedY = MAX_WEIGHT - expectedX;

                    const weights = await formula.accurateWeightsTest(
                        BigNumber.from(a.toFixed()),
                        BigNumber.from(b.toFixed())
                    );
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.equal(BigNumber.from(expectedX));
                    expect(actualY).to.be.equal(BigNumber.from(expectedY));
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

                    const weights = await formula.accurateWeightsTest(
                        BigNumber.from(a.toFixed()),
                        BigNumber.from(b.toFixed())
                    );
                    const actualX = weights[0];
                    const actualY = weights[1];
                    expect(actualX).to.be.equal(BigNumber.from(expectedX.toFixed()));
                    expect(actualY).to.be.equal(BigNumber.from(expectedY.toFixed()));
                });
            }
        }

        for (let n = 0; n < 10; n++) {
            for (let d = 1; d <= 10; d++) {
                it(`roundDiv(${n}, ${d})`, async () => {
                    const expected = Math.round(n / d);
                    const actual = await formula.roundDivTest(BigNumber.from(n.toFixed()), BigNumber.from(d.toFixed()));
                    expect(actual).to.be.equal(BigNumber.from(expected));
                });
            }
        }

        for (const i of [-2, -1, 0, 1, 2]) {
            const n = Decimal(ILLEGAL_VAL.toString()).add(i).mod(Decimal(ILLEGAL_VAL.toString()));
            for (const j of [-2, -1, 1, 2]) {
                const d = Decimal(ILLEGAL_VAL.toString()).add(j).mod(Decimal(ILLEGAL_VAL.toString()));
                it(`roundDiv(${n.toFixed()}, ${d.toFixed()})`, async () => {
                    const expected = n.div(d).toFixed(0, Decimal.ROUND_HALF_UP);
                    const actual = await formula.roundDivTest(BigNumber.from(n.toFixed()), BigNumber.from(d.toFixed()));
                    expect(actual).to.be.equal(BigNumber.from(expected));
                });
            }
        }

        const balancedWeightsExpected = (t, s, r, q, p) => {
            try {
                return balancedWeights(t, s, r, q, p);
            } catch (error) {
                return error.message;
            }
        };

        const balancedWeightsActual = async (t, s, r, q, p) => {
            try {
                const weights = await formula.balancedWeights(t, s, r, q, p);
                return [Decimal(weights[0].toString()), Decimal(weights[1].toString())];
            } catch (error) {
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
                                const expected = balancedWeightsExpected(t, s, r, q, p);
                                const actual = await balancedWeightsActual(t, s, r, q, p);
                                if (Array.isArray(actual)) {
                                    const ratio = getRatio(actual[0], actual[1], expected[0], expected[1]);
                                    expect(ratio.gte('0.932714') && ratio.lte('1.078991')).to.be.true;
                                } else {
                                    expect(expected.startsWith(actual.split('revert ')[1])).to.be.true;
                                }
                            });
                        }
                    }
                }
            }
        }
    });
});
