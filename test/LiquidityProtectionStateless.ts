import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import MathUtils from './helpers/MathUtils';

import Contracts from './helpers/Contracts';

const MIN_AMOUNT = new MathUtils.Decimal(2).pow(0);
const MAX_AMOUNT = new MathUtils.Decimal(2).pow(127);

const MIN_RATIO = new MathUtils.Decimal(2).pow(256 / 4);
const MAX_RATIO = new MathUtils.Decimal(2).pow(256 / 3);

const MIN_DURATION = 30 * 24 * 60 * 60;
const MAX_DURATION = 100 * 24 * 60 * 60;

let liquidityProtection: any;
let owner: any;
let accounts: any;

describe('LiquidityProtectionStateless', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];

        const liquidityProtectionSettings = await Contracts.LiquidityProtectionSettings.deploy(
            owner.address,
            owner.address
        );
        const liquidityProtectionStore = await Contracts.LiquidityProtectionStore.deploy();
        const liquidityProtectionStats = await Contracts.LiquidityProtectionStats.deploy();
        const liquidityProtectionSystemStore = await Contracts.LiquidityProtectionSystemStore.deploy();
        const liquidityProtectionWallet = await Contracts.TokenHolder.deploy();
        const networkTokenGovernance = await Contracts.TestTokenGovernance.deploy(owner.address);
        const govTokenGovernance = await Contracts.TestTokenGovernance.deploy(owner.address);
        const checkpointStore = await Contracts.TestCheckpointStore.deploy();

        liquidityProtection = await Contracts.TestLiquidityProtection.deploy([
            liquidityProtectionSettings.address,
            liquidityProtectionStore.address,
            liquidityProtectionStats.address,
            liquidityProtectionSystemStore.address,
            liquidityProtectionWallet.address,
            networkTokenGovernance.address,
            govTokenGovernance.address,
            checkpointStore.address
        ]);
    });

    describe('sanity part 1', () => {
        const amounts = [
            BigNumber.from(MIN_AMOUNT.toFixed()),
            BigNumber.from(MIN_AMOUNT.mul(MAX_RATIO).floor().toFixed())
        ];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '1';
        const range = {
            maxAbsoluteError: Infinity,
            maxRelativeError: Infinity
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('sanity part 2', () => {
        const amounts = [
            BigNumber.from(MAX_AMOUNT.div(MIN_RATIO).ceil().toFixed()),
            BigNumber.from(MAX_AMOUNT.toFixed())
        ];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '1';
        const range = {
            maxAbsoluteError: Infinity,
            maxRelativeError: Infinity
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 1', () => {
        const amounts = [
            BigNumber.from(MIN_AMOUNT.toFixed()),
            BigNumber.from(MIN_AMOUNT.mul(MAX_RATIO).floor().toFixed())
        ];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '0.25';
        const range = {
            maxAbsoluteError: '1.2',
            maxRelativeError: '0.0000000000003'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 2', () => {
        const amounts = [
            BigNumber.from(MAX_AMOUNT.div(MIN_RATIO).ceil().toFixed()),
            BigNumber.from(MAX_AMOUNT.toFixed())
        ];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '0.75';
        const range = {
            maxAbsoluteError: '0.0',
            maxRelativeError: '0.0000000000000000007'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 3', () => {
        const amounts = [BigNumber.from(MAX_AMOUNT.toFixed())];
        const durations = [MIN_DURATION, MAX_DURATION - 1];
        const deviation = '1';
        const range = {
            maxAbsoluteError: '0',
            maxRelativeError: '0'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 4', () => {
        const amounts = [BigNumber.from('123456789123456789'), BigNumber.from('987654321987654321')];
        const durations = [Math.floor((MIN_DURATION + MAX_DURATION) / 2)];
        const deviation = '1';
        const range = {
            maxAbsoluteError: '1.6',
            maxRelativeError: '0.000000000000000003'
        };
        removeLiquidityTargetAmountTest(amounts, durations, deviation, range);
    });

    describe('accuracy part 5', () => {
        const poolAmounts = [31, 63, 127].map((x) => BigNumber.from(2).pow(BigNumber.from(x)));
        const poolRateNs = [24, 30, 36].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const poolRateDs = [23, 47, 95].map((x) => BigNumber.from(x).pow(BigNumber.from(18)));
        const addRateNs = [24, 30, 36].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const addRateDs = [23, 47, 95].map((x) => BigNumber.from(x).pow(BigNumber.from(18)));
        const removeRateNs = [24, 30, 36].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const removeRateDs = [23, 47, 95].map((x) => BigNumber.from(x).pow(BigNumber.from(18)));
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
        const initialRateNs = [18, 24, 30, 36].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const initialRateDs = [11, 23, 47, 95].map((x) => BigNumber.from(x).pow(BigNumber.from(18)));
        const currentRateNs = [18, 24, 30, 36].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const currentRateDs = [11, 23, 47, 95].map((x) => BigNumber.from(x).pow(BigNumber.from(18)));
        const range = {
            maxAbsoluteError:
                '0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006',
            maxRelativeError:
                '0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000174'
        };
        impLossTest(initialRateNs, initialRateDs, currentRateNs, currentRateDs, range);
    });

    describe('accuracy part 7', () => {
        const amounts = [31, 63, 127].map((x) => BigNumber.from(2).pow(BigNumber.from(x)));
        const fees = [30, 60, 90].map((x) => BigNumber.from(2).pow(BigNumber.from(x)));
        const lossNs = [12, 15, 18].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const lossDs = [18, 24, 30].map((x) => BigNumber.from(10).pow(BigNumber.from(x)));
        const levelNs = [3, 5, 7].map((x) => BigNumber.from(x).pow(BigNumber.from(10)));
        const levelDs = [7, 9, 11].map((x) => BigNumber.from(x).pow(BigNumber.from(10)));
        const range = {
            maxAbsoluteError: '1.0',
            maxRelativeError: '0.0000000006'
        };
        compensationAmountTest(amounts, fees, lossNs, lossDs, levelNs, levelDs, range);
    });

    function removeLiquidityTargetAmountTest(amounts: any, durations: any, deviation: any, range: any) {
        let testNum = 0;
        const numOfTest = amounts.length ** 10 * durations.length ** 1;

        for (const poolTokenRateN of amounts) {
            for (const poolTokenRateD of amounts) {
                for (const poolAmount of amounts) {
                    for (const reserveAmount of amounts) {
                        for (const addSpotRateN of amounts) {
                            for (const addSpotRateD of amounts) {
                                for (const removeSpotRateN of amounts.map((amount: any) =>
                                    fixedDev(amount, addSpotRateN, deviation)
                                )) {
                                    for (const removeSpotRateD of amounts.map((amount: any) =>
                                        fixedDev(amount, addSpotRateD, deviation)
                                    )) {
                                        for (const removeAverageRateN of amounts.map((amount: any) =>
                                            fixedDev(amount, removeSpotRateN, deviation)
                                        )) {
                                            for (const removeAverageRateD of amounts.map((amount: any) =>
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
                                                        const actual = await liquidityProtection.callStatic.removeLiquidityTargetAmountTest(
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
                                                            BigNumber.from(0),
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
                                                        expectAlmostEqual(
                                                            new MathUtils.Decimal(actual.toString()),
                                                            expected,
                                                            range
                                                        );
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
        poolAmounts: any,
        poolRateNs: any,
        poolRateDs: any,
        addRateNs: any,
        addRateDs: any,
        removeRateNs: any,
        removeRateDs: any,
        range: any
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
                                        expectAlmostEqual(new MathUtils.Decimal(actual.toString()), expected, range);
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function impLossTest(initialRateNs: any, initialRateDs: any, currentRateNs: any, currentRateDs: any, range: any) {
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
                            expectAlmostEqual(
                                new MathUtils.Decimal(actual[0].toString()).div(actual[1].toString()),
                                expected,
                                range
                            );
                        });
                    }
                }
            }
        }
    }

    function compensationAmountTest(
        amounts: any,
        fees: any,
        lossNs: any,
        lossDs: any,
        levelNs: any,
        levelDs: any,
        range: any
    ) {
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
                                    expectAlmostEqual(new MathUtils.Decimal(actual.toString()), expected, range);
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    function removeLiquidityTargetAmount(
        poolTokenRateN: any,
        poolTokenRateD: any,
        poolAmount: any,
        reserveAmount: any,
        addSpotRateN: any,
        addSpotRateD: any,
        removeSpotRateN: any,
        removeSpotRateD: any,
        removeAverageRateN: any,
        removeAverageRateD: any,
        timeElapsed: any
    ) {
        const poolTokenRate = new MathUtils.Decimal(poolTokenRateN.toString()).div(poolTokenRateD.toString());
        const addSpotRate = new MathUtils.Decimal(addSpotRateN.toString()).div(addSpotRateD.toString());
        const removeSpotRate = new MathUtils.Decimal(removeSpotRateN.toString()).div(removeSpotRateD.toString());
        const removeAverageRate = new MathUtils.Decimal(removeAverageRateN.toString()).div(
            removeAverageRateD.toString()
        );
        poolAmount = new MathUtils.Decimal(poolAmount.toString());
        reserveAmount = new MathUtils.Decimal(reserveAmount.toString());

        // calculate the protected amount of reserve tokens plus accumulated fee before compensation
        const reserveAmountPlusFee = removeSpotRate.div(addSpotRate).sqrt().mul(poolTokenRate).mul(poolAmount);
        const total = reserveAmountPlusFee.gt(reserveAmount) ? reserveAmountPlusFee : reserveAmount;

        // calculate the impermanent loss
        const ratio = removeAverageRate.div(addSpotRate);
        const loss = ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();

        // calculate the protection level
        const delay = timeElapsed < MIN_DURATION ? 0 : timeElapsed;
        const level = new MathUtils.Decimal(Math.min(delay, MAX_DURATION)).div(MAX_DURATION);

        // calculate the compensation amount
        return total.mul(new MathUtils.Decimal(1).sub(loss)).add(reserveAmount.mul(loss).mul(level));
    }

    function protectedAmountPlusFee(
        poolAmount: any,
        poolRateN: any,
        poolRateD: any,
        addRateN: any,
        addRateD: any,
        removeRateN: any,
        removeRateD: any
    ) {
        [poolAmount, poolRateN, poolRateD, addRateN, addRateD, removeRateN, removeRateD] = [...arguments].map(
            (x) => new MathUtils.Decimal(x.toString())
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

    function impLoss(initialRateN: any, initialRateD: any, currentRateN: any, currentRateD: any) {
        const ratioN = currentRateN.mul(initialRateD);
        const ratioD = currentRateD.mul(initialRateN);
        const ratio = new MathUtils.Decimal(ratioN.toString()).div(ratioD.toString());
        return ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();
    }

    function compensationAmount(amount: any, total: any, lossN: any, lossD: any, levelN: any, levelD: any) {
        [amount, total, lossN, lossD, levelN, levelD] = [...arguments].map((x) => new MathUtils.Decimal(x.toString()));
        return total
            .mul(lossD.sub(lossN))
            .div(lossD)
            .add(lossN.mul(levelN).mul(amount).div(lossD.mul(levelD)));
    }

    function fixedDev(a: any, b: any, p: any) {
        const x = new MathUtils.Decimal(a.toString());
        const y = new MathUtils.Decimal(b.toString());
        const q = new MathUtils.Decimal(1).sub(p);
        if (x.lt(y.mul(q))) {
            return BigNumber.from(y.mul(q).toFixed(0, MathUtils.Decimal.ROUND_UP));
        }
        if (x.gt(y.div(q))) {
            return BigNumber.from(y.div(q).toFixed(0, MathUtils.Decimal.ROUND_DOWN));
        }
        return a;
    }

    function expectAlmostEqual(actual: any, expected: any, range: any) {
        if (!actual.eq(expected)) {
            const absoluteError = actual.sub(expected).abs();
            const relativeError = actual.div(expected).sub(1).abs();
            expect(absoluteError.lte(range.maxAbsoluteError) || relativeError.lte(range.maxRelativeError)).to.be.true;
        }
    }
});
