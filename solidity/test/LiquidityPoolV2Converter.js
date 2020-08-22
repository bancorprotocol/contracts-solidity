const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const Decimal = require('decimal.js');

const MathUtils = require('./helpers/MathUtils');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const { latest, duration } = time;
const { ZERO_ADDRESS } = constants;

const { crossReserveTargetAmount, balancedWeights } = require('./helpers/FormulaFunctions');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const ConverterFactory = artifacts.require('ConverterFactory');

const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');
const LiquidityPoolV2ConverterFactory = artifacts.require('LiquidityPoolV2ConverterFactory');
const LiquidityPoolV2ConverterAnchorFactory = artifacts.require('LiquidityPoolV2ConverterAnchorFactory');
const LiquidityPoolV2ConverterCustomFactory = artifacts.require('LiquidityPoolV2ConverterCustomFactory');
const PoolTokensContainer = artifacts.require('PoolTokensContainer');
const PriceOracle = artifacts.require('PriceOracle');
const SmartToken = artifacts.require('SmartToken');
const ChainlinkPriceOracle = artifacts.require('TestChainlinkPriceOracle');
const Whitelist = artifacts.require('Whitelist');

contract('LiquidityPoolV2Converter', accounts => {
    [
        [new BN(18), new BN(18), true],
        [new BN(18), new BN(18), false],
        [new BN(18), new BN(8), true],
        [new BN(18), new BN(8), false],
        [new BN(8), new BN(18), false],
        [new BN(8), new BN(8), false]
    ].forEach(spec => {
        const [reserveToken1Decimals, reserveToken2Decimals, isETHReserve] = spec;
        const poolTokenDecimals = new BN(10);
        const decimalsDesc = `[${reserveToken1Decimals.toString()},${reserveToken2Decimals.toString()}] decimals`;
        const reservesDesc = `${isETHReserve ? 'with ETH reserve' : 'with ERC20 reserves'}`;

        describe(`${decimalsDesc} ${reservesDesc}`, () => {
            const initConverter = async (activate, addLiquidity, maxConversionFee = 0,
                primaryReserveAddress = getReserve1Address(isETHReserve)) => {
                anchor = await PoolTokensContainer.new('Pool', 'POOL', poolTokenDecimals);
                anchorAddress = anchor.address;

                const converter = await createConverter(anchorAddress, contractRegistry.address, maxConversionFee);
                await converter.addReserve(getReserve1Address(isETHReserve), 500000);
                await converter.addReserve(reserveToken2.address, 500000);
                await anchor.transferOwnership(converter.address);
                await converter.acceptAnchorOwnership();

                if (activate) {
                    if (primaryReserveAddress === getReserve1Address(isETHReserve)) {
                        await converter.activate(primaryReserveAddress, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                    }
                    else {
                        await converter.activate(primaryReserveAddress, chainlinkPriceOracleB.address, chainlinkPriceOracleA.address);
                    }

                    poolToken1 = await SmartToken.at(await converter.poolToken.call(getReserve1Address(isETHReserve)));
                    poolToken2 = await SmartToken.at(await converter.poolToken.call(reserveToken2.address));
                }

                if (addLiquidity) {
                    if (!isETHReserve) {
                        await reserveToken.approve(converter.address, INITIAL_RESERVE1_LIQUIDITY, { from: sender });
                    }

                    await reserveToken2.approve(converter.address, INITIAL_RESERVE2_LIQUIDITY, { from: sender });

                    await converter.addLiquidity(getReserve1Address(isETHReserve), INITIAL_RESERVE1_LIQUIDITY, MIN_RETURN,
                        { value: isETHReserve ? INITIAL_RESERVE1_LIQUIDITY : 0 });
                    await converter.addLiquidity(reserveToken2.address, INITIAL_RESERVE2_LIQUIDITY, MIN_RETURN);
                }

                const now = await latest();
                await converter.setTime(now);
                await converter.setPrevConversionTime(now);

                return converter;
            };

            const createConverter = async (anchorAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
                return LiquidityPoolV2Converter.new(anchorAddress, registryAddress, maxConversionFee);
            };

            const getReserve1 = () => {
                return isETHReserve ? undefined : reserveToken;
            };

            const getReserve1Address = () => {
                return isETHReserve ? ETH_RESERVE_ADDRESS : reserveToken.address;
            };

            const getBalance = async (token, address, account) => {
                if (address === ETH_RESERVE_ADDRESS) {
                    return balance.current(account);
                }

                return token.balanceOf.call(account);
            };

            const getTransactionCost = async (txResult) => {
                const transaction = await web3.eth.getTransaction(txResult.tx);
                return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
            };

            const convert = async (path, amount, minReturn, options) => {
                return bancorNetwork.convertByPath(path, amount, minReturn, ZERO_ADDRESS, ZERO_ADDRESS, 0, options);
            };

            const getPoolRate = async (converter) => {
                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                let reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                let reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const weights = await converter.effectiveReserveWeights.call();
                const reserve1Weight = weights[0];
                const reserve2Weight = weights[1];

                // apply amplification factor
                reserve1Balance = reserve1StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve1Balance);
                reserve2Balance = reserve2StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve2Balance);

                return { n: reserve2Balance.mul(reserve1Weight), d: reserve1Balance.mul(reserve2Weight) };
            };

            const getExpectedTargetAmountFull = (sourceStakedBalance, targetStakedBalance, sourceBalance, targetBalance, sourceWeight, targetWeight,
                amount) => {
                sourceStakedBalance = new BN(sourceStakedBalance);
                targetStakedBalance = new BN(targetStakedBalance);
                sourceBalance = new BN(sourceBalance);
                targetBalance = new BN(targetBalance);
                sourceWeight = new BN(sourceWeight);
                targetWeight = new BN(targetWeight);
                amount = new BN(amount);

                sourceBalance = sourceStakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(sourceBalance);
                targetBalance = targetStakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(targetBalance);

                return new BN(crossReserveTargetAmount(sourceBalance, sourceWeight, targetBalance, targetWeight,
                    amount).round().toString());
            };

            const getExpectedTargetAmount = (sourceStakedBalance, targetStakedBalance, sourceBalance, targetBalance, sourceWeight, targetWeight,
                conversionFee, amount) => {
                const targetAmount = getExpectedTargetAmountFull(
                    sourceStakedBalance, targetStakedBalance,
                    sourceBalance, targetBalance,
                    sourceWeight, targetWeight,
                    amount
                );
                const expectedFee = targetAmount.mul(new BN(conversionFee)).div(PPM_RESOLUTION);

                return targetAmount.sub(expectedFee);
            };

            const getExpectedTargetAmountAndFee = (sourceStakedBalance, targetStakedBalance, sourceBalance, targetBalance,
                sourceWeight, targetWeight, sourceOraclePrice, targetOraclePrice, lowFeeFactor, highFeeFactor, isSourcePrimary, amount) => {
                const targetAmount = getExpectedTargetAmountFull(
                    sourceStakedBalance, targetStakedBalance,
                    sourceBalance, targetBalance,
                    sourceWeight, targetWeight,
                    amount
                );

                const fee = getFee(
                    sourceStakedBalance, targetStakedBalance,
                    sourceBalance, targetBalance,
                    sourceWeight, targetWeight,
                    sourceOraclePrice, targetOraclePrice,
                    lowFeeFactor, highFeeFactor,
                    isSourcePrimary, targetAmount
                );

                return {
                    targetAmount: targetAmount.sub(fee),
                    fee
                };
            };

            const getFee = (sourceStakedBalance, targetStakedBalance, sourceBalance, targetBalance, sourceWeight, targetWeight,
                sourceOraclePrice, targetOraclePrice, lowFeeFactor, highFeeFactor, isSourcePrimary, targetAmount) => {
                sourceBalance = new BN(sourceBalance);
                targetBalance = new BN(targetBalance);
                targetAmount = new BN(targetAmount);

                const targetPoolRate = getExpectedPoolRate(targetStakedBalance, sourceStakedBalance, targetBalance, sourceBalance,
                    targetWeight, sourceWeight);
                const targetOracleRate = { n: targetOraclePrice, d: sourceOraclePrice };

                const targetExternalWeight = weightFromRate(targetStakedBalance, sourceStakedBalance, targetOraclePrice, sourceOraclePrice);

                if (compareRates(targetPoolRate, targetOracleRate) < 0) {
                    let lo = targetPoolRate.n.mul(targetOracleRate.d);
                    let hi = targetOracleRate.n.mul(targetPoolRate.d);
                    const ratio = MathUtils.reducedRatio(hi.sub(lo).toString(), hi.toString(), MAX_RATE_FACTOR_LOWER_BOUND);
                    [lo, hi] = ratio.map(x => new BN(x));

                    // apply the high fee only if the ratio between the effective weight and the external (target) weight is below the high fee upper bound
                    let feeFactor;
                    if ((targetWeight).mul(PPM_RESOLUTION).lt((targetExternalWeight).mul(HIGH_FEE_UPPER_BOUND))) {
                        feeFactor = highFeeFactor;
                    }
                    else {
                        feeFactor = lowFeeFactor;
                    }

                    return targetAmount.mul(lo).mul(feeFactor).div(hi.mul(PPM_RESOLUTION));
                }

                return new BN(0);
            };

            const getExpectedWeights = (reserve1StakedBalance, reserve2StakedBalance, reserve1Balance, reserve2Balance,
                oracleAPrice, oracleBPrice, isReserve1Primary = true) => {
                const rate = normalizeRates(oracleAPrice, oracleBPrice, isReserve1Primary);

                reserve1StakedBalance = new BN(reserve1StakedBalance);
                reserve2StakedBalance = new BN(reserve2StakedBalance);
                reserve1Balance = reserve1StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(new BN(reserve1Balance));
                reserve2Balance = reserve2StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(new BN(reserve2Balance));

                const reserve1Data = [reserve1StakedBalance, reserve1Balance];
                const reserve2Data = [reserve2StakedBalance, reserve2Balance];
                const primaryReserveData = isReserve1Primary ? reserve1Data : reserve2Data;
                const secondaryReserveData = isReserve1Primary ? reserve2Data : reserve1Data;

                const newWeights = balancedWeights(
                    primaryReserveData[0].mul(DEFAULT_AMPLIFICATION_FACTOR),
                    primaryReserveData[1],
                    secondaryReserveData[1],
                    rate.n,
                    rate.d
                );

                const weights = newWeights.map(w => new BN(w.toFixed()));
                if (isReserve1Primary) {
                    return weights;
                }

                return weights.reverse();
            };

            const getExpectedWeightsAndFee = (reserve1StakedBalance, reserve2StakedBalance, reserve1Balance, reserve2Balance,
                oracleAPrice, oracleBPrice, conversionFee, isReserve1Primary = true) => {
                const rate = normalizeRates(oracleAPrice, oracleBPrice, isReserve1Primary);

                reserve1StakedBalance = new BN(reserve1StakedBalance);
                reserve2StakedBalance = new BN(reserve2StakedBalance);

                const weights = getExpectedWeights(reserve1StakedBalance, reserve2StakedBalance, reserve1Balance, reserve2Balance,
                    oracleAPrice, oracleBPrice, isReserve1Primary);

                if (isReserve1Primary) {
                    const x = reserve1StakedBalance.mul(rate.n).mul(weights[1]);
                    const y = reserve2StakedBalance.mul(rate.d).mul(weights[0]);
                    if (x.mul(DEFAULT_AMPLIFICATION_FACTOR).gte(y.mul(DEFAULT_AMPLIFICATION_FACTOR.add(new BN(1))))) {
                        return [weights, conversionFee.div(new BN(2))];
                    }
                    if (x.mul(DEFAULT_AMPLIFICATION_FACTOR.mul(new BN(2))).lte(y.mul(DEFAULT_AMPLIFICATION_FACTOR.mul(new BN(2)).sub(new BN(1))))) {
                        return [weights, conversionFee.mul(new BN(2))];
                    }
                    return [weights, conversionFee.mul(y).div(x.mul(DEFAULT_AMPLIFICATION_FACTOR).sub(y.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1)))))];
                }
                return [weights, conversionFee];
            };

            const convertAndReturnTargetAmount = async (converter, sourceToken, sourceTokenAddress, targetTokenAddress, amount) => {
                let value = 0;
                if (sourceTokenAddress === ETH_RESERVE_ADDRESS) {
                    value = amount;
                }
                else {
                    await sourceToken.approve(bancorNetwork.address, amount);
                }

                const prevTargetReserveBalance = await converter.reserveBalance.call(targetTokenAddress);
                await convert([sourceTokenAddress, anchorAddress, targetTokenAddress], amount, MIN_RETURN, { value });
                const newTargetReserveBalance = await converter.reserveBalance.call(targetTokenAddress);

                return prevTargetReserveBalance.sub(newTargetReserveBalance);
            };

            const getExpectedPoolRate = (token1StakedBalance, token2StakedBalance, token1Balance, token2Balance, token1Weight, token2Weight) => {
                token1StakedBalance = new BN(token1StakedBalance);
                token2StakedBalance = new BN(token2StakedBalance);

                // apply amplification factor
                token1Balance = token1StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(token1Balance);
                token2Balance = token2StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(token2Balance);

                return { n: token2Balance.mul(token1Weight), d: token1Balance.mul(token2Weight) };
            };

            const compareRates = (rate1, rate2) => {
                const x = rate1.n.mul(rate2.d);
                const y = rate2.n.mul(rate1.d);

                if (x.lt(y)) {
                    return -1;
                }

                if (x.gt(y)) {
                    return 1;
                }

                return 0;
            };

            const expectAlmostEqual = (amount1, amount2) => {
                const x = amount1.toString();
                const y = amount2.toString();
                if (x === y) {
                    return;
                }

                const min = 0.98;
                const max = 1.02;
                const ratio = Decimal(x).div(Decimal(y));

                expect(ratio.gte(min)).to.be.true(`${ratio.toString()} is below ${min}`);
                expect(ratio.lte(max)).to.be.true(`${ratio.toString()} is above ${max}`);
            };

            const createChainlinkOracle = async (answer) => {
                const chainlinkOracle = await ChainlinkPriceOracle.new();
                await chainlinkOracle.setAnswer(answer);

                return chainlinkOracle;
            };

            const weightFromRate = (token1Staked, token2Staked, token1Rate, token2Rate) => {
                const a = token1Staked.mul(token1Rate);
                const b = token2Staked.mul(token2Rate);
                const ratio = MathUtils.normalizedRatio(a.toString(), b.toString(), PPM_RESOLUTION.toString());
                return new BN(ratio[0]);
            };

            const getTokensRateAccuracy = async (converter) => {
                const poolRate = await getPoolRate(converter);
                const effectiveTokensRate = await converter.effectiveTokensRate();
                const a = poolRate.n.mul(effectiveTokensRate[1]);
                const b = poolRate.d.mul(effectiveTokensRate[0]);
                const ratio = MathUtils.reducedRatio(a.toString(), b.toString(), MAX_RATE_FACTOR_LOWER_BOUND);
                const [x, y] = ratio.map(z => new BN(z));
                return x.lt(y) ? [x, y] : [y, x];
            };

            const normalizeRates = (rate1, rate2, isReserve1Primary = true) => {
                const normalize = (rate1, rate2) => {
                    if (reserveToken1Decimals.eq(reserveToken2Decimals)) {
                        return { n: rate1, d: rate2 };
                    }

                    if (reserveToken1Decimals.gt(reserveToken2Decimals)) {
                        return { n: rate1, d: rate2.mul(new BN(10).pow(reserveToken1Decimals.sub(reserveToken2Decimals))) };
                    }

                    return { n: rate1.mul(new BN(10).pow(reserveToken2Decimals.sub(reserveToken1Decimals))), d: rate2 };
                };

                const rate = normalize(rate1, rate2);
                if (!isReserve1Primary) {
                    [rate.n, rate.d] = [rate.d, rate.n];
                }

                return rate;
            };

            const toReserve1 = (amount) => amount.mul(new BN(10).pow(reserveToken1Decimals));
            const toReserve2 = (amount) => amount.mul(new BN(10).pow(reserveToken2Decimals));
            const toReserve = (isReserve1, amount) => isReserve1 ? toReserve1(amount) : toReserve2(amount);
            const toPool = (amount) => amount.mul(new BN(10).pow(poolTokenDecimals));

            let bancorNetwork;
            let anchor;
            let anchorAddress;
            let contractRegistry;
            let reserveToken;
            let reserveToken2;
            let poolToken1;
            let poolToken2;
            let chainlinkPriceOracleA;
            let chainlinkPriceOracleB;
            let oracleWhitelist;
            const sender = accounts[0];
            const nonOwner = accounts[1];
            const sender2 = accounts[9];

            const MAX_RATE_FACTOR_LOWER_BOUND = Decimal(10).pow(30);
            const PPM_RESOLUTION = new BN(1000000);
            const DEFAULT_AMPLIFICATION_FACTOR = new BN(20);
            const DEFAULT_LOW_FEE_FACTOR = new BN(200000);
            const DEFAULT_HIGH_FEE_FACTOR = new BN(800000);
            const HIGH_FEE_UPPER_BOUND = new BN(997500);
            const MIN_RETURN = new BN(1);

            const INITIAL_RESERVE1_LIQUIDITY = toReserve1(new BN(4000000));
            const INITIAL_RESERVE2_LIQUIDITY = toReserve2(new BN(8500000));
            const INITIAL_ORACLE_A_PRICE = new BN(10000);
            const INITIAL_ORACLE_B_PRICE = new BN(20000);

            before(async () => {
                // The following contracts are unaffected by the underlying tests, this can be shared.
                contractRegistry = await ContractRegistry.new();

                const bancorFormula = await BancorFormula.new();
                await bancorFormula.init();
                await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

                const factory = await ConverterFactory.new();
                await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

                await factory.registerTypedConverterFactory((await LiquidityPoolV2ConverterFactory.new()).address);

                await factory.registerTypedConverterAnchorFactory((await LiquidityPoolV2ConverterAnchorFactory.new()).address);
                await factory.registerTypedConverterCustomFactory((await LiquidityPoolV2ConverterCustomFactory.new()).address);
            });

            beforeEach(async () => {
                bancorNetwork = await BancorNetwork.new(contractRegistry.address);
                await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

                oracleWhitelist = await Whitelist.new();
                await contractRegistry.registerAddress(registry.CHAINLINK_ORACLE_WHITELIST, oracleWhitelist.address);

                chainlinkPriceOracleA = await createChainlinkOracle(INITIAL_ORACLE_A_PRICE);
                chainlinkPriceOracleB = await createChainlinkOracle(INITIAL_ORACLE_B_PRICE);

                await oracleWhitelist.addAddress(chainlinkPriceOracleA.address);
                await oracleWhitelist.addAddress(chainlinkPriceOracleB.address);

                reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', reserveToken1Decimals, toReserve1(new BN(1000000000000)));
                reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', reserveToken2Decimals, toReserve2(new BN(2000000000000)));
            });

            describe('min-return', () => {
                it('addLiquidity should revert when min-return is zero', async () => {
                    const amount = toReserve2(new BN(100));
                    const converter = await initConverter(true, true);
                    await reserveToken2.approve(converter.address, amount, { from: sender });
                    await expectRevert(converter.addLiquidity(reserveToken2.address, amount, new BN(0), { from: sender }),
                        'ERR_ZERO_VALUE');
                });

                it('removeLiquidity should revert when min-return is zero', async () => {
                    const amount = toReserve2(new BN(100));
                    const converter = await initConverter(true, true);
                    await expectRevert(converter.removeLiquidity(poolToken2.address, amount, new BN(0), { from: sender }),
                        'ERR_ZERO_VALUE');
                });

                it('addLiquidity should revert when min-return is larger than return', async () => {
                    const amount = toReserve2(new BN(100));
                    const converter = await initConverter(true, true);
                    await reserveToken2.approve(converter.address, amount, { from: sender });
                    await expectRevert(converter.addLiquidity(reserveToken2.address, toReserve2(new BN(1)), amount, { from: sender }),
                        'ERR_RETURN_TOO_LOW');
                });

                it('removeLiquidity should revert when min-return is larger than return', async () => {
                    const converter = await initConverter(true, true);
                    await expectRevert(converter.removeLiquidity(poolToken2.address, toReserve2(new BN(1)),
                        toReserve2(new BN(100)), { from: sender }), 'ERR_RETURN_TOO_LOW');
                });
            });

            it('verifies the converter data after construction', async () => {
                const converter = await initConverter(false, false);

                const primary = await converter.primaryReserveToken.call();
                const secondary = await converter.secondaryReserveToken.call();
                expect(primary).to.eql(ZERO_ADDRESS);
                expect(secondary).to.eql(ZERO_ADDRESS);

                const oracle = await converter.priceOracle.call();
                expect(oracle).to.eql(ZERO_ADDRESS);
            });

            it('verifies that amplificationFactor returns the correct value', async () => {
                const converter = await initConverter(false, false);
                const factor = await converter.amplificationFactor.call();
                expect(factor).to.be.bignumber.equal(DEFAULT_AMPLIFICATION_FACTOR);
            });

            it('verifies that lowFeeFactor returns the correct value', async () => {
                const converter = await initConverter(false, false);
                const factor = await converter.lowFeeFactor.call();
                expect(factor).to.be.bignumber.equal(DEFAULT_LOW_FEE_FACTOR);
            });

            it('verifies that highFeeFactor returns the correct value', async () => {
                const converter = await initConverter(false, false);
                const factor = await converter.highFeeFactor.call();
                expect(factor).to.be.bignumber.equal(DEFAULT_HIGH_FEE_FACTOR);
            });

            it('verifies that isActive returns false before calling activate', async () => {
                const converter = await initConverter(false, false);
                expect(await converter.isActive.call()).to.be.false();
            });

            it('verifies that isActive returns true after calling activate', async () => {
                const converter = await initConverter(true, false);
                expect(await converter.isActive.call()).to.be.true();
            });

            it('verifies that the owner can activate the converter', async () => {
                const converter = await initConverter(false, false);
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
            });

            it('verifies the Activation event after converter activation', async () => {
                const converter = await initConverter(false, false);
                const res = await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);

                expectEvent(res, 'Activation', {
                    _type: new BN(2),
                    _anchor: anchorAddress,
                    _activated: true
                });
            });

            it('verifies that the primary / secondary reserves are set correctly when activating with the 1st reserve as primary', async () => {
                const converter = await initConverter(false, false);
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                const primary = await converter.primaryReserveToken.call();
                const secondary = await converter.secondaryReserveToken.call();
                expect(primary).to.eql(getReserve1Address(isETHReserve));
                expect(secondary).to.eql(reserveToken2.address);
            });

            it('verifies that the primary / secondary reserves are set correctly when activating with the 2st reserve as primary', async () => {
                const converter = await initConverter(false, false);
                await converter.activate(reserveToken2.address, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                const primary = await converter.primaryReserveToken.call();
                const secondary = await converter.secondaryReserveToken.call();
                expect(primary).to.eql(reserveToken2.address);
                expect(secondary).to.eql(getReserve1Address(isETHReserve));
            });

            it('verifies that the price oracle is created correctly when activating', async () => {
                const converter = await initConverter(false, false);
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                const oracle = await converter.priceOracle.call();
                expect(oracle).not.to.be.eql(ZERO_ADDRESS);
            });

            it('verifies that the pool rate is identical to the oracle rate after adding the initial liquidity', async () => {
                const converter = await initConverter(true, true);
                const externalRate = normalizeRates(INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, true);
                const poolRate = await getPoolRate(converter);
                const poolRateD = Decimal(poolRate.n.toString()).div(poolRate.d.toString());
                const externalRateD = Decimal(externalRate.n.toString()).div(externalRate.d.toString());
                expectAlmostEqual(poolRateD, externalRateD);
            });

            it('verifies that the pool rate does not change after adding liquidity', async () => {
                const converter = await initConverter(true, true);
                const prevPoolRate = await getPoolRate(converter);

                const newLiquidity2 = toReserve2(new BN(500000));
                await reserveToken2.approve(converter.address, newLiquidity2);
                await converter.addLiquidity(reserveToken2.address, newLiquidity2, MIN_RETURN);

                const newPoolRate = await getPoolRate(converter);

                const prevPoolRateD = Decimal(prevPoolRate.n.toString()).div(prevPoolRate.d.toString());
                const newPoolRateD = Decimal(newPoolRate.n.toString()).div(newPoolRate.d.toString());
                expectAlmostEqual(prevPoolRateD, newPoolRateD);
            });

            it('verifies that the pool rate is identical to the effective rate after adding the initial liquidity', async () => {
                const converter = await initConverter(true, true);
                const effectiveRate = await converter.effectiveTokensRate();
                const poolRate = await getPoolRate(converter);
                const poolRateD = Decimal(poolRate.n.toString()).div(poolRate.d.toString());
                const effectiveRateD = Decimal(effectiveRate[0].toString()).div(effectiveRate[1].toString());
                expectAlmostEqual(poolRateD, effectiveRateD);
            });

            it('should revert when attempting to activate an active converter', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address,
                    chainlinkPriceOracleB.address), 'ERR_ACTIVE');
            });

            it('should revert when a non owner attempts to activate the converter', async () => {
                const converter = await initConverter(false, false);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address,
                    chainlinkPriceOracleB.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when attempting to activate the converter while it does not own the anchor', async () => {
                anchor = await PoolTokensContainer.new('Pool', 'POOL', poolTokenDecimals);
                anchorAddress = anchor.address;

                const converter = await createConverter(anchorAddress, contractRegistry.address, 30000);
                await converter.addReserve(getReserve1Address(isETHReserve), 500000);
                await converter.addReserve(reserveToken2.address, 500000);
                await anchor.transferOwnership(converter.address);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve),
                    chainlinkPriceOracleA.address, chainlinkPriceOracleB.address), 'ERR_ANCHOR_NOT_OWNED');
            });

            it('should revert when attempting to activate the converter with an invalid primary reserve', async () => {
                const converter = await initConverter(false, false);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.activate(token.address, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address),
                    'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to activate the converter with zero primary reserve oracle address', async () => {
                const converter = await initConverter(false, false);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), ZERO_ADDRESS, chainlinkPriceOracleB.address),
                    'ERR_INVALID_ADDRESS');
            });

            // eslint-disable-next-line max-len
            it('should revert when attempting to activate the converter with the converter address as the primary reserve oracle address', async () => {
                const converter = await initConverter(false, false);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), converter.address, chainlinkPriceOracleB.address),
                    'ERR_ADDRESS_IS_SELF');
            });

            it('should revert when attempting to activate the converter with a non whitelisted primary reserve oracle', async () => {
                const converter = await initConverter(false, false);

                await oracleWhitelist.removeAddress(chainlinkPriceOracleA.address);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address),
                    'ERR_INVALID_ORACLE');
            });

            it('should revert when attempting to activate the converter with zero secondary reserve oracle address', async () => {
                const converter = await initConverter(false, false);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, ZERO_ADDRESS),
                    'ERR_INVALID_ADDRESS');
            });

            // eslint-disable-next-line max-len
            it('should revert when attempting to activate the converter with the converter address as the secondary reserve oracle address', async () => {
                const converter = await initConverter(false, false);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, converter.address),
                    'ERR_ADDRESS_IS_SELF');
            });

            it('should revert when attempting to activate the converter with a non whitelisted secondary reserve oracle', async () => {
                const converter = await initConverter(false, false);

                await oracleWhitelist.removeAddress(chainlinkPriceOracleB.address);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address),
                    'ERR_INVALID_ORACLE');
            });

            it('verifies that reserveStakedBalance returns the correct balance', async () => {
                const converter = await initConverter(true, false);
                const balance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance).to.be.bignumber.equal(new BN(0));

                const amount = toReserve1(new BN(10000));
                if (!isETHReserve) {
                    await reserveToken.approve(converter.address, amount, { from: sender });
                }

                await converter.addLiquidity(getReserve1Address(isETHReserve), amount, MIN_RETURN,
                    { value: isETHReserve ? amount : 0 });

                const balance2 = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance2).to.be.bignumber.equal(amount);

                const amount2 = toReserve1(new BN(2000));
                if (!isETHReserve) {
                    await reserveToken.approve(converter.address, amount2, { from: sender });
                }
                await converter.addLiquidity(getReserve1Address(isETHReserve), amount2, MIN_RETURN,
                    { value: isETHReserve ? amount2 : 0 });

                const balance3 = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance3).to.be.bignumber.equal(amount.add(amount2));
            });

            it('should revert when attempting to get the reserve staked balance with an invalid reserve address', async () => {
                const converter = await initConverter(true, false);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.reserveStakedBalance.call(token.address), 'ERR_INVALID_RESERVE');
            });

            it('verifies that the owner can set the staked balance when owner is the upgrader', async () => {
                const converter = await initConverter(true, false);
                const balance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance).to.be.bignumber.equal(new BN(0));

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender);

                const amount = toReserve1(new BN(2500));
                await converter.setReserveStakedBalance(getReserve1Address(isETHReserve), amount);

                const balance2 = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance2).to.be.bignumber.equal(amount);
            });

            it('should revert when the owner attempts to set the staked balance when the owner is not the converter upgrader', async () => {
                const converter = await initConverter(true, false);

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender);

                const amount = toReserve1(new BN(2500));
                await expectRevert(converter.setReserveStakedBalance(getReserve1Address(isETHReserve), amount,
                    { from: sender2 }), 'ERR_ACCESS_DENIED');
            });

            // eslint-disable-next-line max-len
            it('should revert when the converter upgrader attempts to set the staked balance when the converter upgrader is not the owner', async () => {
                const converter = await initConverter(true, false);

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender2);

                const amount = toReserve1(new BN(2500));
                await expectRevert(converter.setReserveStakedBalance(getReserve1Address(isETHReserve), amount,
                    { from: sender2 }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when attempting to set the staked balance with an invalid reserve address', async () => {
                const converter = await initConverter(true, false);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender);

                const amount = toReserve1(new BN(2500));
                await expectRevert(converter.setReserveStakedBalance(token.address, amount), 'ERR_INVALID_RESERVE');
            });

            it('verifies that the owner can set the max staked balance', async () => {
                const converter = await initConverter(true, true);

                let reserve1MaxStakedBalanace = await converter.maxStakedBalances(getReserve1Address(isETHReserve));
                let reserve2MaxStakedBalanace = await converter.maxStakedBalances(reserveToken2.address);

                expect(reserve1MaxStakedBalanace).to.be.bignumber.equal(new BN(0));
                expect(reserve2MaxStakedBalanace).to.be.bignumber.equal(new BN(0));

                const amount1 = toReserve1(new BN(1000));
                const amount2 = toReserve2(new BN(2000));
                await converter.setMaxStakedBalances(amount1, amount2);
                reserve1MaxStakedBalanace = await converter.maxStakedBalances(getReserve1Address(isETHReserve));
                reserve2MaxStakedBalanace = await converter.maxStakedBalances(reserveToken2.address);

                expect(reserve1MaxStakedBalanace).to.be.bignumber.equal(amount1);
                expect(reserve2MaxStakedBalanace).to.be.bignumber.equal(amount2);
            });

            it('should revert when a non owner attempts to set the max staked balance', async () => {
                const converter = await initConverter(true, true);

                const amount1 = toReserve1(new BN(1000));
                const amount2 = toReserve2(new BN(2000));
                await expectRevert(converter.setMaxStakedBalances(amount1, amount2, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('verifies that the owner can disable the max staked balances', async () => {
                const converter = await initConverter(true, true);

                expect(await converter.maxStakedBalanceEnabled()).to.be.true();

                await converter.disableMaxStakedBalances();

                expect(await converter.maxStakedBalanceEnabled()).to.be.false();
            });

            it('should revert when a non owner attempts to disable the max staked balances', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.disableMaxStakedBalances({ from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('verifies the owner can update the amplification factor', async () => {
                const converter = await initConverter(true, true);

                const prevAmplificationFactor = await converter.amplificationFactor.call();
                await converter.setAmplificationFactor(new BN(5));

                const newAmplificationFactor = await converter.amplificationFactor.call();
                expect(prevAmplificationFactor).not.to.be.bignumber.equal(newAmplificationFactor);
                expect(newAmplificationFactor).to.be.bignumber.equal(new BN(5));
            });

            it('should revert when a non owner attempts to update the amplification factorr', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.setAmplificationFactor(new BN(5), { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it.only('verifies that an event is fired when the owner updates the amplification factor', async () => {
                const converter = await initConverter(true, true);

                const prevAmplificationFactor = await converter.amplificationFactor.call();

                const res = await converter.setAmplificationFactor(new BN(5));
                expectEvent(res, 'AmplificationFactorUpdate', {
                    _prevAmplificationFactor: prevAmplificationFactor,
                    _newAmplificationFactor: new BN(5)
                });
            });

            it('verifies the owner can update the external rate propagation time', async () => {
                const converter = await initConverter(true, true);

                const prevPropagationTime = await converter.externalRatePropagationTime.call();
                const delta = new BN(100000);
                await converter.setExternalRatePropagationTime(prevPropagationTime.add(delta));

                const newPropagationTime = await converter.externalRatePropagationTime.call();
                expect(newPropagationTime).to.be.bignumber.equal(prevPropagationTime.add(delta));
            });

            it('should revert when a non owner attempts to update the external rate propagation time', async () => {
                const converter = await initConverter(true, true);

                const prevPropagationTime = await converter.externalRatePropagationTime.call();
                const delta = new BN(100000);

                await expectRevert(converter.setExternalRatePropagationTime(prevPropagationTime.add(delta), { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('verifies that an event is fired when the owner updates the external rate propagation time', async () => {
                const converter = await initConverter(true, true);

                const prevPropagationTime = await converter.externalRatePropagationTime.call();
                const delta = new BN(100000);

                const res = await converter.setExternalRatePropagationTime(prevPropagationTime.add(delta));
                expectEvent(res, 'ExternalRatePropagationTimeUpdate', {
                    _prevPropagationTime: prevPropagationTime,
                    _newPropagationTime: prevPropagationTime.add(delta)
                });
            });

            it('verifies the owner can update the fee factors', async () => {
                const converter = await initConverter(true, true);

                const newFactor = PPM_RESOLUTION.sub(new BN(10));
                await converter.setFeeFactors(newFactor, newFactor);

                const lowFeeFactor = await converter.lowFeeFactor.call();
                const highFeeFactor = await converter.highFeeFactor.call();
                expect(lowFeeFactor).to.be.bignumber.equal(newFactor);
                expect(highFeeFactor).to.be.bignumber.equal(newFactor);
            });

            it('should revert when attempting to update the low fee factor to an invalid value', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.setFeeFactors(PPM_RESOLUTION.add(new BN(1)), PPM_RESOLUTION),
                    'ERR_INVALID_FEE_FACTOR');
            });

            it('should revert when attempting to update the high fee factor to an invalid value', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.setFeeFactors(PPM_RESOLUTION, PPM_RESOLUTION.add(new BN(1))),
                    'ERR_INVALID_FEE_FACTOR');
            });

            it('should revert when a non owner attempts to update the fee factors', async () => {
                const converter = await initConverter(true, true);

                const newFactor = new BN(30000);
                await expectRevert(converter.setFeeFactors(newFactor, newFactor, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('verifies that an event is fired when the owner updates the fee factors', async () => {
                const converter = await initConverter(true, true);

                const prevLowFactor = await converter.lowFeeFactor.call();
                const prevHighFactor = await converter.highFeeFactor.call();
                const newFactor = new BN(30000);

                const res = await converter.setFeeFactors(newFactor, newFactor);
                expectEvent(res, 'FeeFactorsUpdate', {
                    _prevLowFactor: prevLowFactor,
                    _newLowFactor: newFactor,
                    _prevHighFactor: prevHighFactor,
                    _newHighFactor: newFactor
                });
            });

            it('verifies that an event is fired when the owner updates the fee factors multiple times', async () => {
                const converter = await initConverter(true, true);

                let prevLowFactor = await converter.lowFeeFactor.call();
                let prevHighFactor = await converter.highFeeFactor.call();
                for (let i = 1; i <= 10; ++i) {
                    const newFactor = new BN(10000 * i);

                    const res = await converter.setFeeFactors(newFactor, newFactor);
                    expectEvent(res, 'FeeFactorsUpdate', {
                        _prevLowFactor: prevLowFactor,
                        _newLowFactor: newFactor,
                        _prevHighFactor: prevHighFactor,
                        _newHighFactor: newFactor
                    });

                    prevLowFactor = newFactor;
                    prevHighFactor = newFactor;
                }
            });

            it('verifies that liquidationLimit returns the correct amount', async () => {
                const converter = await initConverter(true, true);

                const amount = toReserve1(new BN(8000));
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount,
                    MIN_RETURN, { value });

                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                const poolTokenSupply = await poolToken2.totalSupply.call();

                const expectedLimit = reserve2Balance.mul(poolTokenSupply).div(reserve2StakedBalance);
                const limit = await converter.liquidationLimit.call(poolToken2.address);
                expect(limit).to.be.bignumber.equal(expectedLimit);
            });

            it('should revert when attempting to add a third reserve', async () => {
                const converter = await createConverter(anchorAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), 500000);
                await converter.addReserve(reserveToken2.address, 300000);

                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.addReserve(token.address, 2000), 'ERR_INVALID_RESERVE_COUNT');
            });

            describe('weights & fees', async () => {
                const getConvereterTargetAmountAndFee = async (buyingPrimary, amount) => {
                    if (buyingPrimary) {
                        return converter.targetAmountAndFee.call(reserveToken2.address, getReserve1Address(isETHReserve), amount);
                    }

                    return converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, amount);
                };

                const convert = async (buyingPrimary, amount) => {
                    if (buyingPrimary) {
                        return convertAndReturnTargetAmount(converter, reserveToken2, reserveToken2.address,
                            getReserve1Address(isETHReserve), amount);
                    }

                    return convertAndReturnTargetAmount(converter, reserveToken, getReserve1Address(isETHReserve),
                        reserveToken2.address, amount);
                };

                const getExpectedConverterTargetAmountAndFee = async (sourceTokenAddress, targetTokenAddress, sourceOraclePrice,
                    targetOraclePrice, amount) => {
                    const sourceStakedBalance = await converter.reserveStakedBalance.call(sourceTokenAddress);
                    const targetStakedBalance = await converter.reserveStakedBalance.call(targetTokenAddress);
                    const sourceBalance = await converter.reserveBalance.call(sourceTokenAddress);
                    const targetBalance = await converter.reserveBalance.call(targetTokenAddress);

                    let effectiveWeights = await converter.effectiveReserveWeights.call();
                    const reserve2Address = await converter.reserveTokens.call(1);
                    if (sourceTokenAddress === reserve2Address) {
                        effectiveWeights = [effectiveWeights[1], effectiveWeights[0]];
                    }

                    const primary = await converter.primaryReserveToken.call();

                    return getExpectedTargetAmountAndFee(sourceStakedBalance, targetStakedBalance,
                        sourceBalance, targetBalance, effectiveWeights[0], effectiveWeights[1], sourceOraclePrice, targetOraclePrice,
                        lowFeeFactor, highFeeFactor, primary === sourceTokenAddress, amount);
                };

                const getConverterExpectedTargetAmountAndFee = async (buyingPrimary, amount) => {
                    const priceOracle = await PriceOracle.at(await converter.priceOracle.call());
                    const latestRate = await priceOracle.latestRate.call(getReserve1Address(isETHReserve), reserveToken2.address);
                    if (buyingPrimary) {
                        return getExpectedConverterTargetAmountAndFee(reserveToken2.address, getReserve1Address(isETHReserve),
                            latestRate[1], latestRate[0], amount);
                    }

                    return getExpectedConverterTargetAmountAndFee(getReserve1Address(isETHReserve), reserveToken2.address,
                        latestRate[0], latestRate[1], amount);
                };

                const lowFeeFactor = DEFAULT_LOW_FEE_FACTOR;
                const highFeeFactor = DEFAULT_HIGH_FEE_FACTOR;
                let converter;
                let reserveWeight;

                beforeEach(async () => {
                    converter = await initConverter(true, true, new BN(0));
                    await converter.setFeeFactors(DEFAULT_LOW_FEE_FACTOR, DEFAULT_HIGH_FEE_FACTOR);

                    // increase liquidity so that the fee will have more significant effect
                    const newLiquidity1 = toReserve1(new BN(10000000));

                    // approve the amount if needed
                    let value = 0;
                    if (isETHReserve) {
                        value = newLiquidity1;
                    }
                    else {
                        await reserveToken.approve(converter.address, newLiquidity1);
                    }

                    await converter.addLiquidity(getReserve1Address(isETHReserve), newLiquidity1, MIN_RETURN, { value });

                    const newLiquidity2 = toReserve2(new BN(12000000));
                    await reserveToken2.approve(converter.address, newLiquidity2);
                    await converter.addLiquidity(reserveToken2.address, newLiquidity2, MIN_RETURN);
                });

                context('fees', async () => {
                    for (const increasePrimaryRate of [true, false]) {
                        context(`when ${increasePrimaryRate ? 'increasing' : 'decreasing'} the primary pool rate`, async () => {
                            for (const buyingPrimary of [true, false]) {
                                context(`when buying the ${buyingPrimary ? 'primary' : 'secondary'} reserve`, async () => {
                                    beforeEach(async () => {
                                        reserveWeight = (await converter.effectiveReserveWeights.call())[0];

                                        if (increasePrimaryRate) {
                                            // buy primary token (removes primary tokens from the pool)
                                            await convert(true, toReserve2(new BN(2500)));
                                        }
                                        else {
                                            // buy secondary token (brings extra primary tokens to the pool)
                                            await convert(false, toReserve1(new BN(2500)));
                                        }
                                    });

                                    // fee is applied whenever the target pool rate is lower than the external rate
                                    const feeEnabled =
                                        (increasePrimaryRate && !buyingPrimary) ||
                                        (!increasePrimaryRate && buyingPrimary);
                                    const amount = toReserve(!buyingPrimary, new BN(20000));

                                    if (feeEnabled) {
                                        it('targetAmountAndFee should return the correct fee amount', async () => {
                                            const { targetAmount, fee } =
                                                await getConverterExpectedTargetAmountAndFee(buyingPrimary, amount);
                                            expect(fee).to.be.bignumber.above(new BN(0));

                                            const res = await getConvereterTargetAmountAndFee(buyingPrimary, amount);
                                            expectAlmostEqual(targetAmount, res[0]);
                                            expectAlmostEqual(fee, res[1]);
                                        });

                                        it('should convert with fee', async () => {
                                            const { targetAmount, fee } =
                                                await getConverterExpectedTargetAmountAndFee(buyingPrimary, amount);
                                            expect(fee).to.be.bignumber.above(new BN(0));

                                            const actualTargetAmount = await convert(buyingPrimary, amount);
                                            expectAlmostEqual(actualTargetAmount, targetAmount);
                                        });

                                        // eslint-disable-next-line max-len
                                        it('should increase the staked balance with by the entire fee amount if the pool is not in deficit', async () => {
                                            const { fee } = await getConverterExpectedTargetAmountAndFee(buyingPrimary, amount);

                                            let prevStakedBalance;
                                            if (buyingPrimary) {
                                                prevStakedBalance = await converter.reserveStakedBalance(getReserve1Address(isETHReserve));
                                            }
                                            else {
                                                prevStakedBalance = await converter.reserveStakedBalance(reserveToken2.address);
                                            }

                                            await convert(buyingPrimary, amount);

                                            let newStakedBalance;
                                            if (buyingPrimary) {
                                                newStakedBalance = await converter.reserveStakedBalance(getReserve1Address(isETHReserve));
                                            }
                                            else {
                                                newStakedBalance = await converter.reserveStakedBalance(reserveToken2.address);
                                            }

                                            expectAlmostEqual(newStakedBalance, prevStakedBalance.add(fee));
                                        });

                                        it('should increase the staked balance by half the fee amount if the pool is in deficit', async () => {
                                            const { fee } = await getConverterExpectedTargetAmountAndFee(buyingPrimary, amount);

                                            if (buyingPrimary) {
                                                // increase primary external rate
                                                await chainlinkPriceOracleA.setAnswer(INITIAL_ORACLE_A_PRICE.mul(new BN(3)));
                                            }
                                            else {
                                                // decrease primary external rate
                                                await chainlinkPriceOracleB.setAnswer(INITIAL_ORACLE_B_PRICE.mul(new BN(3)));
                                            }

                                            let prevStakedBalance;
                                            if (buyingPrimary) {
                                                prevStakedBalance = await converter.reserveStakedBalance(getReserve1Address(isETHReserve));
                                            }
                                            else {
                                                prevStakedBalance = await converter.reserveStakedBalance(reserveToken2.address);
                                            }

                                            await convert(buyingPrimary, amount);

                                            let newStakedBalance;
                                            if (buyingPrimary) {
                                                newStakedBalance = await converter.reserveStakedBalance(getReserve1Address(isETHReserve));
                                            }
                                            else {
                                                newStakedBalance = await converter.reserveStakedBalance(reserveToken2.address);
                                            }

                                            expectAlmostEqual(newStakedBalance, prevStakedBalance.add(fee));
                                        });
                                    }
                                    else {
                                        it('targetAmountAndFee should not include any fee', async () => {
                                            const { targetAmount } =
                                                await getConverterExpectedTargetAmountAndFee(buyingPrimary, amount);
                                            const res = await getConvereterTargetAmountAndFee(buyingPrimary, amount);
                                            expectAlmostEqual(targetAmount, res[0]);
                                            expect(res[1]).to.be.bignumber.equal(new BN(0));
                                        });

                                        it('should convert with no fee', async () => {
                                            const { targetAmount } =
                                                await getConverterExpectedTargetAmountAndFee(buyingPrimary, amount);
                                            const actualTargetAmount = await convert(buyingPrimary, amount);
                                            expectAlmostEqual(actualTargetAmount, targetAmount);
                                        });
                                    }
                                });
                            }
                        });
                    }
                });

                context('weights', async () => {
                    let now;
                    const increaseTime = async (delta) => {
                        now = now.add(delta);
                        await converter.setTime(now);
                    };

                    let externalRate;
                    let effectiveRate;
                    let effectiveReserveWeight;

                    for (const rateChange of [-1, 1, 0]) {
                        // eslint-disable-next-line max-len
                        context(`when the primary external rate ${rateChange === -1 ? 'decreases' : rateChange === 1 ? 'increases' : 'does not change'}`, async () => {
                            for (const buyingPrimary of [true, false]) {
                                context(`when buying the ${buyingPrimary ? 'primary' : 'secondary'} reserve`, async () => {
                                    for (const minutes of [0, 1]) {
                                        context(`when ${minutes === 0 ? 'no' : 'some'} time has passed`, async () => {
                                            beforeEach(async () => {
                                                // ensuring that all previous propagation is complete
                                                now = await latest();
                                                const hour = duration.minutes(60);
                                                await increaseTime(hour);
                                                await convert(true, toReserve2(new BN(1)));

                                                externalRate = normalizeRates(INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, true);
                                                effectiveRate = await converter.effectiveTokensRate();
                                                effectiveRate = {
                                                    n: effectiveRate[0],
                                                    d: effectiveRate[1]
                                                };
                                                reserveWeight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                                                effectiveReserveWeight = (await converter.effectiveReserveWeights.call())[0];

                                                if (rateChange === -1) {
                                                    // decrease primary external rate
                                                    externalRate.d = externalRate.d.mul(new BN(3));
                                                    await chainlinkPriceOracleB.setAnswer(externalRate.d);
                                                    await chainlinkPriceOracleB.setTimestamp(now);
                                                }
                                                else if (rateChange === 1) {
                                                    // increase primary external rate
                                                    externalRate.n = externalRate.n.mul(new BN(3));
                                                    await chainlinkPriceOracleA.setAnswer(externalRate.n);
                                                    await chainlinkPriceOracleA.setTimestamp(now);
                                                }

                                                if (minutes > 0) {
                                                    const elapsed = duration.minutes(minutes);
                                                    await increaseTime(elapsed);
                                                }

                                                if (buyingPrimary) {
                                                    // buy primary token (removes primary tokens from the pool)
                                                    await convert(true, toReserve2(new BN(250)));
                                                }
                                                else {
                                                    // buy secondary token (brings extra primary tokens to the pool)
                                                    await convert(false, toReserve1(new BN(250)));
                                                }

                                                // verify that the pool rate is indeed below the external rate
                                                const poolRate = await getPoolRate(converter);
                                                if (buyingPrimary) {
                                                    expect(compareRates(poolRate, externalRate) < 0);
                                                }
                                                else {
                                                    expect(compareRates(poolRate, externalRate) > 0);
                                                }
                                            });

                                            if (rateChange === 0 || minutes === 0) {
                                                it('should not change the effective rate', async () => {
                                                    let newEffectiveRate = await converter.effectiveTokensRate();
                                                    newEffectiveRate = {
                                                        n: newEffectiveRate[0],
                                                        d: newEffectiveRate[1]
                                                    };
                                                    expect(compareRates(newEffectiveRate, effectiveRate) === 0);
                                                });

                                                it('should not move the effective reserve weights', async () => {
                                                    const newEffectiveWeight = (await converter.effectiveReserveWeights.call())[0];
                                                    expect(newEffectiveWeight).to.be.bignumber.equal(effectiveReserveWeight);
                                                });

                                                it('should not change the reserve weights', async () => {
                                                    const newReserveWeight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                                                    expect(reserveWeight).to.be.bignumber.equal(newReserveWeight);
                                                });
                                            }
                                            else {
                                                it('should move the effective rate in the right direction', async () => {
                                                    let newEffectiveRate = await converter.effectiveTokensRate();
                                                    newEffectiveRate = {
                                                        n: newEffectiveRate[0],
                                                        d: newEffectiveRate[1]
                                                    };

                                                    if (rateChange === 1) {
                                                        expect(compareRates(newEffectiveRate, effectiveRate) > 0);
                                                    }
                                                    else {
                                                        expect(compareRates(newEffectiveRate, effectiveRate) < 0);
                                                    }
                                                });

                                                it('should move the effective reserve weights in the right direction', async () => {
                                                    const newEffectiveWeight = (await converter.effectiveReserveWeights.call())[0];

                                                    if (rateChange === 1) {
                                                        expect(newEffectiveWeight).to.be.bignumber.gt(effectiveReserveWeight);
                                                    }
                                                    else {
                                                        expect(newEffectiveWeight).to.be.bignumber.lt(effectiveReserveWeight);
                                                    }
                                                });

                                                it('should move the reserve weights in the right direction', async () => {
                                                    const newReserveWeight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));

                                                    if (rateChange === 1) {
                                                        expect(newReserveWeight).to.be.bignumber.gt(reserveWeight);
                                                    }
                                                    else {
                                                        expect(newReserveWeight).to.be.bignumber.lt(reserveWeight);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            });

            it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(true, true);

                const amount = toReserve1(new BN(500));
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount,
                    toReserve2(new BN(20000)), { value }), 'ERR_RETURN_TOO_LOW');
            });

            it('should revert when attempting to buy while the purchase yields 0 return', async () => {
                await initConverter(true, true);

                const amount = new BN(1);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                    await reserveToken2.approve(bancorNetwork.address, amount, { from: sender });
                }

                if (reserveToken1Decimals.gte(reserveToken2Decimals)) {
                    await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount,
                        MIN_RETURN, { value }), 'ERR_ZERO_TARGET_AMOUNT');
                }
                else {
                    await expectRevert(convert([reserveToken2.address, anchorAddress, getReserve1Address(isETHReserve)], amount,
                        MIN_RETURN, { value }), 'ERR_ZERO_TARGET_AMOUNT');
                }
            });

            it('should revert when attempting to buy too many tokens', async () => {
                await initConverter(true, true);

                const amount = toReserve1(new BN(100000000000));
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount,
                    MIN_RETURN, { value }), 'ERR_TARGET_AMOUNT_TOO_HIGH');
            });

            it('should revert when attempting to convert when source reserve is invalid', async () => {
                await initConverter(true, true);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await token.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([token.address, anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to convert when target reserve is invalid', async () => {
                await initConverter(true, true);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, token.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE');
            });

            it('verifies that liquidity cannot exceed the max staked balance', async () => {
                const converter = await initConverter(true, false, 5000);

                let amount = toReserve2(new BN(40000));
                await converter.setMaxStakedBalances(toReserve1(new BN(20000)), amount);

                await reserveToken2.approve(converter.address, amount, { from: sender });
                await converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN);

                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);

                expect(reserve2StakedBalance).be.bignumber.equal(amount);

                amount = new BN(1);

                await reserveToken2.approve(converter.address, amount, { from: sender });
                await expectRevert(converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN), 'ERR_MAX_STAKED_BALANCE_REACHED');
            });

            it('verifies that liquidity can exceed the max staked balance once max staked balances is disabled', async () => {
                const converter = await initConverter(true, false, 5000);

                let amount = toReserve2(new BN(40000));
                await converter.setMaxStakedBalances(toReserve1(new BN(20000)), amount);

                await reserveToken2.approve(converter.address, amount, { from: sender });
                await converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN);

                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);

                expect(reserve2StakedBalance).to.be.bignumber.equal(amount);

                await converter.disableMaxStakedBalances();

                amount = new BN(100);

                await reserveToken2.approve(converter.address, amount, { from: sender });
                await converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN);
            });

            it('verifies the TokenRateUpdate events when adding liquidity', async () => {
                const converter = await initConverter(true, true, 5000);

                const amount = toReserve2(new BN(800));
                await reserveToken2.approve(converter.address, amount, { from: sender });
                const res = await converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN);

                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const reserve1Weight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                const reserve2Weight = await converter.reserveWeight.call(reserveToken2.address);
                const poolTokenSupply = await poolToken2.totalSupply.call();

                // apply amplification factor
                const n = reserve2StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve2Balance).mul(reserve1Weight);
                const d = reserve1StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve1Balance).mul(reserve2Weight);
                const ratio = MathUtils.reducedRatio(n.toString(), d.toString(), MAX_RATE_FACTOR_LOWER_BOUND);
                const [rateN, rateD] = ratio.map(x => new BN(x));

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: poolToken2.address,
                    _token2: reserveToken2.address,
                    _rateN: reserve2StakedBalance,
                    _rateD: poolTokenSupply
                });

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: getReserve1Address(isETHReserve),
                    _token2: reserveToken2.address,
                    _rateN: rateN,
                    _rateD: rateD
                });
            });

            it('verifies the TokenRateUpdate events when removing liquidity', async () => {
                const converter = await initConverter(true, true, 5000);

                const amount = toPool(new BN(800));
                const res = await converter.removeLiquidity(poolToken1.address, amount, MIN_RETURN);

                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const reserve1Weight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                const reserve2Weight = await converter.reserveWeight.call(reserveToken2.address);
                const poolTokenSupply = await poolToken1.totalSupply.call();

                // apply amplification factor
                const n = reserve2StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve2Balance).mul(reserve1Weight);
                const d = reserve1StakedBalance.mul(DEFAULT_AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve1Balance).mul(reserve2Weight);
                const ratio = MathUtils.reducedRatio(n.toString(), d.toString(), MAX_RATE_FACTOR_LOWER_BOUND);
                const [rateN, rateD] = ratio.map(x => new BN(x));

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: poolToken1.address,
                    _token2: getReserve1Address(isETHReserve),
                    _rateN: reserve1StakedBalance,
                    _rateD: poolTokenSupply
                });

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: getReserve1Address(isETHReserve),
                    _token2: reserveToken2.address,
                    _rateN: rateN,
                    _rateD: rateD
                });
            });

            for (const isOwner of [true, false]) {
                for (const isEmpty of [true, false]) {
                    for (const isReserve1 of [true, false]) {
                        // eslint-disable-next-line max-len
                        describe(`${isReserve1 ? 'adding reserve1' : 'adding reserve2'} ${isEmpty ? 'to an empty pool' : 'to a non empty pool'},`, () => {
                            it(`verifies all balances after ${isOwner ? 'the owner' : 'a non owner'} adds liquidity`, async () => {
                                const conversionFee = new BN(3000);
                                const converter = await initConverter(true, !isEmpty, 5000);
                                await converter.setConversionFee(conversionFee);

                                // get the caller account
                                const account = isOwner ? sender : sender2;

                                // get the reserve and its address
                                let reserve;
                                let reserveAddress;
                                let amount;
                                if (isReserve1) {
                                    amount = toReserve1(new BN(800));
                                    reserveAddress = getReserve1Address(isETHReserve);

                                    if (!isETHReserve) {
                                        reserve = reserveToken;

                                        if (!isOwner) {
                                            await reserveToken.transfer(sender2, amount);
                                        }
                                    }
                                }
                                else {
                                    amount = toReserve2(new BN(800));
                                    reserveAddress = reserveToken2.address;
                                    reserve = reserveToken2;

                                    if (!isOwner) {
                                        await reserveToken2.transfer(sender2, amount);
                                    }
                                }

                                // approve the amount if needed
                                let value = 0;
                                if (isETHReserve && isReserve1) {
                                    value = amount;
                                }
                                else {
                                    await reserve.approve(converter.address, amount, { from: account });
                                }

                                const poolToken = isReserve1 ? poolToken1 : poolToken2;
                                const poolTokenSupply = await poolToken.totalSupply.call();

                                const prevReserveBalance = await getBalance(reserve, reserveAddress, account);
                                const prevConverterBalance = await getBalance(reserve, reserveAddress, converter.address);
                                const prevStakedBalance = await converter.reserveStakedBalance.call(reserveAddress);
                                const prevPoolTokenBalance = await getBalance(poolToken, poolToken.address, account);
                                const res = await converter.addLiquidity(reserveAddress, amount, MIN_RETURN, { from: account, value });

                                const newReserveBalance = await getBalance(reserve, reserveAddress, account);
                                const newConverterBalance = await getBalance(reserve, reserveAddress, converter.address);
                                const newStakedBalance = await converter.reserveStakedBalance.call(reserveAddress);
                                const newPoolTokenBalance = await getBalance(poolToken, poolToken.address, account);

                                let transactionCost = new BN(0);
                                if (isETHReserve && isReserve1) {
                                    transactionCost = await getTransactionCost(res);
                                }

                                // check balances
                                expect(prevReserveBalance.sub(transactionCost).sub(amount)).to.be.bignumber.equal(newReserveBalance);
                                expect(prevStakedBalance.add(amount)).to.be.bignumber.equal(newStakedBalance);
                                expect(prevConverterBalance.add(amount)).to.be.bignumber.equal(newConverterBalance);

                                // check pool token balance
                                let expectedPoolTokenAmount = new BN(0);
                                if (isEmpty) {
                                    expectedPoolTokenAmount = amount;
                                }
                                else {
                                    expectedPoolTokenAmount = amount.mul(poolTokenSupply).div(prevStakedBalance);
                                }

                                expect(prevPoolTokenBalance.add(expectedPoolTokenAmount)).to.be.bignumber.equal(newPoolTokenBalance);
                            });
                        });
                    }
                }
            }

            for (const isReserve1Primary of [true, false]) {
                for (const isEmpty of [true, false]) {
                    for (const isReserve1 of [true, false]) {
                        // eslint-disable-next-line max-len
                        describe(`${isReserve1Primary ? 'reserve1 is primary' : 'reserve2 is primary'}, ${isReserve1 ? 'adding reserve1' : 'adding reserve2'} ${isEmpty ? 'to an empty pool' : 'to a non empty pool'},`, () => {
                            it('verifies the new weights after adding liquidity', async () => {
                                // get the reserve and its address
                                const reserve1Data = [getReserve1(isETHReserve), getReserve1Address(isETHReserve)];
                                const reserve2Data = [reserveToken2, reserveToken2.address];

                                let liquidity;
                                let reserveData;

                                if (isReserve1) {
                                    reserveData = reserve1Data;
                                    liquidity = toReserve1(new BN(800));
                                }
                                else {
                                    reserveData = reserve2Data;
                                    liquidity = toReserve2(new BN(800));
                                }

                                const primaryReserveAddress = isReserve1Primary ? reserve1Data[1] : reserve2Data[1];
                                const conversionFee = new BN(3000);
                                const converter = await initConverter(true, !isEmpty, 5000, primaryReserveAddress);
                                await converter.setConversionFee(conversionFee);

                                // approve the amount if needed
                                let value = 0;
                                if (isETHReserve && isReserve1) {
                                    value = liquidity;
                                }
                                else {
                                    await reserveData[0].approve(converter.address, liquidity, { from: sender });
                                }

                                // add the liquidity
                                await converter.addLiquidity(reserveData[1], liquidity, MIN_RETURN, { value });

                                // get new staked balances
                                let reserve1StakedBalance = new BN(isEmpty ? 0 : INITIAL_RESERVE1_LIQUIDITY);
                                let reserve2StakedBalance = new BN(isEmpty ? 0 : INITIAL_RESERVE2_LIQUIDITY);
                                if (isReserve1) {
                                    reserve1StakedBalance = reserve1StakedBalance.add(liquidity);
                                }
                                else {
                                    reserve2StakedBalance = reserve2StakedBalance.add(liquidity);
                                }

                                // get expected weights
                                const expectedWeights = getExpectedWeights(
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, conversionFee, isReserve1Primary
                                );

                                const reserveWeight1 = await converter.reserveWeight.call(reserve1Data[1]);
                                const reserveWeight2 = await converter.reserveWeight.call(reserve2Data[1]);

                                // compare expected weights vs the actual weights
                                expectAlmostEqual(reserveWeight1, expectedWeights[0]);
                                expectAlmostEqual(reserveWeight2, expectedWeights[1]);
                            });
                        });
                    }
                }
            }

            it('should revert when attempting to add liquidity when the converter is not active', async () => {
                const converter = await initConverter(false, false);

                const amount = toReserve1(new BN(700));

                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(converter.address, amount, { from: sender });
                }

                await expectRevert(converter.addLiquidity(getReserve1Address(isETHReserve), amount, MIN_RETURN, { value }), 'ERR_INACTIVE');
            });

            it('should revert when attempting to add liquidity with an invalid reserve token address', async () => {
                const converter = await initConverter(true, true);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                const amount = new BN(700);

                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await token.approve(converter.address, amount, { from: sender });
                }

                await expectRevert(converter.addLiquidity(token.address, amount, MIN_RETURN, { value }), 'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to add liquidity with zero amount', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.addLiquidity(getReserve1Address(isETHReserve), 0, MIN_RETURN), 'ERR_ZERO_VALUE');
            });

            for (const isOwner of [true, false]) {
                for (const isEntireSupply of [true, false]) {
                    for (const isPoolToken1 of [true, false]) {
                        // eslint-disable-next-line max-len
                        describe(`removing ${isEntireSupply ? 'entire' : 'partial'} ${isPoolToken1 ? 'pool token 1' : 'pool token 2'} supply,`, () => {
                            it(`verifies all balances after ${isOwner ? 'the owner' : 'a non owner'} removes liquidity`, async () => {
                                const conversionFee = new BN(3000);
                                const converter = await initConverter(true, true, 5000);
                                await converter.setConversionFee(conversionFee);

                                // get the pool token
                                const poolToken = isPoolToken1 ? poolToken1 : poolToken2;
                                const poolTokenSupply = await poolToken.totalSupply.call();

                                // get the reserve and its address
                                const reserve1Data = [getReserve1(isETHReserve), getReserve1Address(isETHReserve)];
                                const reserve2Data = [reserveToken2, reserveToken2.address];
                                const reserveData = isPoolToken1 ? reserve1Data : reserve2Data;

                                let amount;
                                if (isEntireSupply) {
                                    amount = poolTokenSupply;
                                }
                                else {
                                    amount = toPool(new BN(100));
                                }

                                // get the caller account
                                const account = isOwner ? sender : sender2;
                                if (!isOwner) {
                                    await poolToken.transfer(sender2, amount);
                                }

                                const prevPoolTokenBalance = await getBalance(poolToken, poolToken.address, account);
                                const prevConverterBalance = await getBalance(reserveData[0], reserveData[1], converter.address);
                                const prevStakedBalance = await converter.reserveStakedBalance.call(reserveData[1]);
                                const prevReserveBalance = await getBalance(reserveData[0], reserveData[1], account);
                                const res = await converter.removeLiquidity(poolToken.address, amount, MIN_RETURN, { from: account });

                                const newPoolTokenBalance = await getBalance(poolToken, poolToken.address, account);
                                const newConverterBalance = await getBalance(reserveData[0], reserveData[1], converter.address);
                                const newStakedBalance = await converter.reserveStakedBalance.call(reserveData[1]);
                                const newReserveBalance = await getBalance(reserveData[0], reserveData[1], account);

                                let transactionCost = new BN(0);
                                if (isETHReserve && isPoolToken1) {
                                    transactionCost = await getTransactionCost(res);
                                }

                                // check balances
                                expect(prevPoolTokenBalance.sub(amount)).to.be.bignumber.equal(newPoolTokenBalance);
                                expect(prevStakedBalance.sub(amount)).to.be.bignumber.equal(newStakedBalance);
                                expect(prevConverterBalance.sub(amount)).to.be.bignumber.equal(newConverterBalance);

                                // check reserve balance
                                let expectedReserveAmount;
                                if (isEntireSupply) {
                                    expectedReserveAmount = amount;
                                }
                                else {
                                    expectedReserveAmount = amount.mul(prevStakedBalance).div(poolTokenSupply);
                                }

                                expect(prevReserveBalance.sub(transactionCost).add(expectedReserveAmount)).to.be.bignumber.equal(newReserveBalance);
                            });
                        });
                    }
                }
            }

            for (const isReserve1Primary of [true, false]) {
                for (const isEntireSupply of [true, false]) {
                    for (const isPoolToken1 of [true, false]) {
                        // eslint-disable-next-line max-len
                        describe(`${isReserve1Primary ? 'reserve1 is primary' : 'reserve2 is primary'}, removing ${isEntireSupply ? 'entire' : 'partial'} ${isPoolToken1 ? 'pool token 1' : 'pool token 2'} supply,`, () => {
                            it('verifies the new weights after removing liquidity', async () => {
                                const primaryReserveAddress = isReserve1Primary ? getReserve1Address(isETHReserve) : reserveToken2.address;
                                const conversionFee = new BN(3000);
                                const converter = await initConverter(true, true, 5000, primaryReserveAddress);
                                await converter.setConversionFee(conversionFee);

                                // get the pool token
                                const poolToken = isPoolToken1 ? poolToken1 : poolToken2;
                                const poolTokenSupply = await poolToken.totalSupply.call();

                                let amount;
                                if (isEntireSupply) {
                                    amount = poolTokenSupply;
                                }
                                else {
                                    amount = toPool(new BN(100));
                                }

                                await converter.removeLiquidity(poolToken.address, amount, MIN_RETURN);

                                // get new staked balances
                                let reserve1StakedBalance = new BN(INITIAL_RESERVE1_LIQUIDITY);
                                let reserve2StakedBalance = new BN(INITIAL_RESERVE2_LIQUIDITY);
                                if (isPoolToken1) {
                                    reserve1StakedBalance = reserve1StakedBalance.sub(amount);
                                }
                                else {
                                    reserve2StakedBalance = reserve2StakedBalance.sub(amount);
                                }

                                // get expected weights
                                const expectedWeights = getExpectedWeights(
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, conversionFee, isReserve1Primary
                                );

                                const reserveWeight1 = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                                const reserveWeight2 = await converter.reserveWeight.call(reserveToken2.address);

                                expectAlmostEqual(reserveWeight1, expectedWeights[0]);
                                expectAlmostEqual(reserveWeight2, expectedWeights[1]);
                            });
                        });
                    }
                }
            }

            it('should revert when attempting to remove liquidity with an invalid pool token address', async () => {
                const converter = await initConverter(true, true);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.removeLiquidity(token.address, 100, MIN_RETURN), 'ERR_INVALID_POOL_TOKEN');
            });

            it('should revert when attempting to remove liquidity with zero amount', async () => {
                const converter = await initConverter(true, true);

                await expectRevert(converter.removeLiquidity(poolToken1.address, 0, MIN_RETURN), 'ERR_ZERO_VALUE');
            });

            it('should revert when attempting to call target amount and fee when the primary reserve weight is 0', async () => {
                const converter = await initConverter(true, true);

                const amount = toReserve1(new BN(500));

                await converter.setReserveWeight(getReserve1Address(isETHReserve), 0);
                await expectRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address,
                    amount), 'ERR_INVALID_RESERVE_WEIGHT');
            });

            it('should revert when attempting to call target amount and fee when the secondary reserve weight is 0', async () => {
                const converter = await initConverter(true, true);

                const amount = toReserve1(new BN(500));

                await converter.setReserveWeight(reserveToken2.address, 0);
                await expectRevert(converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address,
                    amount), 'ERR_INVALID_RESERVE_WEIGHT');
            });

            it('should revert when attempting to convert when the primary reserve weight is 0', async () => {
                const converter = await initConverter(true, true);

                const amount = toReserve1(new BN(500));
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await converter.setReserveWeight(getReserve1Address(isETHReserve), 0);
                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE_WEIGHT');
            });

            it('should revert when attempting to convert when the secondary reserve weight is 0', async () => {
                const converter = await initConverter(true, true);

                const amount = toReserve1(new BN(500));
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                }
                else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await converter.setReserveWeight(reserveToken2.address, 0);
                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE_WEIGHT');
            });

            if (!isETHReserve) {
                describe('exit fee', () => {
                    for (let i = 1; i <= 5; i++) {
                        const reserveTokenAmount = toReserve1(new BN(123 * i));
                        const poolTokenAmount = toPool(new BN(456 * i));

                        // eslint-disable-next-line max-len
                        it(`convert ${reserveTokenAmount.toString()} reserve tokens and then remove ${poolTokenAmount.toString()} pool tokens`, async () => {
                            const converter = await initConverter(true, true);

                            await reserveToken.approve(bancorNetwork.address, reserveTokenAmount, { from: sender });
                            await convert([reserveToken.address, anchorAddress, reserveToken2.address], reserveTokenAmount,
                                MIN_RETURN, { from: sender });

                            const oldTotalSupply = await poolToken1.totalSupply.call();
                            const oldUserBalance = await reserveToken.balanceOf.call(sender);
                            const oldActualBalance = await reserveToken.balanceOf.call(converter.address);
                            const oldStakedBalance = await converter.reserveStakedBalance.call(reserveToken.address);

                            const tokensRateAccuracy = await getTokensRateAccuracy(converter);
                            const expectedAmountBeforeFee = poolTokenAmount.mul(oldStakedBalance).div(oldTotalSupply);
                            const expectedAmountAfterFee = expectedAmountBeforeFee.mul(tokensRateAccuracy[0]).div(tokensRateAccuracy[1]);
                            const actualAmountAfterFeeAndFee = await converter.removeLiquidityReturnAndFee.call(poolToken1.address, poolTokenAmount);

                            await converter.removeLiquidity(poolToken1.address, poolTokenAmount, MIN_RETURN, { from: sender });

                            const newTotalSupply = await poolToken1.totalSupply.call();
                            const newUserBalance = await reserveToken.balanceOf.call(sender);
                            const newActualBalance = await reserveToken.balanceOf.call(converter.address);
                            const newStakedBalance = await converter.reserveStakedBalance.call(reserveToken.address);

                            expect(newTotalSupply).to.be.bignumber.equal(oldTotalSupply.sub(poolTokenAmount));
                            expect(newUserBalance).to.be.bignumber.equal(oldUserBalance.add(expectedAmountAfterFee));
                            expect(newActualBalance).to.be.bignumber.equal(oldActualBalance.sub(expectedAmountAfterFee));
                            expect(newStakedBalance).to.be.bignumber.equal(oldStakedBalance.sub(expectedAmountAfterFee));
                            expect(actualAmountAfterFeeAndFee[0]).to.be.bignumber.equal(expectedAmountAfterFee);
                            expect(actualAmountAfterFeeAndFee[1]).to.be.bignumber.equal(expectedAmountBeforeFee.sub(expectedAmountAfterFee));
                        });
                    }
                });

                // main conversion tests
                for (const liquidity1 of [10000, 51000, 100000]) {
                    for (const liquidity2 of [14000, 47000, 92000]) {
                        describe(`liquidity: [${liquidity1},${liquidity2}],`, () => {
                            for (const source of [1, 2]) {
                                for (const amountPercentage of [20, 40, 95]) {
                                    for (const source2 of [1, 2]) {
                                        for (const amountPercentage2 of [20, 40, 95]) {
                                            // eslint-disable-next-line max-len
                                            it(`verifies conversion of ${amountPercentage} percent of reserve ${source} and then ${amountPercentage2} percent of reserve ${source2}`, async () => {
                                                const conversionFee = new BN(4000);
                                                const converter = await initConverter(true, false, 5000);
                                                await converter.setConversionFee(conversionFee);

                                                // add liquidity
                                                const reserve1Liquidity = toReserve1(new BN(liquidity1));
                                                const reserve2Liquidity = toReserve2(new BN(liquidity2));
                                                await reserveToken.approve(converter.address, reserve1Liquidity, { from: sender });
                                                await reserveToken2.approve(converter.address, reserve2Liquidity, { from: sender });
                                                await converter.addLiquidity(reserveToken.address, reserve1Liquidity, MIN_RETURN);
                                                await converter.addLiquidity(reserveToken2.address, reserve2Liquidity, MIN_RETURN);

                                                let reserve1Balance = new BN(reserve1Liquidity);
                                                let reserve2Balance = new BN(reserve2Liquidity);
                                                const [expectedWeights, adjustedFee] = getExpectedWeightsAndFee(
                                                    reserve1Liquidity, reserve2Liquidity,
                                                    reserve1Liquidity, reserve2Liquidity,
                                                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, conversionFee
                                                );

                                                // Conversion #1

                                                // get reserve data
                                                let reserve1Data = [reserveToken, reserveToken.address, reserve1Liquidity, reserve1Balance,
                                                    expectedWeights[0]];
                                                let reserve2Data = [reserveToken2, reserveToken2.address, reserve2Liquidity, reserve2Balance,
                                                    expectedWeights[1]];

                                                // get source / target data
                                                let [sourceToken, sourceTokenAddress, sourceStakedBalance, sourceBalance, sourceWeight] =
                                                    source === 1 ? reserve1Data : reserve2Data;
                                                let [/* targetToken */, targetTokenAddress, targetStakedBalance, targetBalance, targetWeight] =
                                                    source === 1 ? reserve2Data : reserve1Data;

                                                // get amount (and mitigate rounding errors)
                                                let amount = sourceBalance.mul(new BN(amountPercentage)).div(new BN(100));

                                                // get expected target amount
                                                const expectedTargetAmount = getExpectedTargetAmount(
                                                    sourceStakedBalance, targetStakedBalance,
                                                    sourceBalance, targetBalance,
                                                    sourceWeight, targetWeight,
                                                    adjustedFee, amount
                                                );

                                                // not enough balance to complete the trade, should fail on chain
                                                if (expectedTargetAmount.gt(targetBalance)) {
                                                    return expectRevert(convertAndReturnTargetAmount(converter, sourceToken,
                                                        sourceTokenAddress, targetTokenAddress, amount), 'ERR_TARGET_AMOUNT_TOO_HIGH');
                                                }

                                                const actualTargetAmount = await convertAndReturnTargetAmount(converter, sourceToken,
                                                    sourceTokenAddress, targetTokenAddress, amount);
                                                expectAlmostEqual(expectedTargetAmount, actualTargetAmount, 'conversion #1');

                                                // update balances for the next conversion
                                                if (source === 1) {
                                                    reserve1Balance = reserve1Balance.add(new BN(amount));
                                                    reserve2Balance = reserve2Balance.sub(expectedTargetAmount);
                                                }
                                                else {
                                                    reserve2Balance = reserve2Balance.add(new BN(amount));
                                                    reserve1Balance = reserve1Balance.sub(expectedTargetAmount);
                                                }

                                                // Conversion #2

                                                // get reserve data
                                                reserve1Data = [reserveToken, reserveToken.address, reserve1Liquidity, reserve1Balance,
                                                    expectedWeights[0]];
                                                reserve2Data = [reserveToken2, reserveToken2.address, reserve2Liquidity, reserve2Balance,
                                                    expectedWeights[1]];

                                                // get source / target data
                                                [sourceToken, sourceTokenAddress, sourceStakedBalance, sourceBalance, sourceWeight] =
                                                    source2 === 1 ? reserve1Data : reserve2Data;
                                                [/* targetToken */, targetTokenAddress, targetStakedBalance, targetBalance, targetWeight] =
                                                    source2 === 1 ? reserve2Data : reserve1Data;

                                                // get amount (and mitigate rounding errors)
                                                amount = sourceBalance.mul(new BN(amountPercentage2)).div(new BN(100));

                                                // get expected target amount
                                                const expectedTargetAmount2 = getExpectedTargetAmount(
                                                    sourceStakedBalance, targetStakedBalance,
                                                    sourceBalance, targetBalance,
                                                    sourceWeight, targetWeight,
                                                    adjustedFee, amount
                                                );

                                                // not enough balance to complete the trade, should fail on chain
                                                if (expectedTargetAmount2.gt(targetBalance)) {
                                                    return expectRevert(convertAndReturnTargetAmount(converter, sourceToken,
                                                        sourceTokenAddress, targetTokenAddress, amount), 'ERR_TARGET_AMOUNT_TOO_HIGH');
                                                }

                                                const actualTargetAmount2 = await convertAndReturnTargetAmount(converter, sourceToken,
                                                    sourceTokenAddress, targetTokenAddress, amount);
                                                expectAlmostEqual(expectedTargetAmount2, actualTargetAmount2);
                                            });
                                        }
                                    }
                                }
                            }
                        });
                    }
                }

                describe('adding ETH liquidity', () => {
                    it('should revert when attempting to add liquidity with ETH value when there is no ETH reserve', async () => {
                        const converter = await initConverter(true, true);

                        const amount = toReserve1(new BN(600));
                        await reserveToken.approve(converter.address, amount, { from: sender });
                        await expectRevert(converter.addLiquidity(ETH_RESERVE_ADDRESS, amount, MIN_RETURN, { value: amount }),
                            'ERR_INVALID_RESERVE');
                    });
                });
            }
            else {
                describe('adding ETH liquidity', () => {
                    it('should revert when attempting to add liquidity with ETH value different than amount', async () => {
                        const converter = await initConverter(true, true);

                        await expectRevert(converter.addLiquidity(ETH_RESERVE_ADDRESS, 700, MIN_RETURN, { value: 701 }),
                            'ERR_ETH_AMOUNT_MISMATCH');
                    });
                });
            }
        });
    });
});
