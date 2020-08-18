const { expect } = require('chai');

const Decimal = require('decimal.js');

const MathUtils = require('./helpers/MathUtils');

const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');

contract('LiquidityPoolV2ConverterStateless', accounts => {
    let converter;

    const ILLEGAL_VAL = Decimal(2).pow(256);
    const SCALES = [6, 18, 30].map(n => Decimal(10).pow(n));

    before(async () => {
        const DUMMY_ADDRESS = '0x'.padEnd(42, 'f');
        converter = await LiquidityPoolV2Converter.new(DUMMY_ADDRESS, DUMMY_ADDRESS, 0);
    });

    for (const scale of SCALES) {
        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`normalizedRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expectedRatio = MathUtils.normalizedRatio(a, b, scale);
                    const expectedX = expectedRatio[0];
                    const expectedY = expectedRatio[1];
                    const actualRatio = await converter.normalizedRatioTest.call(a, b, scale.toFixed());
                    const actualX = actualRatio[0];
                    const actualY = actualRatio[1];
                    expect(actualX).to.be.bignumber.equal(expectedX);
                    expect(actualY).to.be.bignumber.equal(expectedY);
                });
            }
        }

        for (let i = Decimal(1); i.lte(scale); i = i.mul(10)) {
            const a = ILLEGAL_VAL.sub(1).divToInt(scale).mul(i).add(1);
            for (let j = Decimal(1); j.lte(scale); j = j.mul(10)) {
                const b = ILLEGAL_VAL.sub(1).divToInt(scale).mul(j).add(1);
                it(`normalizedRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expectedRatio = MathUtils.normalizedRatio(a, b, scale);
                    const expectedX = expectedRatio[0];
                    const expectedY = expectedRatio[1];
                    const actualRatio = await converter.normalizedRatioTest.call(a.toFixed(), b.toFixed(), scale.toFixed());
                    const actualX = actualRatio[0];
                    const actualY = actualRatio[1];
                    expect(actualX).to.be.bignumber.equal(expectedX);
                    expect(actualY).to.be.bignumber.equal(expectedY);
                });
            }
        }

        for (let a = 0; a < 10; a++) {
            for (let b = Math.max(a, 1); b <= 10; b++) {
                it(`accurateRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expectedRatio = MathUtils.accurateRatio(a, b, scale);
                    const expectedX = expectedRatio[0];
                    const expectedY = expectedRatio[1];
                    const actualRatio = await converter.accurateRatioTest.call(a, b, scale.toFixed());
                    const actualX = actualRatio[0];
                    const actualY = actualRatio[1];
                    expect(actualX).to.be.bignumber.equal(expectedX);
                    expect(actualY).to.be.bignumber.equal(expectedY);
                });
            }
        }

        for (let i = Decimal(1); i.lte(scale); i = i.mul(10)) {
            const a = ILLEGAL_VAL.sub(1).divToInt(scale).mul(i).add(1);
            for (let j = Decimal(1); j.lte(scale); j = j.mul(10)) {
                const b = ILLEGAL_VAL.sub(1).divToInt(scale).mul(j).add(1);
                it(`accurateRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expectedRatio = MathUtils.accurateRatio(a, b, scale);
                    const expectedX = expectedRatio[0];
                    const expectedY = expectedRatio[1];
                    const actualRatio = await converter.accurateRatioTest.call(a.toFixed(), b.toFixed(), scale.toFixed());
                    const actualX = actualRatio[0];
                    const actualY = actualRatio[1];
                    expect(actualX).to.be.bignumber.equal(expectedX);
                    expect(actualY).to.be.bignumber.equal(expectedY);
                });
            }
        }

        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`reducedRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expectedRatio = MathUtils.reducedRatio(a, b, scale);
                    const expectedX = expectedRatio[0];
                    const expectedY = expectedRatio[1];
                    const actualRatio = await converter.reducedRatioTest.call(a, b, scale.toFixed());
                    const actualX = actualRatio[0];
                    const actualY = actualRatio[1];
                    expect(actualX).to.be.bignumber.equal(expectedX);
                    expect(actualY).to.be.bignumber.equal(expectedY);
                });
            }
        }

        for (let i = Decimal(1); i.lte(scale); i = i.mul(10)) {
            const a = ILLEGAL_VAL.sub(1).divToInt(scale).mul(i).add(1);
            for (let j = Decimal(1); j.lte(scale); j = j.mul(10)) {
                const b = ILLEGAL_VAL.sub(1).divToInt(scale).mul(j).add(1);
                it(`reducedRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expectedRatio = MathUtils.reducedRatio(a, b, scale);
                    const expectedX = expectedRatio[0];
                    const expectedY = expectedRatio[1];
                    const actualRatio = await converter.reducedRatioTest.call(a.toFixed(), b.toFixed(), scale.toFixed());
                    const actualX = actualRatio[0];
                    const actualY = actualRatio[1];
                    expect(actualX).to.be.bignumber.equal(expectedX);
                    expect(actualY).to.be.bignumber.equal(expectedY);
                });
            }
        }
    }

    for (let n = 0; n < 10; n++) {
        for (let d = 1; d <= 10; d++) {
            it(`roundDiv(${n}, ${d})`, async () => {
                const expected = MathUtils.roundDiv(n, d);
                const actual = await converter.roundDivTest.call(n, d);
                expect(actual).to.be.bignumber.equal(expected);
            });
        }
    }

    for (const i of [-2, -1, 0, 1, 2]) {
        const n = ILLEGAL_VAL.add(i).mod(ILLEGAL_VAL);
        for (const j of [-2, -1, 1, 2]) {
            const d = ILLEGAL_VAL.add(j).mod(ILLEGAL_VAL);
            it(`roundDiv(${n.toFixed()}, ${d.toFixed()})`, async () => {
                const expected = MathUtils.roundDiv(n, d);
                const actual = await converter.roundDivTest.call(n.toFixed(), d.toFixed());
                expect(actual).to.be.bignumber.equal(expected);
            });
        }
    }

    for (let a = 1; a < 5; a++) {
        for (let b = 1; b < 5; b++) {
            for (let p = 1; p < 5; p++) {
                for (let q = p; q < 5; q++) {
                    const expected = MathUtils.weightedAverageIntegers(a, b, p, q);
                    it(`weightedAverageIntegers(${[a, b, p, q]}) should return ${expected}`, async () => {
                        const retVal = await converter.weightedAverageIntegersTest.call(a, b, p, q);
                        const actual = Decimal(retVal.toString());
                        expect(actual.sub(expected).abs().lte(1)).to.be.true(`but returned ${actual}`);
                    });
                }
            }
        }
    }

    for (const a of [20, 25, 30].map(x => '1'.padEnd(x, '0'))) {
        for (const b of [20, 25, 30].map(x => '1'.padEnd(x, '0'))) {
            const p = 999999;
            const q = 999999;
            const expected = MathUtils.weightedAverageIntegers(a, b, p, q);
            it(`weightedAverageIntegers(${[a, b, p, q]}) should return ${expected}`, async () => {
                const retVal = await converter.weightedAverageIntegersTest.call(a, b, p, q);
                const actual = Decimal(retVal.toString());
                expect(actual.sub(expected).abs().lte(1)).to.be.true(`but returned ${actual}`);
            });
        }
    }

    for (let a = 1; a < 5; a++) {
        for (let b = 1; b < 5; b++) {
            for (let c = 1; c < 5; c++) {
                for (let d = 1; d < 5; d++) {
                    const expected = MathUtils.compareRates(a, b, c, d);
                    it(`compareRates(${[a, b, c, d]}) should return ${expected}`, async () => {
                        const actual = await converter.compareRatesTest.call(a, b, c, d);
                        expect(actual).to.be.bignumber.equal(expected.toString());
                    });
                }
            }
        }
    }

    for (const a of [20, 25, 30].map(x => '1'.padEnd(x, '0'))) {
        for (const b of [20, 25, 30].map(x => '1'.padEnd(x, '0'))) {
            for (const c of [20, 25, 30].map(x => '1'.padEnd(x, '0'))) {
                for (const d of [20, 25, 30].map(x => '1'.padEnd(x, '0'))) {
                    const expected = MathUtils.compareRates(a, b, c, d);
                    it(`compareRates(${[a, b, c, d]}) should return ${expected}`, async () => {
                        const actual = await converter.compareRatesTest.call(a, b, c, d);
                        expect(actual).to.be.bignumber.equal(expected.toString());
                    });
                }
            }
        }
    }
});
