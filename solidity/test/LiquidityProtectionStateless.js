const { defaultSender, contract } = require('@openzeppelin/test-environment');
const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const Decimal = require('decimal.js');

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionStore = contract.fromArtifact('LiquidityProtectionStore');
const LiquidityProtectionStats = contract.fromArtifact('LiquidityProtectionStats');
const TokenGovernance = contract.fromArtifact('TestTokenGovernance');
const CheckpointStore = contract.fromArtifact('TestCheckpointStore');
const LiquidityProtection = contract.fromArtifact('TestLiquidityProtection');

const MIN_AMOUNT = Decimal(2).pow(0);
const MAX_AMOUNT = Decimal(2).pow(127);

const MIN_RATIO = Decimal(2).pow(256 / 4);
const MAX_RATIO = Decimal(2).pow(256 / 3);

const MIN_DURATION = 30 * 24 * 60 * 60;
const MAX_DURATION = 100 * 24 * 60 * 60;

describe('LiquidityProtectionStateless', () => {
    let liquidityProtection;

    before(async () => {
        const liquidityProtectionSettings = await LiquidityProtectionSettings.new(defaultSender, defaultSender);
        const liquidityProtectionStore = await LiquidityProtectionStore.new();
        const liquidityProtectionStats = await LiquidityProtectionStats.new();
        const networkTokenGovernance = await TokenGovernance.new(defaultSender);
        const govTokenGovernance = await TokenGovernance.new(defaultSender);
        const checkpointStore = await CheckpointStore.new();

        liquidityProtection = await LiquidityProtection.new(
            liquidityProtectionSettings.address,
            liquidityProtectionStore.address,
            liquidityProtectionStats.address,
            networkTokenGovernance.address,
            govTokenGovernance.address,
            checkpointStore.address
        );
    });

    describe('sanity part 1', () => {
        const amounts = [new BN(MIN_AMOUNT.toFixed()), new BN(MIN_AMOUNT.mul(MAX_RATIO).floor().toFixed())];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '1';
        const range = {
            maxAbsoluteError: Infinity,
            maxRelativeError: Infinity
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('sanity part 2', () => {
        const amounts = [new BN(MAX_AMOUNT.div(MIN_RATIO).ceil().toFixed()), new BN(MAX_AMOUNT.toFixed())];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '1';
        const range = {
            maxAbsoluteError: Infinity,
            maxRelativeError: Infinity
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 1', () => {
        const amounts = [new BN(MIN_AMOUNT.toFixed()), new BN(MIN_AMOUNT.mul(MAX_RATIO).floor().toFixed())];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '0.25';
        const range = {
            maxAbsoluteError: '1.2',
            maxRelativeError: '0.0000000000003'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 2', () => {
        const amounts = [new BN(MAX_AMOUNT.div(MIN_RATIO).ceil().toFixed()), new BN(MAX_AMOUNT.toFixed())];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '0.75';
        const range = {
            maxAbsoluteError: '0.0',
            maxRelativeError: '0.0000000000000000007'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 3', () => {
        const amounts = [new BN(MAX_AMOUNT.toFixed())];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '1';
        const range = {
            maxAbsoluteError: '0',
            maxRelativeError: '0'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 4', () => {
        const amounts = [new BN('123456789123456789'), new BN('987654321987654321')];
        const durations = [Math.floor((MIN_DURATION + MAX_DURATION) / 2)];
        const deviation = '1';
        const range = {
            maxAbsoluteError: '1.6',
            maxRelativeError: '0.000000000000000003'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 5', () => {
        const poolAmounts = [31, 63, 127].map((x) => new BN(2).pow(new BN(x)));
        const poolRateNs = [24, 30, 36].map((x) => new BN(10).pow(new BN(x)));
        const poolRateDs = [23, 47, 95].map((x) => new BN(x).pow(new BN(18)));
        const addRateNs = [24, 30, 36].map((x) => new BN(10).pow(new BN(x)));
        const addRateDs = [23, 47, 95].map((x) => new BN(x).pow(new BN(18)));
        const removeRateNs = [24, 30, 36].map((x) => new BN(10).pow(new BN(x)));
        const removeRateDs = [23, 47, 95].map((x) => new BN(x).pow(new BN(18)));
        const range = {
            maxAbsoluteError: '1.0',
            maxRelativeError: '0.0000000005'
        };
        protectedAmountPlusFeeTest(
            poolAmounts,
            poolRateNs,
            poolRateDs,
            addRateNs,
            addRateDs,
            removeRateNs,
            removeRateDs,
            range
        );
    });

    describe('accuracy part 6', () => {
        const initialRateNs = [18, 24, 30, 36].map((x) => new BN(10).pow(new BN(x)));
        const initialRateDs = [11, 23, 47, 95].map((x) => new BN(x).pow(new BN(18)));
        const currentRateNs = [18, 24, 30, 36].map((x) => new BN(10).pow(new BN(x)));
        const currentRateDs = [11, 23, 47, 95].map((x) => new BN(x).pow(new BN(18)));
        const range = {
            maxAbsoluteError:
                '0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006',
            maxRelativeError:
                '0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000174'
        };
        impLossTest(initialRateNs, initialRateDs, currentRateNs, currentRateDs, range);
    });

    describe('accuracy part 7', () => {
        const amounts = [31, 63, 127].map((x) => new BN(2).pow(new BN(x)));
        const fees = [30, 60, 90].map((x) => new BN(2).pow(new BN(x)));
        const lossNs = [12, 15, 18].map((x) => new BN(10).pow(new BN(x)));
        const lossDs = [18, 24, 30].map((x) => new BN(10).pow(new BN(x)));
        const levelNs = [3, 5, 7].map((x) => new BN(x).pow(new BN(10)));
        const levelDs = [7, 9, 11].map((x) => new BN(x).pow(new BN(10)));
        const range = {
            maxAbsoluteError: '1.0',
            maxRelativeError: '0.0000000006'
        };
        compensationAmountTest(amounts, fees, lossNs, lossDs, levelNs, levelDs, range);
    });

    function removeLiquidityTargetAmountTest(amounts, durations, deviation, range) {
        let testNum = 0;
        const numOfTest = amounts.length ** 10 * durations.length ** 1;

        for (const poolTokenRateN of amounts) {
            for (const poolTokenRateD of amounts) {
                for (const poolAmount of amounts) {
                    for (const reserveAmount of amounts) {
                        for (const addSpotRateN of amounts) {
                            for (const addSpotRateD of amounts) {
                                for (const removeSpotRateN of amounts.map((amount) =>
                                    fixedDev(amount, addSpotRateN, deviation)
                                )) {
                                    for (const removeSpotRateD of amounts.map((amount) =>
                                        fixedDev(amount, addSpotRateD, deviation)
                                    )) {
                                        for (const removeAverageRateN of amounts.map((amount) =>
                                            fixedDev(amount, removeSpotRateN, deviation)
                                        )) {
                                            for (const removeAverageRateD of amounts.map((amount) =>
                                                fixedDev(amount, removeSpotRateD, deviation)
                                            )) {
                                                for (const timeElapsed of durations) {
                                                    testNum += 1;
                                                    const testDesc = JSON.stringify({
                                                        poolTokenRateN,
                                                        poolTokenRateD,
                                                        poolAmount,
                                                        reserveAmount,
                                                        addSpotRateN,
                                                        addSpotRateD,
                                                        removeSpotRateN,
                                                        removeSpotRateD,
                                                        removeAverageRateN,
                                                        removeAverageRateD,
                                                        timeElapsed
                                                    })
                                                        .split('"')
                                                        .join('')
                                                        .slice(1, -1);
                                                    it(`test ${testNum} out of ${numOfTest}: ${testDesc}`, async () => {
                                                        const actual = await liquidityProtection.removeLiquidityTargetAmountTest.call(
                                                            poolTokenRateN,
                                                            poolTokenRateD,
                                                            poolAmount,
                                                            reserveAmount,
                                                            addSpotRateN,
                                                            addSpotRateD,
                                                            removeSpotRateN,
                                                            removeSpotRateD,
                                                            removeAverageRateN,
                                                            removeAverageRateD,
                                                            0,
                                                            timeElapsed
                                                        );
                                                        const expected = removeLiquidityTargetAmount(
                                                            poolTokenRateN,
                                                            poolTokenRateD,
                                                            poolAmount,
                                                            reserveAmount,
                                                            addSpotRateN,
                                                            addSpotRateD,
                                                            removeSpotRateN,
                                                            removeSpotRateD,
                                                            removeAverageRateN,
                                                            removeAverageRateD,
                                                            timeElapsed
                                                        );
                                                        expectAlmostEqual(Decimal(actual.toString()), expected, range);
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function protectedAmountPlusFeeTest(
        poolAmounts,
        poolRateNs,
        poolRateDs,
        addRateNs,
        addRateDs,
        removeRateNs,
        removeRateDs,
        range
    ) {
        let testNum = 0;
        const numOfTest = [
            poolAmounts,
            poolRateNs,
            poolRateDs,
            addRateNs,
            addRateDs,
            removeRateNs,
            removeRateDs
        ].reduce((a, b) => a * b.length, 1);

        for (const poolAmount of poolAmounts) {
            for (const poolRateN of poolRateNs) {
                for (const poolRateD of poolRateDs) {
                    for (const addRateN of addRateNs) {
                        for (const addRateD of addRateDs) {
                            for (const removeRateN of removeRateNs) {
                                for (const removeRateD of removeRateDs) {
                                    testNum += 1;
                                    const testDesc = `compensationAmount(${poolAmount}, ${poolRateN}/${poolRateD}, ${addRateN}/${addRateD}, ${removeRateN}/${removeRateD})`;
                                    it(`test ${testNum} out of ${numOfTest}: ${testDesc}`, async () => {
                                        const expected = protectedAmountPlusFee(
                                            poolAmount,
                                            poolRateN,
                                            poolRateD,
                                            addRateN,
                                            addRateD,
                                            removeRateN,
                                            removeRateD
                                        );
                                        const actual = await liquidityProtection.protectedAmountPlusFeeTest(
                                            poolAmount,
                                            poolRateN,
                                            poolRateD,
                                            addRateN,
                                            addRateD,
                                            removeRateN,
                                            removeRateD
                                        );
                                        expectAlmostEqual(Decimal(actual.toString()), expected, range);
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function impLossTest(initialRateNs, initialRateDs, currentRateNs, currentRateDs, range) {
        let testNum = 0;
        const numOfTest = [initialRateNs, initialRateDs, currentRateNs, currentRateDs].reduce(
            (a, b) => a * b.length,
            1
        );

        for (const initialRateN of initialRateNs) {
            for (const initialRateD of initialRateDs) {
                for (const currentRateN of currentRateNs) {
                    for (const currentRateD of currentRateDs) {
                        testNum += 1;
                        const testDesc = `impLoss(${initialRateN}/${initialRateD}, ${currentRateN}/${currentRateD})`;
                        it(`test ${testNum} out of ${numOfTest}: ${testDesc}`, async () => {
                            const expected = impLoss(initialRateN, initialRateD, currentRateN, currentRateD);
                            const actual = await liquidityProtection.impLossTest(
                                initialRateN,
                                initialRateD,
                                currentRateN,
                                currentRateD
                            );
                            expectAlmostEqual(Decimal(actual[0].toString()).div(actual[1].toString()), expected, range);
                        });
                    }
                }
            }
        }
    }

    function compensationAmountTest(amounts, fees, lossNs, lossDs, levelNs, levelDs, range) {
        let testNum = 0;
        const numOfTest = [amounts, fees, lossNs, lossDs, levelNs, levelDs].reduce((a, b) => a * b.length, 1);

        for (const amount of amounts) {
            for (const fee of fees) {
                const total = amount.add(fee);
                for (const lossN of lossNs) {
                    for (const lossD of lossDs) {
                        for (const levelN of levelNs) {
                            for (const levelD of levelDs) {
                                testNum += 1;
                                const testDesc = `compensationAmount(${amount}, ${total}, ${lossN}/${lossD}, ${levelN}/${levelD})`;
                                it(`test ${testNum} out of ${numOfTest}: ${testDesc}`, async () => {
                                    const expected = compensationAmount(amount, total, lossN, lossD, levelN, levelD);
                                    const actual = await liquidityProtection.compensationAmountTest(
                                        amount,
                                        total,
                                        lossN,
                                        lossD,
                                        levelN,
                                        levelD
                                    );
                                    expectAlmostEqual(Decimal(actual.toString()), expected, range);
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    function removeLiquidityTargetAmount(
        poolTokenRateN,
        poolTokenRateD,
        poolAmount,
        reserveAmount,
        addSpotRateN,
        addSpotRateD,
        removeSpotRateN,
        removeSpotRateD,
        removeAverageRateN,
        removeAverageRateD,
        timeElapsed
    ) {
        const poolTokenRate = Decimal(poolTokenRateN.toString()).div(poolTokenRateD.toString());
        const addSpotRate = Decimal(addSpotRateN.toString()).div(addSpotRateD.toString());
        const removeSpotRate = Decimal(removeSpotRateN.toString()).div(removeSpotRateD.toString());
        const removeAverageRate = Decimal(removeAverageRateN.toString()).div(removeAverageRateD.toString());
        poolAmount = Decimal(poolAmount.toString());
        reserveAmount = Decimal(reserveAmount.toString());

        // calculate the protected amount of reserve tokens plus accumulated fee before compensation
        const reserveAmountPlusFee = removeSpotRate.div(addSpotRate).sqrt().mul(poolTokenRate).mul(poolAmount);
        const total = reserveAmountPlusFee.gt(reserveAmount) ? reserveAmountPlusFee : reserveAmount;

        // calculate the impermanent loss
        const ratio = removeAverageRate.div(addSpotRate);
        const loss = ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();

        // calculate the protection level
        const delay = timeElapsed < MIN_DURATION ? 0 : timeElapsed;
        const level = Decimal(Math.min(delay, MAX_DURATION)).div(MAX_DURATION);

        // calculate the compensation amount
        return total.mul(Decimal(1).sub(loss)).add(reserveAmount.mul(loss).mul(level));
    }

    function protectedAmountPlusFee(poolAmount, poolRateN, poolRateD, addRateN, addRateD, removeRateN, removeRateD) {
        [poolAmount, poolRateN, poolRateD, addRateN, addRateD, removeRateN, removeRateD] = [...arguments].map(
            (x) => new Decimal(x.toString())
        );
        return removeRateN
            .div(removeRateD)
            .mul(addRateD)
            .div(addRateN)
            .sqrt()
            .mul(poolRateN)
            .div(poolRateD)
            .mul(poolAmount);
    }

    function impLoss(initialRateN, initialRateD, currentRateN, currentRateD) {
        const ratioN = currentRateN.mul(initialRateD);
        const ratioD = currentRateD.mul(initialRateN);
        const ratio = Decimal(ratioN.toString()).div(ratioD.toString());
        return ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();
    }

    function compensationAmount(amount, total, lossN, lossD, levelN, levelD) {
        [amount, total, lossN, lossD, levelN, levelD] = [...arguments].map((x) => new Decimal(x.toString()));
        return total
            .mul(lossD.sub(lossN))
            .div(lossD)
            .add(lossN.mul(levelN).mul(amount).div(lossD.mul(levelD)));
    }

    function fixedDev(a, b, p) {
        const x = Decimal(a.toString());
        const y = Decimal(b.toString());
        const q = Decimal(1).sub(p);
        if (x.lt(y.mul(q))) {
            return new BN(y.mul(q).toFixed(0, Decimal.ROUND_UP));
        }
        if (x.gt(y.div(q))) {
            return new BN(y.div(q).toFixed(0, Decimal.ROUND_DOWN));
        }
        return a;
    }

    function expectAlmostEqual(actual, expected, range) {
        if (!actual.eq(expected)) {
            const absoluteError = actual.sub(expected).abs();
            const relativeError = actual.div(expected).sub(1).abs();
            expect(absoluteError.lte(range.maxAbsoluteError) || relativeError.lte(range.maxRelativeError)).to.be.true(
                `\nabsoluteError = ${absoluteError.toFixed(25)}\nrelativeError = ${relativeError.toFixed(25)}`
            );
        }
    }
});
