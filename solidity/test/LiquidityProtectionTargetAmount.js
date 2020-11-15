const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');
const Decimal = require('decimal.js');

const TokenGovernance = artifacts.require('TestTokenGovernance');
const LiquidityProtection = artifacts.require('TestLiquidityProtection');

const MIN_AMOUNT = new BN(1);
const MAX_AMOUNT = new BN(2).pow(new BN(127));

const MIN_DURATION = 30 * 24 * 60 * 60;
const MAX_DURATION = 100 * 24 * 60 * 60;

contract('LiquidityProtectionTargetAmount', accounts => {
    let liquidityProtection;

    before(async () => {
        const networkTokenGovernance = await TokenGovernance.new(accounts[0]);
        const govTokenGovernance = await TokenGovernance.new(accounts[0]);
        liquidityProtection = await LiquidityProtection.new(
            accounts[0],
            networkTokenGovernance.address,
            govTokenGovernance.address,
            accounts[0]
        );
    });

    describe('sanity', () => {
        const amounts = [
            MIN_AMOUNT,
            MAX_AMOUNT,
        ];
        const durations = [
            MIN_DURATION,
            MAX_DURATION - 1,
        ];
        test(amounts, durations);
    });

    describe('accuracy', () => {
        const amounts = [
            MAX_AMOUNT,
        ];
        const durations = [
            MIN_DURATION,
            MAX_DURATION - 1,
        ];
        const range = {
            maxAbsoluteError: '0',
            maxRelativeError: '0',
        };
        test(amounts, durations, range);
    });

    describe('accuracy', () => {
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
        test(amounts, durations, range);
    });

    function test(amounts, durations, range) {
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
                                                            assertAlmostEqual(Decimal(actual.toString()), expected, range);
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

    function assertAlmostEqual(actual, expected, range) {
        if (!actual.eq(expected)) {
            const absoluteError = actual.sub(expected).abs();
            const relativeError = actual.div(expected).sub(1).abs();
            expect(absoluteError.lte(range.maxAbsoluteError) || relativeError.lte(range.maxRelativeError)).to.be.true(
                `\nabsoluteError = ${absoluteError.toFixed(20)}\nrelativeError = ${relativeError.toFixed(20)}`
            );
        }
    }
});
