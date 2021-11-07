const { expect } = require('chai');
const { BigNumber } = require('ethers');

const MathUtils = require('../helpers/MathUtils');
const Contracts = require('../../components/Contracts').default;

const { Decimal, floorSqrt, ceilSqrt, reducedRatio, normalizedRatio, accurateRatio, roundDiv } = MathUtils;

const MAX_UINT128 = Decimal(2).pow(128).sub(1);
const MAX_UINT256 = Decimal(2).pow(256).sub(1);
const SCALES = [6, 18, 30].map((n) => Decimal(10).pow(n)).concat(MAX_UINT128);
const PR_TEST_ARRAY = [MAX_UINT128, MAX_UINT256.divToInt(2), MAX_UINT256.sub(MAX_UINT128), MAX_UINT256];
const PR_MAX_ERROR = '0.00000000000000000000000000000000000001';

describe('MathEx', () => {
    let mathContract;

    before(async () => {
        mathContract = await Contracts.TestMathEx.deploy();
    });

    for (let n = 1; n <= 256; n++) {
        for (const k of n < 256 ? [-1, 0, +1] : [-1]) {
            const x = BigNumber.from(2).pow(BigNumber.from(n)).add(BigNumber.from(k));
            it(`Function floorSqrt(${x.toHexString()})`, async () => {
                const expected = floorSqrt(x);
                const actual = await mathContract.floorSqrtTest(x.toString());
                expect(actual).to.equal(BigNumber.from(expected.toFixed()));
            });
        }
    }

    for (let n = 1; n <= 256; n++) {
        for (const k of n < 256 ? [-1, 0, +1] : [-1]) {
            const x = BigNumber.from(2).pow(BigNumber.from(n)).add(BigNumber.from(k));
            it(`Function ceilSqrt(${x.toHexString()})`, async () => {
                const expected = ceilSqrt(x);
                const actual = await mathContract.ceilSqrtTest(x.toString());
                expect(actual).to.equal(BigNumber.from(expected.toFixed()));
            });
        }
    }

    for (const xn of PR_TEST_ARRAY) {
        for (const yn of PR_TEST_ARRAY) {
            for (const xd of PR_TEST_ARRAY) {
                for (const yd of PR_TEST_ARRAY) {
                    const [an, bn, ad, bd] = [xn, yn, xd, yd].map((val) => val.toHex());
                    it(`productRatio(${an}, ${bn}, ${ad}, ${bd})`, async () => {
                        const expected = MathUtils.productRatio(an, bn, ad, bd);
                        const actual = await mathContract.productRatioTest(an, bn, ad, bd);
                        expectAlmostEqual(actual, expected, { maxAbsoluteError: '0', maxRelativeError: PR_MAX_ERROR });
                    });
                }
            }
        }
    }

    for (const scale of SCALES) {
        for (let a = 0; a < 10; a++) {
            for (let b = 1; b <= 10; b++) {
                it(`reducedRatio(${a}, ${b}, ${scale.toFixed()})`, async () => {
                    const expected = reducedRatio(a, b, scale);
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
                    const expected = reducedRatio(a, b, scale);
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
                    const expected = normalizedRatio(a, b, scale);
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
                    const expected = normalizedRatio(a, b, scale);
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
                    const expected = accurateRatio(a, b, scale);
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
                    const expected = accurateRatio(a, b, scale);
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
                    const expected = accurateRatio(a, b, scale);
                    const actual = await mathContract.accurateRatioTest(a.toFixed(), b.toFixed(), scale.toFixed());
                    expectAlmostEqual(actual, expected, { maxAbsoluteError: '1.6', maxRelativeError: '0' });
                });
            }
        }
    }

    for (let n = 0; n < 10; n++) {
        for (let d = 1; d <= 10; d++) {
            it(`roundDiv(${n}, ${d})`, async () => {
                const expected = roundDiv(n, d);
                const actual = await mathContract.roundDivTest(n, d);
                expect(actual).to.equal(BigNumber.from(expected.toFixed()));
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
            expect(actual).to.equal(BigNumber.from(BigNumber.from(expected.toFixed())));
        });
    }

    for (let n = 1; n <= 77; n++) {
        for (const k of [-1, 0, +1]) {
            const x = BigNumber.from(10).pow(BigNumber.from(n)).add(BigNumber.from(k));
            it(`decimalLength(${x.toString()})`, async () => {
                const expected = x.toString().length;
                const actual = await mathContract.decimalLengthTest(x);
                expect(actual).to.equal(BigNumber.from(BigNumber.from(expected.toFixed())));
            });
        }
    }

    for (let n = 0; n < 10; n++) {
        for (let d = 1; d <= 10; d++) {
            it(`roundDivUnsafe(${n}, ${d})`, async () => {
                const expected = Math.round(n / d);
                const actual = await mathContract.roundDivUnsafeTest(n, d);
                expect(actual).to.equal(BigNumber.from(BigNumber.from(expected.toFixed())));
            });
        }
    }

    for (const methodName of ['mulDivF', 'mulDivC']) {
        for (const px of [0, 64, 128, 192, 255, 256]) {
            for (const py of [0, 64, 128, 192, 255, 256]) {
                for (const pz of [1, 64, 128, 192, 255, 256]) {
                    for (const ax of px < 256 ? [-1, 0, +1] : [-1]) {
                        for (const ay of py < 256 ? [-1, 0, +1] : [-1]) {
                            for (const az of pz < 256 ? [-1, 0, +1] : [-1]) {
                                const x = Decimal(2).pow(px).add(ax);
                                const y = Decimal(2).pow(py).add(ay);
                                const z = Decimal(2).pow(pz).add(az);
                                testMulDiv(methodName, x, y, z);
                            }
                        }
                    }
                }
            }
        }
    }

    for (const methodName of ['mulDivF', 'mulDivC']) {
        for (const px of [64, 128, 192, 256]) {
            for (const py of [64, 128, 192, 256]) {
                for (const pz of [64, 128, 192, 256]) {
                    for (const ax of [Decimal(2).pow(px >> 1), 1]) {
                        for (const ay of [Decimal(2).pow(py >> 1), 1]) {
                            for (const az of [Decimal(2).pow(pz >> 1), 1]) {
                                const x = Decimal(2).pow(px).sub(ax);
                                const y = Decimal(2).pow(py).sub(ay);
                                const z = Decimal(2).pow(pz).sub(az);
                                testMulDiv(methodName, x, y, z);
                            }
                        }
                    }
                }
            }
        }
    }

    for (const methodName of ['mulDivF', 'mulDivC']) {
        for (const px of [128, 192, 256]) {
            for (const py of [128, 192, 256]) {
                for (const pz of [128, 192, 256]) {
                    for (const ax of [3, 5, 7]) {
                        for (const ay of [3, 5, 7]) {
                            for (const az of [3, 5, 7]) {
                                const x = Decimal(2).pow(px).divToInt(ax);
                                const y = Decimal(2).pow(py).divToInt(ay);
                                const z = Decimal(2).pow(pz).divToInt(az);
                                testMulDiv(methodName, x, y, z);
                            }
                        }
                    }
                }
            }
        }
    }

    function expectAlmostEqual(actual, expected, range) {
        const x = expected[0].mul(actual[1].toString());
        const y = expected[1].mul(actual[0].toString());
        if (!x.eq(y)) {
            const absoluteError = x.sub(y).abs();
            const relativeError = x.div(y).sub(1).abs();
            expect(absoluteError.lte(range.maxAbsoluteError) || relativeError.lte(range.maxRelativeError)).to.equal(
                true,
                `\nabsoluteError = ${absoluteError.toFixed()}\nrelativeError = ${relativeError.toFixed(25)}`
            );
        }
    }

    function testMulDiv(methodName, x, y, z) {
        it(`${methodName}(${x}, ${y}, ${z})`, async () => {
            const expected = MathUtils[methodName](x, y, z);
            if (expected.lte(MAX_UINT256)) {
                const actual = await mathContract[methodName](x.toFixed(), y.toFixed(), z.toFixed());
                expect(actual).to.equal(BigNumber.from(expected.toFixed()));
            } else {
                await expect(mathContract[methodName](x.toFixed(), y.toFixed(), z.toFixed())).to.be.revertedWith(
                    'ERR_OVERFLOW'
                );
            }
        });
    }
});
