const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const Decimal = require('decimal.js');

const { NATIVE_TOKEN_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const { duration, latest } = time;

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const StandardPoolConverter = contract.fromArtifact('TestStandardPoolConverter');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const DSToken = contract.fromArtifact('DSToken');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const TestStandardToken = contract.fromArtifact('TestStandardToken');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const NetworkSettings = contract.fromArtifact('NetworkSettings');

const ONE_TOKEN = new BN(10).pow(new BN(18));
const TOTAL_SUPPLY = ONE_TOKEN.muln(1000000);
const MIN_RETURN = new BN(1);
const MAX_CONVERSION_FEE = new BN(1000000);

describe('StandardPoolConverter', () => {
    const createPool = async (options = {}) => {
        const { disabled, ethIndex, networkFeePercent, conversionFeePercent } = options;

        const poolToken = await DSToken.new('PT', 'PT', 18);
        let reserveToken1;
        let reserveToken2;

        switch (ethIndex) {
            case 0:
                reserveToken1 = await TestStandardToken.new('RSV1', 'RSV1', 18, TOTAL_SUPPLY);
                reserveToken2 = await TestStandardToken.new('RSV2', 'RSV2', 18, TOTAL_SUPPLY);
                break;
            case 1:
                reserveToken1 = { address: NATIVE_TOKEN_ADDRESS };
                reserveToken2 = await TestStandardToken.new('RSV2', 'RSV2', 18, TOTAL_SUPPLY);
                break;
            case 2:
                reserveToken1 = await TestStandardToken.new('RSV1', 'RSV1', 18, TOTAL_SUPPLY);
                reserveToken2 = { address: NATIVE_TOKEN_ADDRESS };
                break;
            default:
                throw new Error(`Unexpected ethIndex ${ethIndex}`);
        }

        const converter = await StandardPoolConverter.new(
            poolToken.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE
        );

        if (networkFeePercent) {
            await networkSettings.setNetworkFee(networkFeePercent * 10000);
        }

        if (conversionFeePercent) {
            await converter.setConversionFee(conversionFeePercent * 10000);
        }

        await converter.addReserve(reserveToken1.address, 500000);
        await converter.addReserve(reserveToken2.address, 500000);

        if (!disabled) {
            await poolToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        now = await latest();
        await converter.setTime(now);

        return { poolToken, reserveToken1, reserveToken2, converter };
    };

    const addLiquidity = async (converter, reserveToken1, reserveToken2, reserveAmounts) => {
        const { transactionCost: approveTransactionCost } = await approve(reserveToken1, converter, reserveAmounts[0]);
        const { transactionCost: approveTransactionCost2 } = await approve(reserveToken2, converter, reserveAmounts[1]);

        let value = new BN(0);
        if (reserveToken1.address === NATIVE_TOKEN_ADDRESS) {
            value = reserveAmounts[0];
        } else if (reserveToken2.address === NATIVE_TOKEN_ADDRESS) {
            value = reserveAmounts[1];
        }

        const res = await converter.addLiquidity(
            [reserveToken1.address, reserveToken2.address],
            reserveAmounts,
            MIN_RETURN,
            {
                value
            }
        );

        return {
            res,
            transactionCost: approveTransactionCost.add(approveTransactionCost2).add(await getTransactionCost(res))
        };
    };

    const removeLiquidity = async (converter, reserveToken1, reserveToken2, amount) => {
        const res = await converter.removeLiquidity(
            amount,
            [reserveToken1.address, reserveToken2.address],
            [MIN_RETURN, MIN_RETURN]
        );
        return { res, transactionCost: await getTransactionCost(res) };
    };

    const convert = async (conversionPath, amount, minReturn) => {
        const [sourceToken, poolToken] = conversionPath;
        await approve(sourceToken, bancorNetwork, amount);

        const value = sourceToken.address === NATIVE_TOKEN_ADDRESS ? amount : 0;
        const conversionPathAddresses = conversionPath.map((token) => token.address);
        const res = await bancorNetwork.convertByPath2(conversionPathAddresses, amount, minReturn, ZERO_ADDRESS, {
            value
        });

        const converter = await StandardPoolConverter.at(await poolToken.owner.call());
        const events = await converter.getPastEvents('Conversion', {
            fromBlock: res.receipt.blockNumber
        });
        const args = events.slice(-1)[0].args;
        return { res, amount: args._return, fee: args._conversionFee };
    };

    const getBalance = async (reserveToken, account) => {
        const reserveTokenAddress = reserveToken.address || reserveToken;
        const address = account.address || account;

        if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
            return balance.current(address);
        }

        if (typeof reserveToken === 'string') {
            const token = await TestStandardToken.at(reserveToken);
            return await token.balanceOf.call(address);
        }

        return reserveToken.balanceOf.call(address);
    };

    const getAllowance = async (reserveToken, account) => {
        const reserveTokenAddress = reserveToken.address || reserveToken;
        if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
            return new BN(0);
        }

        const address = account.address || account;

        if (typeof reserveToken === 'string') {
            const token = await TestStandardToken.at(reserveToken);
            return token.allowance.call(sender, address);
        }

        return reserveToken.allowance.call(sender, address);
    };

    const approve = async (reserveToken, account, amount, options = {}) => {
        let transactionCost = new BN(0);

        const reserveTokenAddress = reserveToken.address || reserveToken;
        if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
            return { transactionCost };
        }

        if (!options.from) {
            options.from = defaultSender;
        }

        const address = account.address || account;

        if (typeof reserveToken === 'string') {
            const token = await TestStandardToken.at(reserveToken);
            let res = await token.approve(address, 0, options);
            transactionCost = transactionCost.add(await getTransactionCost(res));

            res = await token.approve(address, amount, options);
            transactionCost = transactionCost.add(await getTransactionCost(res));

            return { transactionCost };
        }

        let res = await reserveToken.approve(address, 0, options);
        transactionCost = transactionCost.add(await getTransactionCost(res));

        res = await reserveToken.approve(address, amount, options);
        transactionCost = transactionCost.add(await getTransactionCost(res));

        return { transactionCost };
    };

    const transfer = async (reserveToken, account, amount, options = {}) => {
        if (!options.from) {
            options.from = defaultSender;
        }

        const reserveTokenAddress = reserveToken.address || reserveToken;
        if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
            return account.send(amount, options);
        }

        const address = account.address || account;

        if (typeof reserveToken === 'string') {
            const token = await TestStandardToken.at(reserveToken);
            return await token.transfer(address, amount, options);
        }

        return await reserveToken.transfer(address, amount, options);
    };

    const getTransactionCost = async (txResult) => {
        const transaction = await web3.eth.getTransaction(txResult.tx);
        return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
    };

    let now;
    let bancorNetwork;
    let contractRegistry;
    let networkSettings;

    const sender = defaultSender;
    const networkFeeWallet = accounts[1];

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await StandardPoolConverterFactory.new()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        networkSettings = await NetworkSettings.new(networkFeeWallet, 0);
        await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);
    });

    for (const ethIndex of [0, 1, 2]) {
        const ethIndexDescription = () => {
            switch (ethIndex) {
                case 0:
                    return 'with [ERC20, ERC20] reserves';

                case 1:
                    return 'with [ETH, ERC20] reserve';

                case 2:
                    return 'with [ERC20, ETH] reserve';

                default:
                    throw new Error(`Unexpected ethIndex ${ethIndex}`);
            }
        };

        context(ethIndexDescription(), () => {
            describe('construction', () => {
                it('verifies the Activation event after converter activation', async () => {
                    const { converter, poolToken } = await createPool({ ethIndex, disabled: true });
                    await poolToken.transferOwnership(converter.address);
                    const res = await converter.acceptTokenOwnership();

                    expectEvent(res, 'Activation', {
                        _type: new BN(3),
                        _anchor: poolToken.address,
                        _activated: true
                    });
                });
            });

            describe('source and target amounts and fees', () => {
                const expectAlmostEqual = (amount1, amount2, maxError) => {
                    if (!amount1.eq(amount2)) {
                        const error = Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
                        expect(error.lte(maxError)).to.be.true(`error = ${error.toFixed(maxError.length)}`);
                    }
                };

                for (const amount of [0, 500, 1234, 5678, 9999, 12345, 98765]) {
                    for (const conversionFeePercent of [0, 5, 10, 25]) {
                        context(`when amount = ${amount}, conversionFeePercent = ${conversionFeePercent}%`, () => {
                            let converter;
                            let reserveToken1;
                            let reserveToken2;

                            beforeEach(async () => {
                                ({ converter, reserveToken1, reserveToken2 } = await createPool({
                                    ethIndex,
                                    conversionFeePercent
                                }));

                                await addLiquidity(converter, reserveToken1, reserveToken2, [
                                    new BN(1000000000),
                                    new BN(1000000000)
                                ]);
                            });

                            it('verifies sourceAmountAndFee', async () => {
                                const targetAmountAndFee = await converter.targetAmountAndFee.call(
                                    reserveToken1.address,
                                    reserveToken2.address,
                                    amount
                                );

                                const sourceAmountAndFee = await converter.sourceAmountAndFee.call(
                                    reserveToken1.address,
                                    reserveToken2.address,
                                    targetAmountAndFee[0]
                                );

                                expectAlmostEqual(sourceAmountAndFee[0], new BN(amount), '0.003');
                                expect(sourceAmountAndFee[1]).to.be.bignumber.gte(targetAmountAndFee[1]);
                                expect(sourceAmountAndFee[1]).to.be.bignumber.lte(targetAmountAndFee[1].addn(1));
                            });
                        });
                    }
                }
            });

            describe('conversion', () => {
                let converter;
                let poolToken;
                let reserveToken1;
                let reserveToken2;

                beforeEach(async () => {
                    ({ converter, poolToken, reserveToken1, reserveToken2 } = await createPool({
                        ethIndex,
                        conversionFeePercent: 0.3
                    }));

                    await addLiquidity(converter, reserveToken1, reserveToken2, [
                        new BN(1000000000),
                        new BN(1000000000)
                    ]);
                });

                it('verifies that convert returns valid amount and fee after converting', async () => {
                    const amount = new BN(500);
                    const purchaseAmount = (
                        await converter.targetAmountAndFee.call(reserveToken1.address, reserveToken2.address, amount)
                    )[0];

                    const { res } = await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);

                    expectEvent(res, 'Conversion', {
                        _smartToken: poolToken.address,
                        _fromToken: reserveToken1.address,
                        _toToken: reserveToken2.address,
                        _fromAmount: amount,
                        _toAmount: purchaseAmount
                    });
                });

                it('verifies the TokenRateUpdate event after conversion', async () => {
                    const amount = new BN(500);

                    const { res } = await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);

                    const poolTokenSupply = await poolToken.totalSupply.call();
                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    const events = await converter.getPastEvents('TokenRateUpdate', {
                        fromBlock: res.receipt.blockNumber,
                        toBlock: res.receipt.blockNumber
                    });

                    // TokenRateUpdate for [source, target):
                    const { args: event1 } = events[0];
                    expect(event1._token1).to.eql(reserveToken1.address);
                    expect(event1._token2).to.eql(reserveToken2.address);
                    expect(event1._rateN).to.be.bignumber.equal(reserve2Balance);
                    expect(event1._rateD).to.be.bignumber.equal(reserve1Balance);

                    // TokenRateUpdate for [source, pool token):
                    const { args: event2 } = events[1];
                    expect(event2._token1).to.eql(poolToken.address);
                    expect(event2._token2).to.eql(reserveToken1.address);
                    expect(event2._rateN).to.be.bignumber.equal(reserve1Balance);
                    expect(event2._rateD).to.be.bignumber.equal(poolTokenSupply);

                    // TokenRateUpdate for [pool token, target):
                    const { args: event3 } = events[2];
                    expect(event3._token1).to.eql(poolToken.address);
                    expect(event3._token2).to.eql(reserveToken2.address);
                    expect(event3._rateN).to.be.bignumber.equal(reserve2Balance);
                    expect(event3._rateD).to.be.bignumber.equal(poolTokenSupply);
                });

                it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                    const amount = new BN(500);

                    await expectRevert(
                        convert([reserveToken1, poolToken, reserveToken2], amount, 200000),
                        'ERR_RETURN_TOO_LOW'
                    );
                });
            });

            describe('recent average rate', () => {
                const AVERAGE_RATE_PERIOD = duration.minutes(10);

                let converter;
                let poolToken;
                let reserveToken1;
                let reserveToken2;

                beforeEach(async () => {
                    ({ converter, poolToken, reserveToken1, reserveToken2 } = await createPool({
                        ethIndex,
                        conversionFeePercent: 0.3
                    }));

                    await addLiquidity(converter, reserveToken1, reserveToken2, [
                        new BN(1000000000),
                        new BN(1000000000)
                    ]);
                });

                const getExpectedAverageRate = (prevAverageRate, currentRate, timeElapsed) => {
                    if (timeElapsed.eq(new BN(0))) {
                        return prevAverageRate;
                    }

                    if (timeElapsed.gte(AVERAGE_RATE_PERIOD)) {
                        return currentRate;
                    }

                    const newAverageRateN = prevAverageRate.n
                        .mul(currentRate.d)
                        .mul(AVERAGE_RATE_PERIOD.sub(timeElapsed))
                        .add(prevAverageRate.d.mul(currentRate.n).mul(timeElapsed));
                    const newAverageRateD = AVERAGE_RATE_PERIOD.mul(prevAverageRate.d).mul(currentRate.d);

                    return { n: newAverageRateN, d: newAverageRateD };
                };

                const expectRatesAlmostEqual = (rate, newRate) => {
                    const rate1 = Decimal(rate.n.toString()).div(Decimal(rate.d.toString()));
                    const rate2 = Decimal(newRate.n.toString()).div(Decimal(newRate.d.toString()));

                    if (!rate1.eq(rate2)) {
                        const error = Decimal(rate1.toString()).div(rate2.toString()).sub(1).abs();
                        expect(error.lte('0.000002')).to.be.true(`error = ${error.toFixed(10)}`);
                    }
                };

                const getCurrentRate = async (reserveToken1, reserveToken2) => {
                    const balance1 = await converter.reserveBalance.call(reserveToken1.address || reserveToken1);
                    const balance2 = await converter.reserveBalance.call(reserveToken2.address || reserveToken2);
                    return { n: balance2, d: balance1 };
                };

                const getAverageRate = async (reserveToken) => {
                    const averageRate = await converter.recentAverageRate.call(reserveToken.address || reserveToken);
                    return { n: averageRate[0], d: averageRate[1] };
                };

                const getPrevAverageRate = async () => {
                    const averageRateInfo = await converter.averageRateInfo.call();
                    return { n: averageRateInfo.shrn(112).maskn(112), d: averageRateInfo.maskn(112) };
                };

                const getPrevAverageRateUpdateTime = async () => {
                    const averageRateInfo = await converter.averageRateInfo.call();
                    return averageRateInfo.shrn(224);
                };

                it('should revert when requesting the average rate for a non reserve token', async () => {
                    await expectRevert(converter.recentAverageRate.call(accounts[7]), 'ERR_INVALID_RESERVE');
                });

                it('should be initially equal to the current rate', async () => {
                    const averageRate = await getAverageRate(reserveToken1);
                    const currentRate = await getCurrentRate(reserveToken1, reserveToken2);
                    const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

                    expect(averageRate.n.mul(currentRate.d)).to.be.bignumber.equal(currentRate.n.mul(averageRate.d));
                    expect(prevAverageRateUpdateTime).to.be.bignumber.equal(new BN(0));
                });

                it('should change after a conversion', async () => {
                    const amount = new BN(500);

                    await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);
                    const prevAverageRate = await getAverageRate(reserveToken1);
                    const prevAverageRateUpdateTime = await getPrevAverageRateUpdateTime();

                    await converter.setTime(now.add(duration.seconds(10)));

                    await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);
                    const averageRate = await getAverageRate(reserveToken1);
                    const averageRateUpdateTime = await getPrevAverageRateUpdateTime();

                    expect(averageRate.n).not.to.be.bignumber.equal(prevAverageRate.n);
                    expect(averageRate.d).not.to.be.bignumber.equal(prevAverageRate.d);
                    expect(averageRateUpdateTime).not.to.be.bignumber.equal(prevAverageRateUpdateTime);
                });

                it('should be identical to the current rate after the full average rate period has passed', async () => {
                    const amount = new BN(500);

                    // set initial rate
                    await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);

                    let converterTime = now.add(duration.seconds(10));
                    await converter.setTime(converterTime);
                    await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);

                    const currentRate = await getCurrentRate(reserveToken1, reserveToken2);
                    let averageRate = await getAverageRate(reserveToken1);

                    expect(averageRate.n).not.to.be.bignumber.equal(currentRate.n);
                    expect(averageRate.d).not.to.be.bignumber.equal(currentRate.d);

                    converterTime = converterTime.add(AVERAGE_RATE_PERIOD);
                    await converter.setTime(converterTime);
                    averageRate = await getAverageRate(reserveToken1);

                    expect(averageRate.n).to.be.bignumber.equal(currentRate.n);
                    expect(averageRate.d).to.be.bignumber.equal(currentRate.d);
                });

                for (const seconds of [0, 1, 2, 3, 10, 100, 200, 300, 400, 500]) {
                    const timeElapsed = duration.seconds(seconds);
                    context(`${timeElapsed.toString()} seconds after conversion`, async () => {
                        beforeEach(async () => {
                            const amount = new BN(500);

                            // set initial rate (a second ago)
                            await converter.setTime(now.sub(duration.seconds(1)));
                            await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);

                            // reset converter time to current time
                            await converter.setTime(now);

                            // convert
                            await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);

                            // increase the current time
                            await converter.setTime(now.add(timeElapsed));
                        });

                        it('should properly calculate the average rate', async () => {
                            const amount = new BN(1000);

                            const prevAverageRate = await getPrevAverageRate();
                            const currentRate = await getCurrentRate(reserveToken1, reserveToken2);
                            const expectedAverageRate = getExpectedAverageRate(
                                prevAverageRate,
                                currentRate,
                                timeElapsed
                            );
                            await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);
                            const averageRate = await getAverageRate(reserveToken1);

                            expectRatesAlmostEqual(averageRate, expectedAverageRate);
                        });

                        it('should not change more than once in a block', async () => {
                            const amount = new BN(1000);

                            await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);
                            const averageRate = await getAverageRate(reserveToken1);

                            for (let i = 0; i < 5; i++) {
                                await convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN);
                                const averageRate2 = await getAverageRate(reserveToken1);

                                expect(averageRate.n).to.be.bignumber.equal(averageRate2.n);
                                expect(averageRate.d).to.be.bignumber.equal(averageRate2.d);
                            }
                        });

                        it('should change after some time with no conversions', async () => {
                            const prevAverageRate = await getPrevAverageRate();
                            const currentRate = await getCurrentRate(reserveToken1, reserveToken2);

                            for (let i = 0; i < 10; i++) {
                                // increase the current time and verify that the average rate is updated accordingly
                                const delta = duration.seconds(10).mul(new BN(i));
                                const totalElapsedTime = timeElapsed.add(delta);
                                await converter.setTime(now.add(totalElapsedTime));

                                const expectedAverageRate = getExpectedAverageRate(
                                    prevAverageRate,
                                    currentRate,
                                    totalElapsedTime
                                );
                                const averageRate = await getAverageRate(reserveToken1);

                                expectRatesAlmostEqual(averageRate, expectedAverageRate);
                            }
                        });
                    });
                }
            });

            describe('add/remove liquidity', () => {
                const getLiquidityCosts = async (firstTime, converter, reserveTokens, reserveAmounts) => {
                    if (firstTime) {
                        return reserveAmounts.map((reserveAmount, i) => reserveAmounts);
                    }

                    return await Promise.all(
                        reserveAmounts.map((reserveAmount, i) =>
                            converter.addLiquidityCost(
                                reserveTokens.map((reserveToken) => reserveToken.address || reserveToken),
                                i,
                                reserveAmount
                            )
                        )
                    );
                };

                const getLiquidityReturn = async (firstTime, converter, reserveTokens, reserveAmounts) => {
                    if (firstTime) {
                        const length = Math.round(
                            reserveAmounts.map((reserveAmount) => reserveAmount.toString()).join('').length /
                                reserveAmounts.length
                        );
                        return new BN(10).pow(new BN(length - 1));
                    }

                    return await converter.addLiquidityReturn(
                        reserveTokens.map((reserveToken) => reserveToken.address || reserveToken),
                        reserveAmounts
                    );
                };

                const removeLiquidityTest = async (ethIndex, reverse) => {
                    const { poolToken, reserveToken1, reserveToken2, converter } = await createPool({ ethIndex });
                    const reserveTokens = [reserveToken1, reserveToken2];

                    if (reverse) {
                        reserveTokens.reverse();
                    }

                    const amount = new BN(100000);
                    await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                    const poolTokenSupply = await poolToken.totalSupply.call();
                    const reserveBalances = await Promise.all(
                        reserveTokens.map((reserveToken) => converter.reserveBalance.call(reserveToken.address))
                    );

                    const removeAmount = new BN(100);
                    const expectedOutputAmounts = reserveBalances.map((reserveBalance) =>
                        reserveBalance.mul(removeAmount).div(poolTokenSupply)
                    );
                    await converter.removeLiquidityTest(
                        removeAmount,
                        reserveTokens.map((reserveToken) => reserveToken.address),
                        [MIN_RETURN, MIN_RETURN]
                    );
                    const actualOutputAmounts = await Promise.all(
                        reserveTokens.map((reserveToken, i) => converter.reserveAmountsRemoved(i))
                    );
                    reserveTokens.map((reserveToken, i) =>
                        expect(actualOutputAmounts[i]).to.be.bignumber.equal(expectedOutputAmounts[i])
                    );
                };

                let converter;
                let poolToken;
                let reserveToken1;
                let reserveToken2;

                beforeEach(async () => {
                    ({ converter, poolToken, reserveToken1, reserveToken2 } = await createPool({ ethIndex }));
                });

                it('verifies function removeLiquidity when the reserves tokens are passed in the initial order', async () => {
                    await removeLiquidityTest(ethIndex);
                });

                it('verifies function removeLiquidity when the reserves tokens are passed in the opposite order', async () => {
                    await removeLiquidityTest(ethIndex, true);
                });

                it('verifies the TokenRateUpdate event after adding liquidity', async () => {
                    const amount = new BN(500);
                    const { res } = await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                    const poolTokenSupply = await poolToken.totalSupply.call();
                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    expectEvent(res, 'TokenRateUpdate', {
                        _token1: poolToken.address,
                        _token2: reserveToken1.address,
                        _rateN: reserve1Balance,
                        _rateD: poolTokenSupply
                    });

                    expectEvent(res, 'TokenRateUpdate', {
                        _token1: poolToken.address,
                        _token2: reserveToken2.address,
                        _rateN: reserve2Balance,
                        _rateD: poolTokenSupply
                    });
                });

                it('verifies the TokenRateUpdate event after removing liquidity', async () => {
                    const amount = new BN(1000);
                    await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                    const removeAmount = new BN(100);
                    const { res } = await removeLiquidity(converter, reserveToken1, reserveToken2, removeAmount);

                    const poolTokenSupply = await poolToken.totalSupply.call();
                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    await converter.reserveWeight.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                    await converter.reserveWeight.call(reserveToken2.address);

                    expectEvent(res, 'TokenRateUpdate', {
                        _token1: poolToken.address,
                        _token2: reserveToken1.address,
                        _rateN: reserve1Balance,
                        _rateD: poolTokenSupply
                    });

                    expectEvent(res, 'TokenRateUpdate', {
                        _token1: poolToken.address,
                        _token2: reserveToken2.address,
                        _rateN: reserve2Balance,
                        _rateD: poolTokenSupply
                    });
                });

                it('should allow adding and removing liquidity', async () => {
                    const reserveTokens = [reserveToken1, reserveToken2];

                    const state = [];
                    let expected = [];
                    let prevSupply = new BN(0);
                    let prevBalances = reserveTokens.map((reserveToken) => new BN(0));

                    for (const supplyAmount of [1000000000, 1000000, 2000000, 3000000, 4000000]) {
                        const reserveAmounts = reserveTokens.map((reserveToken, i) =>
                            new BN(supplyAmount).mul(new BN(100 + i)).div(new BN(100))
                        );
                        await Promise.all(
                            reserveTokens.map((reserveToken, i) =>
                                approve(reserveToken, converter, reserveAmounts[i].mul(new BN(0)))
                            )
                        );
                        await Promise.all(
                            reserveTokens.map((reserveToken, i) =>
                                approve(reserveToken, converter, reserveAmounts[i].mul(new BN(1)))
                            )
                        );
                        const liquidityCosts = await getLiquidityCosts(
                            state.length === 0,
                            converter,
                            reserveTokens,
                            reserveAmounts
                        );
                        const liquidityReturn = await getLiquidityReturn(
                            state.length === 0,
                            converter,
                            reserveTokens,
                            reserveAmounts
                        );

                        await addLiquidity(converter, reserveToken1, reserveToken2, reserveAmounts);

                        const allowances = await Promise.all(
                            reserveTokens.map((reserveToken) => getAllowance(reserveToken, converter))
                        );
                        const balances = await Promise.all(
                            reserveTokens.map((reserveToken) => getBalance(reserveToken, converter))
                        );
                        const supply = await poolToken.totalSupply.call();

                        state.push({ supply: supply, balances: balances });

                        for (let i = 0; i < allowances.length; i++) {
                            const diff = Decimal(allowances[i].toString()).div(reserveAmounts[i].toString());
                            expect(diff.toFixed()).to.be.equal('0');
                        }

                        const actual = balances.map((balance) => Decimal(balance.toString()).div(supply.toString()));
                        for (let i = 0; i < expected.length; i++) {
                            const diff = expected[i].div(actual[i]);
                            expect(diff.toFixed()).to.be.equal('1');
                            for (const liquidityCost of liquidityCosts) {
                                expect(liquidityCost[i]).to.be.bignumber.equal(balances[i].sub(prevBalances[i]));
                            }
                        }

                        expect(liquidityReturn).to.be.bignumber.equal(supply.sub(prevSupply));

                        expected = actual;
                        prevSupply = supply;
                        prevBalances = balances;
                    }

                    for (let n = state.length - 1; n > 0; n--) {
                        const supplyAmount = state[n].supply.sub(new BN(state[n - 1].supply));
                        const reserveAmounts = await converter.removeLiquidityReturn(
                            supplyAmount,
                            reserveTokens.map((reserveToken) => reserveToken.address)
                        );
                        await removeLiquidity(converter, reserveToken1, reserveToken2, supplyAmount);

                        const balances = await Promise.all(
                            reserveTokens.map((reserveToken) => getBalance(reserveToken, converter))
                        );
                        for (let i = 0; i < balances.length; i++) {
                            const diff = Decimal(state[n - 1].balances[i].toString()).div(
                                Decimal(balances[i].toString())
                            );
                            expect(diff.toFixed()).to.be.equal('1');
                            expect(prevBalances[i].sub(balances[i])).to.be.bignumber.equal(reserveAmounts[i]);
                        }
                        prevBalances = balances;
                    }

                    const supplyAmount = state[0].supply;
                    const reserveAmounts = await converter.removeLiquidityReturn(
                        supplyAmount,
                        reserveTokens.map((reserveToken) => reserveToken.address)
                    );

                    await removeLiquidity(converter, reserveToken1, reserveToken2, supplyAmount);

                    const balances = await Promise.all(
                        reserveTokens.map((reserveToken) => getBalance(reserveToken, converter.address))
                    );
                    for (let i = 0; i < balances.length; i++) {
                        expect(balances[i]).to.be.bignumber.equal(new BN(0));
                        expect(prevBalances[i].sub(balances[i])).to.be.bignumber.equal(reserveAmounts[i]);
                    }
                });

                it('verifies that addLiquidity gets the correct reserve balance amounts from the caller', async () => {
                    const prevReserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const prevReserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    const token1Amount = new BN(10000).mul(ONE_TOKEN);
                    const token2Amount = new BN(20000).mul(ONE_TOKEN);

                    await addLiquidity(converter, reserveToken1, reserveToken2, [token1Amount, token2Amount]);

                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    expect(reserve1Balance).to.be.bignumber.equal(prevReserve1Balance.add(token1Amount));
                    expect(reserve2Balance).to.be.bignumber.equal(prevReserve2Balance.add(token2Amount));
                });

                it('should revert when attempting to add liquidity with insufficient funds', async () => {
                    const amount = await getBalance(reserveToken1, defaultSender);

                    await expectRevert(
                        addLiquidity(converter, reserveToken1, reserveToken2, [amount.add(new BN(1)), 1000]),
                        reserveToken1.address !== NATIVE_TOKEN_ADDRESS
                            ? 'SafeMath: subtraction overflow'
                            : "Returned error: sender doesn't have enough funds to send tx"
                    );
                });

                it('verifies that removeLiquidity sends the correct reserve balance amounts to the caller', async () => {
                    const amount = new BN(100000).mul(ONE_TOKEN);
                    await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                    const percentage = new BN(50);
                    const supply = await poolToken.totalSupply.call();
                    const supplyAmount = supply.mul(percentage).div(supply);
                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                    const token1Amount = reserve1Balance.mul(percentage).div(supply);
                    const token2Amount = reserve2Balance.mul(percentage).div(supply);

                    const token1PrevBalance = await getBalance(reserveToken1, defaultSender);
                    const token2PrevBalance = await getBalance(reserveToken2, defaultSender);

                    const { transactionCost } = await removeLiquidity(
                        converter,
                        reserveToken1,
                        reserveToken2,
                        supplyAmount
                    );

                    const token1Balance = await getBalance(reserveToken1, defaultSender);
                    const token2Balance = await getBalance(reserveToken2, defaultSender);

                    expect(token1Balance).to.be.bignumber.equal(
                        token1PrevBalance
                            .add(token1Amount)
                            .sub(reserveToken1.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0))
                    );
                    expect(token2Balance).to.be.bignumber.equal(
                        token2PrevBalance
                            .add(token2Amount)
                            .sub(reserveToken2.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0))
                    );
                });

                it('verifies that removing the entire liquidity sends the full reserve balances to the caller', async () => {
                    const amount = new BN(100000).mul(ONE_TOKEN);
                    await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    const token1PrevBalance = await getBalance(reserveToken1, defaultSender);
                    const token2PrevBalance = await getBalance(reserveToken2, defaultSender);

                    const totalSupply = await poolToken.totalSupply.call();
                    const { transactionCost } = await removeLiquidity(
                        converter,
                        reserveToken1,
                        reserveToken2,
                        totalSupply
                    );

                    const token1Balance = await getBalance(reserveToken1, defaultSender);
                    const token2Balance = await getBalance(reserveToken2, defaultSender);

                    expect(await poolToken.totalSupply.call()).to.be.bignumber.equal(new BN(0));

                    expect(token1Balance).to.be.bignumber.equal(
                        token1PrevBalance
                            .add(reserve1Balance)
                            .sub(reserveToken1.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0))
                    );
                    expect(token2Balance).to.be.bignumber.equal(
                        token2PrevBalance
                            .add(reserve2Balance)
                            .sub(reserveToken2.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0))
                    );
                });

                it('should revert when attempting to remove liquidity with insufficient funds', async () => {
                    const amount = new BN(100000).mul(ONE_TOKEN);
                    await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                    const totalSupply = await poolToken.totalSupply.call();

                    await expectRevert(
                        removeLiquidity(converter, reserveToken1, reserveToken2, totalSupply.add(new BN(1))),
                        'ERC20: burn amount exceeds balance'
                    );
                });

                describe('verifies that the maximum possible liquidity is added', () => {
                    for (const [amount1, amount2] of [
                        [1000, 1200],
                        [200, 240],
                        [2000, 2400],
                        [20000, 22000],
                        [20000, 26000],
                        [100000, 120000]
                    ]) {
                        it(`addLiquidity(${[amount1, amount2]})`, async () => {
                            await addLiquidity(converter, reserveToken1, reserveToken2, [amount1, amount2]);

                            const balance1 = await getBalance(reserveToken1, converter);
                            const balance2 = await getBalance(reserveToken2, converter);
                            const a1b2 = new BN(amount1).mul(balance2);
                            const a2b1 = new BN(amount2).mul(balance1);
                            const expected1 = a1b2.lt(a2b1) ? new BN(0) : a1b2.sub(a2b1).div(balance2);
                            const expected2 = a2b1.lt(a1b2) ? new BN(0) : a2b1.sub(a1b2).div(balance1);
                            const actual1 = await getAllowance(reserveToken1, converter);
                            const actual2 = await getAllowance(reserveToken2, converter);
                            expect(actual1).to.be.bignumber.equal(expected1);
                            expect(actual2).to.be.bignumber.equal(expected2);
                        });
                    }
                });

                describe('verifies no gain by adding/removing liquidity', () => {
                    for (const amounts of [
                        [1000, 1000],
                        [1000, 2000],
                        [2000, 1000]
                    ]) {
                        for (const percents of [[100], [50, 50], [25, 75], [75, 25], [10, 20, 30, 40]]) {
                            it(`(amounts = ${amounts}, percents = ${percents})`, async () => {
                                let lastAmount = new BN(0);
                                for (const amount of amounts) {
                                    await addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]);

                                    const balance = await getBalance(poolToken, defaultSender);
                                    lastAmount = balance.sub(lastAmount);
                                }
                                const prevBalance1 = await getBalance(reserveToken1, defaultSender);
                                const prevBalance2 = await getBalance(reserveToken2, defaultSender);

                                let transactionCost = new BN(0);
                                for (const percent of percents) {
                                    const { transactionCost: removeTransactionConst } = await removeLiquidity(
                                        converter,
                                        reserveToken1,
                                        reserveToken2,
                                        lastAmount.mul(new BN(percent)).div(new BN(100))
                                    );

                                    transactionCost = transactionCost.add(removeTransactionConst);
                                }
                                const balance1 = await getBalance(reserveToken1, defaultSender);
                                const balance2 = await getBalance(reserveToken2, defaultSender);
                                const amount = new BN(amounts[1]);
                                expect(balance1).to.be.bignumber.equal(
                                    prevBalance1
                                        .add(amount)
                                        .sub(
                                            reserveToken1.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0)
                                        )
                                );
                                expect(balance2).to.be.bignumber.equal(
                                    prevBalance2
                                        .add(amount)
                                        .sub(
                                            reserveToken2.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0)
                                        )
                                );
                            });
                        }
                    }
                });

                it('should refund the provider', async () => {
                    const reserveTokens = [reserveToken1, reserveToken2];
                    const amount = new BN(1000000000);

                    for (const factors of [
                        [1, 1],
                        [1, 2],
                        [2, 1]
                    ]) {
                        const reserveAmounts = factors.map((factor) => factor * amount);
                        for (const reserveToken of reserveTokens) {
                            await approve(reserveToken, converter, 0);
                        }

                        const balancesBefore = await Promise.all(
                            reserveTokens.map((reserveToken) => getBalance(reserveToken, defaultSender))
                        );

                        const { transactionCost } = await addLiquidity(
                            converter,
                            reserveToken1,
                            reserveToken2,
                            reserveAmounts
                        );

                        const balancesAfter = await Promise.all(
                            reserveTokens.map((reserveToken) => getBalance(reserveToken, defaultSender))
                        );

                        expect(balancesAfter[0]).to.be.bignumber.equal(
                            balancesBefore[0]
                                .sub(new BN(amount))
                                .sub(reserveToken1.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0))
                        );

                        expect(balancesAfter[1]).to.be.bignumber.equal(
                            balancesBefore[1]
                                .sub(new BN(amount))
                                .sub(reserveToken2.address === NATIVE_TOKEN_ADDRESS ? transactionCost : new BN(0))
                        );
                    }
                });
            });

            describe('network fees', () => {
                const CONVERSION_AMOUNT = ONE_TOKEN.muln(100);

                const description = (
                    prefix,
                    initialBalance1,
                    initialBalance2,
                    conversionFeePercent,
                    networkFeePercent
                ) => {
                    return (
                        prefix +
                        ` initial balances = [${initialBalance1}, ${initialBalance2}],` +
                        ` conversion fee = ${conversionFeePercent}%` +
                        ` and network fee = ${networkFeePercent}%`
                    );
                };

                let poolToken;
                let reserveToken1;
                let reserveToken2;
                let converter;

                let networkFeeWalletReserve1Balance;
                let networkFeeWalletReserve2Balance;

                for (const initialBalance1 of [100000, 200000, 400000, 800000]) {
                    for (const initialBalance2 of [100000, 300000, 500000, 700000]) {
                        for (const conversionFeePercent of [0, 5, 10, 25, 75]) {
                            for (const networkFeePercent of [0, 5, 10, 25, 75, 100]) {
                                context(
                                    description(
                                        'when',
                                        initialBalance1,
                                        initialBalance2,
                                        conversionFeePercent,
                                        networkFeePercent
                                    ),
                                    () => {
                                        beforeEach(async () => {
                                            ({ poolToken, reserveToken1, reserveToken2, converter } = await createPool({
                                                ethIndex,
                                                networkFeePercent,
                                                conversionFeePercent
                                            }));

                                            networkFeeWalletReserve1Balance = await getBalance(
                                                reserveToken1,
                                                networkFeeWallet
                                            );
                                            networkFeeWalletReserve2Balance = await getBalance(
                                                reserveToken2,
                                                networkFeeWallet
                                            );
                                        });

                                        it('should process network fees after conversion', async () => {
                                            await addLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.muln(n))
                                            );

                                            const conversion = await convert(
                                                [reserveToken1, poolToken, reserveToken2],
                                                CONVERSION_AMOUNT,
                                                MIN_RETURN
                                            );

                                            const expectedFeeBase = conversion.fee.muln(networkFeePercent).divn(200);
                                            const reserveBalance1 = ONE_TOKEN.muln(initialBalance1).add(
                                                CONVERSION_AMOUNT
                                            );
                                            const reserveBalance2 = ONE_TOKEN.muln(initialBalance2).sub(
                                                conversion.amount
                                            );

                                            await converter.processNetworkFees();

                                            const expectedFee1 = expectedFeeBase
                                                .mul(reserveBalance1)
                                                .div(reserveBalance2);
                                            const expectedFee2 = expectedFeeBase;

                                            const actualFee1 = (await getBalance(reserveToken1, networkFeeWallet)).sub(
                                                networkFeeWalletReserve1Balance
                                            );
                                            const actualFee2 = (await getBalance(reserveToken2, networkFeeWallet)).sub(
                                                networkFeeWalletReserve2Balance
                                            );

                                            expectAlmostEqual(actualFee1, expectedFee1, '2', '0.000188');
                                            expectAlmostEqual(actualFee2, expectedFee2, '2', '0.000188');
                                        });
                                    }
                                );
                            }
                        }
                    }
                }

                for (const initialBalance1 of [100000, 400000]) {
                    for (const initialBalance2 of [100000, 500000]) {
                        for (const conversionFeePercent of [1, 2]) {
                            for (const networkFeePercent of [5, 10]) {
                                context(
                                    description(
                                        'when',
                                        initialBalance1,
                                        initialBalance2,
                                        conversionFeePercent,
                                        networkFeePercent
                                    ),
                                    () => {
                                        beforeEach(async () => {
                                            ({ poolToken, reserveToken1, reserveToken2, converter } = await createPool({
                                                ethIndex,
                                                networkFeePercent,
                                                conversionFeePercent
                                            }));

                                            networkFeeWalletReserve1Balance = await getBalance(
                                                reserveToken1,
                                                networkFeeWallet
                                            );
                                            networkFeeWalletReserve2Balance = await getBalance(
                                                reserveToken2,
                                                networkFeeWallet
                                            );
                                        });

                                        it('should process network fees after liquidity provision', async () => {
                                            await addLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.muln(n))
                                            );

                                            const conversion = await convert(
                                                [reserveToken1, poolToken, reserveToken2],
                                                CONVERSION_AMOUNT,
                                                MIN_RETURN
                                            );
                                            const expectedFeeBase = conversion.fee.muln(networkFeePercent).divn(200);
                                            const reserveBalance1 = ONE_TOKEN.muln(initialBalance1).add(
                                                CONVERSION_AMOUNT
                                            );
                                            const reserveBalance2 = ONE_TOKEN.muln(initialBalance2).sub(
                                                conversion.amount
                                            );

                                            const reserveAmounts = [initialBalance1, initialBalance2].map((n) =>
                                                ONE_TOKEN.muln(n)
                                            );

                                            await addLiquidity(converter, reserveToken1, reserveToken2, reserveAmounts);

                                            const expectedFee1 = expectedFeeBase
                                                .mul(reserveBalance1)
                                                .div(reserveBalance2);
                                            const expectedFee2 = expectedFeeBase;

                                            const actualFee1 = (await getBalance(reserveToken1, networkFeeWallet)).sub(
                                                networkFeeWalletReserve1Balance
                                            );
                                            const actualFee2 = (await getBalance(reserveToken2, networkFeeWallet)).sub(
                                                networkFeeWalletReserve2Balance
                                            );

                                            expectAlmostEqual(actualFee1, expectedFee1, '0', '0.000005');
                                            expectAlmostEqual(actualFee2, expectedFee2, '0', '0.000005');
                                        });
                                    }
                                );
                            }
                        }
                    }
                }

                for (const initialBalance1 of [100000, 400000]) {
                    for (const initialBalance2 of [100000, 500000]) {
                        for (const conversionFeePercent of [1, 2]) {
                            for (const networkFeePercent of [5, 10]) {
                                context(
                                    description(
                                        'when',
                                        initialBalance1,
                                        initialBalance2,
                                        conversionFeePercent,
                                        networkFeePercent
                                    ),
                                    () => {
                                        beforeEach(async () => {
                                            ({ poolToken, reserveToken1, reserveToken2, converter } = await createPool({
                                                ethIndex,
                                                networkFeePercent,
                                                conversionFeePercent
                                            }));

                                            networkFeeWalletReserve1Balance = await getBalance(
                                                reserveToken1,
                                                networkFeeWallet
                                            );
                                            networkFeeWalletReserve2Balance = await getBalance(
                                                reserveToken2,
                                                networkFeeWallet
                                            );
                                        });

                                        it('should process network fees after multiple conversions', async () => {
                                            await addLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.muln(n))
                                            );

                                            let totalConversionFee1 = new BN(0);
                                            let totalConversionFee2 = new BN(0);

                                            for (const n of [10, 20, 30, 40]) {
                                                const conversion = await convert(
                                                    [reserveToken1, poolToken, reserveToken2],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                            }

                                            for (const n of [50, 60, 70, 80]) {
                                                const conversion = await convert(
                                                    [reserveToken2, poolToken, reserveToken1],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                            }

                                            for (const n of [180, 170, 160, 150]) {
                                                const conversion = await convert(
                                                    [reserveToken1, poolToken, reserveToken2],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                            }

                                            for (const n of [140, 130, 120, 110]) {
                                                const conversion = await convert(
                                                    [reserveToken2, poolToken, reserveToken1],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                            }

                                            const totalSupply = await poolToken.totalSupply.call();
                                            const reserveBalance1 = await getBalance(reserveToken1, converter);
                                            const reserveBalance2 = await getBalance(reserveToken2, converter);

                                            const supplyAmount = await poolToken.balanceOf(defaultSender);
                                            await removeLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                supplyAmount
                                            );

                                            const totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                                .mul(totalSupply)
                                                .div(reserveBalance1);
                                            const totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                                .mul(totalSupply)
                                                .div(reserveBalance2);
                                            const totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                                totalConversionFee2InPoolTokenUnits
                                            );
                                            const expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                                .muln(networkFeePercent)
                                                .divn(200);
                                            const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                            const expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                            const actualFee1 = (await getBalance(reserveToken1, networkFeeWallet)).sub(
                                                networkFeeWalletReserve1Balance
                                            );
                                            const actualFee2 = (await getBalance(reserveToken2, networkFeeWallet)).sub(
                                                networkFeeWalletReserve2Balance
                                            );

                                            expectAlmostEqual(actualFee1, expectedFee1, '0', '0.001371');
                                            expectAlmostEqual(actualFee2, expectedFee2, '0', '0.001371');
                                        });
                                    }
                                );
                            }
                        }
                    }
                }

                for (const initialBalance1 of [100000]) {
                    for (const initialBalance2 of [100000]) {
                        for (const conversionFeePercent of [1]) {
                            for (const networkFeePercent of [10]) {
                                context(
                                    description(
                                        'when',
                                        initialBalance1,
                                        initialBalance2,
                                        conversionFeePercent,
                                        networkFeePercent
                                    ),
                                    () => {
                                        beforeEach(async () => {
                                            ({ poolToken, reserveToken1, reserveToken2, converter } = await createPool({
                                                ethIndex,
                                                networkFeePercent,
                                                conversionFeePercent
                                            }));

                                            networkFeeWalletReserve1Balance = await getBalance(
                                                reserveToken1,
                                                networkFeeWallet
                                            );
                                            networkFeeWalletReserve2Balance = await getBalance(
                                                reserveToken2,
                                                networkFeeWallet
                                            );
                                        });

                                        it('should process network fee after liquidity provision and removal', async () => {
                                            await addLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,

                                                [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.muln(n))
                                            );

                                            let totalConversionFee1 = new BN(0);
                                            let totalConversionFee2 = new BN(0);

                                            for (const n of [10, 20, 30, 40]) {
                                                const conversion = await convert(
                                                    [reserveToken1, poolToken, reserveToken2],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                            }

                                            for (let n = 0; n < 4; n++) {
                                                const reserveAmounts = [ONE_TOKEN.muln(1000), ONE_TOKEN.muln(1000)];
                                                await addLiquidity(
                                                    converter,
                                                    reserveToken1,
                                                    reserveToken2,
                                                    reserveAmounts
                                                );
                                            }

                                            for (const n of [50, 60, 70, 80]) {
                                                const conversion = await convert(
                                                    [reserveToken2, poolToken, reserveToken1],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                            }

                                            for (let n = 0; n < 4; n++) {
                                                const supplyAmount = await poolToken.balanceOf(defaultSender);
                                                await removeLiquidity(
                                                    converter,
                                                    reserveToken1,
                                                    reserveToken2,
                                                    supplyAmount.divn(10)
                                                );
                                            }

                                            for (const n of [180, 170, 160, 150]) {
                                                const conversion = await convert(
                                                    [reserveToken1, poolToken, reserveToken2],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                            }

                                            for (let n = 0; n < 4; n++) {
                                                const reserveAmounts = [ONE_TOKEN.muln(1000), ONE_TOKEN.muln(1000)];
                                                await addLiquidity(
                                                    converter,
                                                    reserveToken1,
                                                    reserveToken2,
                                                    reserveAmounts
                                                );
                                            }

                                            for (const n of [140, 130, 120, 110]) {
                                                const conversion = await convert(
                                                    [reserveToken2, poolToken, reserveToken1],
                                                    ONE_TOKEN.muln(n),
                                                    MIN_RETURN
                                                );
                                                totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                            }

                                            for (let n = 0; n < 4; n++) {
                                                const supplyAmount = await poolToken.balanceOf(defaultSender);
                                                await removeLiquidity(
                                                    converter,
                                                    reserveToken1,
                                                    reserveToken2,
                                                    supplyAmount.divn(10)
                                                );
                                            }

                                            const totalSupply = await poolToken.totalSupply.call();
                                            const reserveBalance1 = await getBalance(reserveToken1, converter);
                                            const reserveBalance2 = await getBalance(reserveToken2, converter);

                                            const totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                                .mul(totalSupply)
                                                .div(reserveBalance1);
                                            const totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                                .mul(totalSupply)
                                                .div(reserveBalance2);
                                            const totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                                totalConversionFee2InPoolTokenUnits
                                            );
                                            const expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                                .muln(networkFeePercent)
                                                .divn(200);
                                            const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                            const expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                            const actualFee1 = (await getBalance(reserveToken1, networkFeeWallet)).sub(
                                                networkFeeWalletReserve1Balance
                                            );
                                            const actualFee2 = (await getBalance(reserveToken2, networkFeeWallet)).sub(
                                                networkFeeWalletReserve2Balance
                                            );

                                            expectAlmostEqual(actualFee1, expectedFee1, '0', '0.003391');
                                            expectAlmostEqual(actualFee2, expectedFee2, '0', '0.001671');
                                        });
                                    }
                                );
                            }
                        }
                    }
                }

                for (const initialBalance1 of [100000]) {
                    for (const initialBalance2 of [100000]) {
                        for (const conversionFeePercent of [1]) {
                            for (const networkFeePercent of [10]) {
                                context(
                                    description(
                                        'when',
                                        initialBalance1,
                                        initialBalance2,
                                        conversionFeePercent,
                                        networkFeePercent
                                    ),
                                    () => {
                                        beforeEach(async () => {
                                            ({ poolToken, reserveToken1, reserveToken2, converter } = await createPool({
                                                ethIndex,
                                                networkFeePercent,
                                                conversionFeePercent
                                            }));

                                            networkFeeWalletReserve1Balance = await getBalance(
                                                reserveToken1,
                                                networkFeeWallet
                                            );
                                            networkFeeWalletReserve2Balance = await getBalance(
                                                reserveToken2,
                                                networkFeeWallet
                                            );
                                        });

                                        it('should process network fees after multiple conversions', async () => {
                                            await addLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.muln(n))
                                            );

                                            let totalConversionFee1 = new BN(0);
                                            let totalConversionFee2 = new BN(0);

                                            for (const n of [10, 20, 30, 40]) {
                                                const conversion = await convert(
                                                    [reserveToken1, poolToken, reserveToken2],
                                                    1000000 * n,
                                                    MIN_RETURN
                                                );
                                                totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                            }

                                            await converter.processNetworkFees();

                                            for (const n of [50, 60, 70, 80]) {
                                                const conversion = await convert(
                                                    [reserveToken2, poolToken, reserveToken1],
                                                    1000000 * n,
                                                    MIN_RETURN
                                                );
                                                totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                            }

                                            await converter.processNetworkFees();

                                            for (const n of [180, 170, 160, 150]) {
                                                const conversion = await convert(
                                                    [reserveToken1, poolToken, reserveToken2],
                                                    1000000 * n,
                                                    MIN_RETURN
                                                );
                                                totalConversionFee2 = totalConversionFee2.add(conversion.fee);
                                            }

                                            await converter.processNetworkFees();

                                            for (const n of [140, 130, 120, 110]) {
                                                const conversion = await convert(
                                                    [reserveToken2, poolToken, reserveToken1],
                                                    1000000 * n,
                                                    MIN_RETURN
                                                );
                                                totalConversionFee1 = totalConversionFee1.add(conversion.fee);
                                            }

                                            await converter.processNetworkFees();

                                            const totalSupply = await poolToken.totalSupply.call();
                                            const reserveBalance1 = await getBalance(reserveToken1, converter);
                                            const reserveBalance2 = await getBalance(reserveToken2, converter);

                                            const totalConversionFee1InPoolTokenUnits = totalConversionFee1
                                                .mul(totalSupply)
                                                .div(reserveBalance1);
                                            const totalConversionFee2InPoolTokenUnits = totalConversionFee2
                                                .mul(totalSupply)
                                                .div(reserveBalance2);
                                            const totalConversionFeeInPoolTokenUnits = totalConversionFee1InPoolTokenUnits.add(
                                                totalConversionFee2InPoolTokenUnits
                                            );
                                            const expectedFeeBase = totalConversionFeeInPoolTokenUnits
                                                .muln(networkFeePercent)
                                                .divn(200);
                                            const expectedFee1 = expectedFeeBase.mul(reserveBalance1).div(totalSupply);
                                            const expectedFee2 = expectedFeeBase.mul(reserveBalance2).div(totalSupply);

                                            const actualFee1 = (await getBalance(reserveToken1, networkFeeWallet)).sub(
                                                networkFeeWalletReserve1Balance
                                            );
                                            const actualFee2 = (await getBalance(reserveToken2, networkFeeWallet)).sub(
                                                networkFeeWalletReserve2Balance
                                            );

                                            expectAlmostEqual(actualFee1, expectedFee1, '0', '0.0000014');
                                            expectAlmostEqual(actualFee2, expectedFee2, '0', '0.0000014');
                                        });
                                    }
                                );
                            }
                        }
                    }
                }

                for (const initialBalance1 of [100000, 400000]) {
                    for (const initialBalance2 of [100000, 500000]) {
                        for (const conversionFeePercent of [1, 2]) {
                            for (const networkFeePercent of [5, 10]) {
                                context(
                                    description(
                                        'when',
                                        initialBalance1,
                                        initialBalance2,
                                        conversionFeePercent,
                                        networkFeePercent
                                    ),
                                    () => {
                                        beforeEach(async () => {
                                            ({ poolToken, reserveToken1, reserveToken2, converter } = await createPool({
                                                ethIndex,
                                                networkFeePercent,
                                                conversionFeePercent
                                            }));

                                            networkFeeWalletReserve1Balance = await getBalance(
                                                reserveToken1,
                                                networkFeeWallet
                                            );
                                            networkFeeWalletReserve2Balance = await getBalance(
                                                reserveToken2,
                                                networkFeeWallet
                                            );
                                        });

                                        it('should process network fees after large liquidity removal', async () => {
                                            await addLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                [initialBalance1, initialBalance2].map((n) => ONE_TOKEN.muln(n))
                                            );

                                            const conversionAmount = ONE_TOKEN.muln(
                                                Math.max(initialBalance1, initialBalance2)
                                            );
                                            const conversion = await convert(
                                                [reserveToken1, poolToken, reserveToken2],
                                                conversionAmount,
                                                MIN_RETURN
                                            );
                                            const expectedFeeBase = conversion.fee.muln(networkFeePercent).divn(200);
                                            const reserveBalance1 = ONE_TOKEN.muln(initialBalance1).add(
                                                conversionAmount
                                            );
                                            const reserveBalance2 = ONE_TOKEN.muln(initialBalance2).sub(
                                                conversion.amount
                                            );

                                            const supplyAmount = await poolToken.balanceOf(defaultSender);
                                            await removeLiquidity(
                                                converter,
                                                reserveToken1,
                                                reserveToken2,
                                                supplyAmount
                                            );

                                            const expectedFee1 = expectedFeeBase
                                                .mul(reserveBalance1)
                                                .div(reserveBalance2);
                                            const expectedFee2 = expectedFeeBase;

                                            const actualFee1 = (await getBalance(reserveToken1, networkFeeWallet)).sub(
                                                networkFeeWalletReserve1Balance
                                            );
                                            const actualFee2 = (await getBalance(reserveToken2, networkFeeWallet)).sub(
                                                networkFeeWalletReserve2Balance
                                            );

                                            expectAlmostEqual(actualFee1, expectedFee1, '0', '0.02383');
                                            expectAlmostEqual(actualFee2, expectedFee2, '0', '0.02383');
                                        });
                                    }
                                );
                            }
                        }
                    }
                }

                const expectAlmostEqual = (actual, expected, maxAbsoluteError, maxRelativeError) => {
                    const x = Decimal(actual.toString());
                    const y = Decimal(expected.toString());
                    if (!x.eq(y)) {
                        const absoluteError = x.sub(y).abs();
                        const relativeError = x.div(y).sub(1).abs();
                        expect(absoluteError.lte(maxAbsoluteError) || relativeError.lte(maxRelativeError)).to.be.true(
                            `\nabsoluteError = ${absoluteError.toFixed()}\nrelativeError = ${relativeError.toFixed(25)}`
                        );
                    }
                };
            });

            describe('sync reserve balances', () => {
                let poolToken;
                let reserveToken1;
                let reserveToken2;
                let converter;

                beforeEach(async () => {
                    ({ converter, poolToken, reserveToken1, reserveToken2 } = await createPool({ ethIndex }));

                    await addLiquidity(converter, reserveToken1, reserveToken2, [
                        new BN(1000000000),
                        new BN(1000000000)
                    ]);
                });

                const testSync = async (operation) => {
                    await operation();

                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    await converter.syncReserveBalances();

                    expect(await converter.reserveBalance.call(reserveToken1.address)).to.be.bignumber.equal(
                        reserve1Balance
                    );
                    expect(await converter.reserveBalance.call(reserveToken2.address)).to.be.bignumber.equal(
                        reserve2Balance
                    );
                };

                it('should not affect reserve balances before and after conversion', async () => {
                    const amount = new BN(500);
                    await testSync(async () => convert([reserveToken1, poolToken, reserveToken2], amount, MIN_RETURN));
                });

                it('should not affect reserve balances before and after liquidity is added', async () => {
                    const amount = new BN(1000).mul(ONE_TOKEN);
                    await testSync(async () => addLiquidity(converter, reserveToken1, reserveToken2, [amount, amount]));
                });

                it('should not affect reserve balances before and after liquidity is removed', async () => {
                    const amount = await poolToken.totalSupply.call();
                    await testSync(async () =>
                        converter.removeLiquidity(
                            amount,
                            [reserveToken1.address, reserveToken2.address],
                            [MIN_RETURN, MIN_RETURN]
                        )
                    );
                });

                it('should sync with external changes', async () => {
                    const reserve1Balance = await converter.reserveBalance.call(reserveToken1.address);
                    const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                    const amount1 = new BN(1);
                    const amount2 = new BN(100);

                    await transfer(reserveToken1, converter, amount1);
                    await transfer(reserveToken2, converter, amount2);

                    await converter.syncReserveBalances();

                    expect(await converter.reserveBalance.call(reserveToken1.address)).to.be.bignumber.equal(
                        reserve1Balance.add(amount1)
                    );
                    expect(await converter.reserveBalance.call(reserveToken2.address)).to.be.bignumber.equal(
                        reserve2Balance.add(amount2)
                    );
                });
            });
        });
    }
});
