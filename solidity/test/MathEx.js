const { contract } = require('@openzeppelin/test-environment');
const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const Decimal = require('decimal.js');
const MathUtils = require('./helpers/MathUtils');

const MathContract = contract.fromArtifact('TestMathEx');

const MAX_UINT128 = Decimal(2).pow(128).sub(1);
const MAX_UINT256 = Decimal(2).pow(256).sub(1);
const SCALES = [6, 18, 30].map((n) => Decimal(10).pow(n)).concat(MAX_UINT128);

describe('MathEx', () => {
    let mathContract;

    before(async () => {
        mathContract = await MathContract.new();
    });

    for (let n = 1; n <= 256; n++) {
        for (const k of n < 256 ? [-1, 0, +1] : [-1]) {
            const x = new BN(2).pow(new BN(n)).add(new BN(k));
            it(`Function floorSqrt(0x${x.toString(16)})`, async () => {
                const expected = MathUtils.floorSqrt(x.toString());
                const actual = await mathContract.floorSqrtTest(x);
                expect(actual).to.be.bignumber.equal(expected);
            });
        }
    }

    for (let n = 1; n <= 256; n++) {
        for (const k of n < 256 ? [-1, 0, +1] : [-1]) {
            const x = new BN(2).pow(new BN(n)).add(new BN(k));
            it(`Function ceilSqrt(0x${x.toString(16)})`, async () => {
                const expected = MathUtils.ceilSqrt(x.toString());
                const actual = await mathContract.ceilSqrtTest(x);
                expect(actual).to.be.bignumber.equal(expected);
            });
        }
    }

    for (const scale of SCALES) {
        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`reducedRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.reducedRatio(a, b, scale);
                    const actual = await mathContract.reducedRatioTest(a, b, scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: '0' });
                });
            }
        }
    }

    for (const scale of SCALES) {
        for (let i = Decimal(1); i.lte(scale); i = i.mul(10)) {
            const a = MAX_UINT256.divToInt(scale).mul(i).add(1);
            for (let j = Decimal(1); j.lte(scale); j = j.mul(10)) {
                const b = MAX_UINT256.divToInt(scale).mul(j).add(1);
                it(`reducedRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.reducedRatio(a, b, scale);
                    const actual = await mathContract.reducedRatioTest(a.toFixed(), b.toFixed(), scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: '0.135' });
                });
            }
        }
    }

    for (const scale of SCALES) {
        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`normalizedRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.normalizedRatio(a, b, scale);
                    const actual = await mathContract.normalizedRatioTest(a, b, scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: '0.00000241' });
                });
            }
        }
    }

    for (const scale of SCALES) {
        for (let i = Decimal(1); i.lte(scale); i = i.mul(10)) {
            const a = MAX_UINT256.divToInt(scale).mul(i).add(1);
            for (let j = Decimal(1); j.lte(scale); j = j.mul(10)) {
                const b = MAX_UINT256.divToInt(scale).mul(j).add(1);
                it(`normalizedRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.normalizedRatio(a, b, scale);
                    const actual = await mathContract.normalizedRatioTest(a.toFixed(), b.toFixed(), scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: '0.135' });
                });
            }
        }
    }

    for (const scale of SCALES) {
        for (let a = 0; a < 10; a++) {
            for (let b = Math.max(a, 1); b <= 10; b++) {
                it(`accurateRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.accurateRatio(a, b, scale);
                    const actual = await mathContract.accurateRatioTest(a, b, scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: '0.0000024' });
                });
            }
        }
    }

    for (const scale of SCALES) {
        for (let i = Decimal(1); i.lte(scale); i = i.mul(10)) {
            const a = MAX_UINT256.divToInt(scale).mul(i).add(1);
            for (let j = Decimal(i); j.lte(scale); j = j.mul(10)) {
                const b = MAX_UINT256.divToInt(scale).mul(j).add(1);
                it(`accurateRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.accurateRatio(a, b, scale);
                    const actual = await mathContract.accurateRatioTest(a.toFixed(), b.toFixed(), scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: '0.135' });
                });
            }
        }
    }

    for (const scale of [1, 2, 3, 4].map((x) => Decimal(x))) {
        for (const a of [
            MAX_UINT256.div(3).floor(),
            MAX_UINT256.div(3).ceil(),
            MAX_UINT256.div(2).floor(),
            MAX_UINT256.div(2).ceil(),
            MAX_UINT256.mul(2).div(3).floor(),
            MAX_UINT256.mul(2).div(3).ceil(),
            MAX_UINT256.mul(3).div(4).floor(),
            MAX_UINT256.mul(3).div(4).ceil(),
            MAX_UINT256.sub(1),
            MAX_UINT256
        ]) {
            for (const b of [MAX_UINT256.sub(1), MAX_UINT256].filter((b) => b.gt(a))) {
                it(`accurateRatio(${a.toFixed()}, ${b.toFixed()}, ${scale.toFixed()})`, async () => {
                    const expected = MathUtils.accurateRatio(a, b, scale);
                    const actual = await mathContract.accurateRatioTest(a.toFixed(), b.toFixed(), scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '1.6', maxRelativeError: '0' });
                });
            }
        }
    }

    for (let n = 0; n < 10; n++) {
        for (let d = 1; d <= 10; d++) {
            it(`roundDiv(${n}, ${d})`, async () => {
                const expected = MathUtils.roundDiv(n, d);
                const actual = await mathContract.roundDivTest(n, d);
                expect(actual).to.be.bignumber.equal(expected);
            });
        }
    }

    for (const values of [
        [123, 456789],
        [12, 345, 6789],
        [1, 1000, 1000000, 1000000000, 1000000000000]
    ]) {
        it(`geometricMean([${values}])`, async () => {
            const expected = 10 ** (Math.round(values.join('').length / values.length) - 1);
            const actual = await mathContract.geometricMeanTest(values);
            expect(actual).to.be.bignumber.equal(new BN(expected));
        });
    }

    for (let n = 1; n <= 77; n++) {
        for (const k of [-1, 0, +1]) {
            const x = new BN(10).pow(new BN(n)).add(new BN(k));
            it(`decimalLength(${x.toString()})`, async () => {
                const expected = x.toString().length;
                const actual = await mathContract.decimalLengthTest(x);
                expect(actual).to.be.bignumber.equal(new BN(expected));
            });
        }
    }

    for (let n = 0; n < 10; n++) {
        for (let d = 1; d <= 10; d++) {
            it(`roundDivUnsafe(${n}, ${d})`, async () => {
                const expected = Math.round(n / d);
                const actual = await mathContract.roundDivUnsafeTest(n, d);
                expect(actual).to.be.bignumber.equal(new BN(expected));
            });
        }
    }

    function expectAlmostEqual(actual, expected, range) {
        const x = Decimal(expected[0]).mul(actual[1].toString());
        const y = Decimal(expected[1]).mul(actual[0].toString());
        if (!x.eq(y)) {
            const absoluteError = x.sub(y).abs();
            const relativeError = x.div(y).sub(1).abs();
            expect(absoluteError.lte(range.maxAbsoluteError) || relativeError.lte(range.maxRelativeError)).to.be.true(
                `\nabsoluteError = ${absoluteError.toFixed(25)}\nrelativeError = ${relativeError.toFixed(25)}`
            );
        }
    }
});
