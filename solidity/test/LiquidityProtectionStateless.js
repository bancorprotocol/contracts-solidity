const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const Decimal = require('decimal.js');

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionStore = contract.fromArtifact('LiquidityProtectionStore');
const TokenGovernance = contract.fromArtifact('TestTokenGovernance');
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
        const networkTokenGovernance = await TokenGovernance.new(defaultSender);
        const govTokenGovernance = await TokenGovernance.new(defaultSender);
        liquidityProtection = await LiquidityProtection.new(
            liquidityProtectionSettings.address,
            liquidityProtectionStore.address,
            networkTokenGovernance.address,
            govTokenGovernance.address
        );
    });

    describe('sanity part 1', () => {
        const amounts = [
            new BN(MIN_AMOUNT.toFixed()),
            new BN(MIN_AMOUNT.mul(MAX_RATIO).floor().toFixed()),
        ];
        const durations = [
            MIN_DURATION,
            MAX_DURATION - 1,
        ];
        removeLiquidityTargetAmountTest(amounts, durations);
    });

    describe('sanity part 2', () => {
        const amounts = [
            new BN(MAX_AMOUNT.div(MIN_RATIO).ceil().toFixed()),
            new BN(MAX_AMOUNT.toFixed()),
        ];
        const durations = [
            MIN_DURATION,
            MAX_DURATION - 1,
        ];
        removeLiquidityTargetAmountTest(amounts, durations);
    });

    describe('accuracy part 1', () => {
        const amounts = [
            new BN(MAX_AMOUNT.toFixed()),
        ];
        const durations = [
            MIN_DURATION,
            MAX_DURATION - 1,
        ];
        const range = {
            maxAbsoluteError: '0',
            maxRelativeError: '0',
        };
        removeLiquidityTargetAmountTest(amounts, durations, range);
    });

    describe('accuracy part 2', () => {
        const amounts = [
            new BN('123456789123456789'),
            new BN('987654321987654321'),
        ];
        const durations = [
            Math.floor((MIN_DURATION + MAX_DURATION) / 2),
        ];
        const range = {
            maxAbsoluteError: '1.6',
            maxRelativeError: '0.000000000000000003',
        };
        removeLiquidityTargetAmountTest(amounts, durations, range);
    });

    describe('accuracy part 3', () => {
        const initialRateNs = [9, 12, 15].map((x) => new BN(10).pow(new BN(x)));
        const initialRateDs = [18, 24, 30].map((x) => new BN(10).pow(new BN(x)));
        const currentRateNs = [23, 47, 95].map((x) => new BN(x).pow(new BN(10)));
        const currentRateDs = [7, 9, 11, 13].map((x) => new BN(x).pow(new BN(10)));
        const range = {
            maxAbsoluteError: '0.0',
            maxRelativeError: '0.000000000000000000003',
        };
        impLossTest(initialRateNs, initialRateDs, currentRateNs, currentRateDs, range);
    });

    describe('accuracy part 4', () => {
        const amounts = [31, 63, 127].map((x) => new BN(2).pow(new BN(x)));
        const fees = [30, 60, 90].map((x) => new BN(2).pow(new BN(x)));
        const lossNs = [12, 15, 18].map((x) => new BN(10).pow(new BN(x)));
        const lossDs = [18, 24, 30].map((x) => new BN(10).pow(new BN(x)));
        const levelNs = [3, 5, 7].map((x) => new BN(x).pow(new BN(10)));
        const levelDs = [7, 9, 11].map((x) => new BN(x).pow(new BN(10)));
        const range = {
            maxAbsoluteError: '1.0',
            maxRelativeError: '0.0000000006',
        };
        compensationAmountTest(amounts, fees, lossNs, lossDs, levelNs, levelDs, range);
    });

    function removeLiquidityTargetAmountTest(amounts, durations, range) {
        let testNum = 0;
        const numOfTest = amounts.length ** 10 * durations.length ** 1;

        for (const poolTokenRateN of amounts) {
            for (const poolTokenRateD of amounts) {
                for (const poolAmount of amounts) {
                    for (const reserveAmount of amounts) {
                        for (const addSpotRateN of amounts) {
                            for (const addSpotRateD of amounts) {
                                for (const removeSpotRateN of amounts) {
                                    for (const removeSpotRateD of amounts) {
                                        for (const removeAverageRateN of amounts) {
                                            for (const removeAverageRateD of amounts) {
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
                                                    }).split('"').join('').slice(1, -1);
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
                                                        if (range) {
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
                                                        }
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

    function impLossTest(initialRateNs, initialRateDs, currentRateNs, currentRateDs, range) {
        let testNum = 0;
        const numOfTest = [initialRateNs, initialRateDs, currentRateNs, currentRateDs].reduce((a, b) => a * b.length, 1);

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

    function impLoss(initialRateN, initialRateD, currentRateN, currentRateD) {
        const ratioN = currentRateN.mul(initialRateD);
        const ratioD = currentRateD.mul(initialRateN);
        const ratio = Decimal(ratioN.toString()).div(ratioD.toString());
        return ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();
    }

    function compensationAmount(amount, total, lossN, lossD, levelN, levelD) {
        [amount, total, lossN, lossD, levelN, levelD] = [...arguments].map(x => new Decimal(x.toString()));
        return total.mul(lossD.sub(lossN)).div(lossD).add(lossN.mul(levelN).mul(amount).div(lossD.mul(levelD)));
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
