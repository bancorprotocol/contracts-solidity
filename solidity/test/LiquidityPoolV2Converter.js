const { expect } = require('chai');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');

const Decimal = require('decimal.js');
Decimal.set({ precision: 100, rounding: Decimal.ROUND_DOWN });

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const { duration, latest } = time;
const { ZERO_ADDRESS } = constants;

const { crossReserveTargetAmount, balancedWeights } = require('./helpers/FormulaFunctions');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

const LiquidityPoolV2Converter = artifacts.require('TestLiquidityPoolV2Converter');
const LiquidityPoolV2ConverterFactory = artifacts.require('LiquidityPoolV2ConverterFactory');
const LiquidityPoolV2ConverterAnchorFactory = artifacts.require('LiquidityPoolV2ConverterAnchorFactory');
const LiquidityPoolV2ConverterCustomFactory = artifacts.require('LiquidityPoolV2ConverterCustomFactory');
const PoolTokensContainer = artifacts.require('PoolTokensContainer');
const SmartToken = artifacts.require('SmartToken');
const ChainlinkPriceOracle = artifacts.require('TestChainlinkPriceOracle');
const Whitelist = artifacts.require('Whitelist');

contract('LiquidityPoolV2Converter', accounts => {
    const initConverter = async (activate, addLiquidity, isETHReserve, maxConversionFee = 0,
        primaryReserveAddress = getReserve1Address(isETHReserve)) => {
        anchor = await PoolTokensContainer.new('Pool', 'POOL', 2);
        anchorAddress = anchor.address;

        const converter = await createConverter(anchorAddress, contractRegistry.address, maxConversionFee);
        await converter.addReserve(getReserve1Address(isETHReserve), 500000);
        await converter.addReserve(reserveToken2.address, 500000);
        await anchor.transferOwnership(converter.address);
        await converter.acceptAnchorOwnership();

        now = await latest();
        await converter.setTime(now);

        if (activate) {
            await converter.activate(primaryReserveAddress, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);

            poolToken1 = await SmartToken.at(await converter.poolToken.call(getReserve1Address(isETHReserve)));
            poolToken2 = await SmartToken.at(await converter.poolToken.call(reserveToken2.address));
        }

        if (addLiquidity) {
            if (!isETHReserve) {
                reserveToken.approve(converter.address, INITIAL_RESERVE1_LIQUIDITY, { from: sender });
            }

            reserveToken2.approve(converter.address, INITIAL_RESERVE2_LIQUIDITY, { from: sender });

            await converter.addLiquidity(getReserve1Address(isETHReserve), INITIAL_RESERVE1_LIQUIDITY, MIN_RETURN,
                { value: isETHReserve ? INITIAL_RESERVE1_LIQUIDITY : 0 });
            await converter.addLiquidity(reserveToken2.address, INITIAL_RESERVE2_LIQUIDITY, MIN_RETURN);
        }

        return converter;
    };

    const createConverter = async (anchorAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) => {
        return LiquidityPoolV2Converter.new(anchorAddress, registryAddress, maxConversionFee);
    };

    function getReserve1 (isETH) {
        return isETH ? undefined : reserveToken;
    }

    const getReserve1Address = (isETH) => {
        return isETH ? ETH_RESERVE_ADDRESS : reserveToken.address;
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

    const getExpectedTargetAmount = (sourceStakedBalance, targetStakedBalance, sourceBalance, targetBalance, sourceWeight, targetWeight,
        conversionFee, amount) => {
        sourceStakedBalance = new BN(sourceStakedBalance);
        targetStakedBalance = new BN(targetStakedBalance);
        sourceBalance = new BN(sourceBalance);
        targetBalance = new BN(targetBalance);
        sourceWeight = new BN(sourceWeight);
        targetWeight = new BN(targetWeight);
        amount = new BN(amount);

        sourceBalance = sourceStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(sourceBalance);
        targetBalance = targetStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(targetBalance);

        const targetAmount = new BN(crossReserveTargetAmount(sourceBalance, sourceWeight, targetBalance, targetWeight, amount).toNumber());
        const expectedFee = targetAmount.mul(new BN(conversionFee)).div(CONVERSION_FEE_RESOLUTION);

        return targetAmount.sub(expectedFee);
    };

    const getExpectedWeights = (reserve1StakedBalance, reserve2StakedBalance, reserve1Balance, reserve2Balance, oracle1Price,
        oracle2Price, isReserve1Primary) => {
        const normalizedRate = (rate1, decimals1, rate2, decimals2) => {
            if (decimals1.eq(decimals2)) {
                return { n: rate1, d: rate2 };
            }

            if (decimals1.gt(decimals2)) {
                return { n: rate1, d: rate2.mul(new BN(10).pow(decimals1.sub(decimals2))) };
            }

            return { n: rate1.mul(new BN(10).pow(decimals2.sub(decimals1))), d: rate2 };
        };

        let rate;
        if (isReserve1Primary) {
            rate = normalizedRate(oracle1Price, reserveTokenDecimals, oracle2Price, reserveToken2Decimals);
        } else {
            rate = normalizedRate(oracle1Price, reserveToken2Decimals, oracle2Price, reserveTokenDecimals);
        }

        oracle1Price = rate.n;
        oracle2Price = rate.d;

        reserve1StakedBalance = new BN(reserve1StakedBalance);
        reserve2StakedBalance = new BN(reserve2StakedBalance);
        reserve1Balance = reserve1StakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(new BN(reserve1Balance));
        reserve2Balance = reserve2StakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(new BN(reserve2Balance));

        const reserve1Data = [reserve1StakedBalance, reserve1Balance];
        const reserve2Data = [reserve2StakedBalance, reserve2Balance];
        const primaryReserveData = isReserve1Primary ? reserve1Data : reserve2Data;
        const secondaryReserveData = isReserve1Primary ? reserve2Data : reserve1Data;

        // the formula expects the rate of 1 unit of secondary reserve token so the values are inversed here
        let newWeights = balancedWeights(
            primaryReserveData[0].mul(AMPLIFICATION_FACTOR),
            primaryReserveData[1], secondaryReserveData[1],
            oracle2Price, oracle1Price
        );

        if (!isReserve1Primary) {
            newWeights = newWeights.reverse();
        }

        return newWeights.map(w => new BN(w.toFixed()));
    };

    const convertAndReturnTargetAmount = async (account, converter, sourceToken, sourceTokenAddress, targetTokenAddress, amount) => {
        let value = 0;
        if (sourceTokenAddress === ETH_RESERVE_ADDRESS) {
            value = amount;
        } else {
            sourceToken.approve(bancorNetwork.address, amount, { from: account });
        }

        const prevTargetReserveBalance = await converter.reserveBalance.call(targetTokenAddress);
        await convert([sourceTokenAddress, anchorAddress, targetTokenAddress], amount, MIN_RETURN, { value });
        const newTargetReserveBalance = await converter.reserveBalance.call(targetTokenAddress);

        return prevTargetReserveBalance.sub(newTargetReserveBalance);
    };

    const expectAlmostEqual = (amount1, amount2) => {
        const ratio = Decimal(amount1.toString()).div(Decimal(amount2.toString()));
        expect(ratio.gte(0.99), 'below MIN_RATIO');
        expect(ratio.lte(1.01), 'above MAX_RATIO');
    };

    const createChainlinkOracle = async (answer) => {
        const chainlinkOracle = await ChainlinkPriceOracle.new();
        await chainlinkOracle.setAnswer(answer);

        // Set the last update time to a far enough future in order for the external oracle price to always take effect.
        await chainlinkOracle.setTimestamp((await latest()).add(duration.years(1)));

        return chainlinkOracle;
    };

    const updateChainlinkOracle = async (converter, oracle, answer) => {
        await oracle.setAnswer(answer);

        await converter.setReferenceRateUpdateTime(now.sub(duration.seconds(1)));
    };

    let now;
    let bancorNetwork;
    let anchor;
    let anchorAddress;
    let contractRegistry;
    let reserveToken;
    const reserveTokenDecimals = 8;
    let reserveToken2;
    const reserveToken2Decimals = 18;
    let upgrader;
    let poolToken1;
    let poolToken2;
    let chainlinkPriceOracleA;
    let chainlinkPriceOracleB;
    let oracleWhitelist;
    const sender = accounts[0];
    const nonOwner = accounts[1];
    const sender2 = accounts[9];

    const WEIGHT_RESOLUTION = new BN(1000000);
    const CONVERSION_FEE_RESOLUTION = new BN(1000000);
    const AMPLIFICATION_FACTOR = new BN(20);
    const INITIAL_RESERVE1_LIQUIDITY = new BN(10000);
    const INITIAL_RESERVE2_LIQUIDITY = new BN(12000);
    const INITIAL_ORACLE_A_PRICE = new BN(10000);
    const INITIAL_ORACLE_B_PRICE = new BN(20000);
    const MIN_RETURN = new BN(1);

    const RATE_PROPAGATION_PERIOD = duration.minutes(10);

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

        upgrader = await ConverterUpgrader.new(contractRegistry.address, ZERO_ADDRESS);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        oracleWhitelist = await Whitelist.new();
        await contractRegistry.registerAddress(registry.CHAINLINK_ORACLE_WHITELIST, oracleWhitelist.address);

        chainlinkPriceOracleA = await createChainlinkOracle(INITIAL_ORACLE_A_PRICE);
        chainlinkPriceOracleB = await createChainlinkOracle(INITIAL_ORACLE_B_PRICE);

        await oracleWhitelist.addAddress(chainlinkPriceOracleA.address);
        await oracleWhitelist.addAddress(chainlinkPriceOracleB.address);

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', reserveTokenDecimals, 10000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', reserveToken2Decimals, 20000000000);
    });

    describe('adjusted-fee:', () => {
        const bntStaked = AMPLIFICATION_FACTOR.mul(new BN(4));
        const tknWeight = new BN(1);
        const bntWeight = new BN(1);
        const tknRate = new BN(1);
        const bntRate = new BN(1);
        const fee = new BN(100000);

        it('verifies calculateAdjustedFee when x < z', async () => {
            const tknStaked = bntStaked.sub(new BN(3));
            const converter = await initConverter(true, true, false);
            const adjustedFee = await converter.calculateAdjustedFeeTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, fee);
            expect(adjustedFee).to.be.bignumber.equal(fee.mul(new BN(2)));
        });

        it('verifies calculateAdjustedFee when x = z', async () => {
            const tknStaked = bntStaked.sub(new BN(2));
            const converter = await initConverter(true, true, false);
            const adjustedFee = await converter.calculateAdjustedFeeTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, fee);
            expect(adjustedFee).to.be.bignumber.equal(fee.mul(new BN(2)));
        });

        it('verifies calculateAdjustedFee when z < x < y', async () => {
            const tknStaked = bntStaked.sub(new BN(1));
            const converter = await initConverter(true, true, false);
            const adjustedFee = await converter.calculateAdjustedFeeTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, fee);
            expect(adjustedFee).to.be.bignumber.equal(fee.mul(new BN(4)).div(new BN(3)));
        });

        it('verifies calculateAdjustedFee when x = y', async () => {
            const tknStaked = bntStaked;
            const converter = await initConverter(true, true, false);
            const adjustedFee = await converter.calculateAdjustedFeeTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, fee);
            expect(adjustedFee).to.be.bignumber.equal(fee);
        });

        it('verifies calculateAdjustedFee when x > y', async () => {
            const tknStaked = bntStaked.add(new BN(1));
            const converter = await initConverter(true, true, false);
            const adjustedFee = await converter.calculateAdjustedFeeTest.call(tknStaked, bntStaked, tknWeight, bntWeight, tknRate, bntRate, fee);
            expect(adjustedFee).to.be.bignumber.equal(fee);
        });
    });

    describe('min-return:', () => {
        it('addLiquidity should revert when min-return is zero', async () => {
            const converter = await initConverter(true, true, false);
            reserveToken2.approve(converter.address, new BN(100), { from: accounts[0] });
            await expectRevert(converter.addLiquidity(reserveToken2.address, new BN(100), new BN(0), { from: accounts[0] }), 'ERR_ZERO_VALUE');
        });

        it('removeLiquidity should revert when min-return is zero', async () => {
            const converter = await initConverter(true, true, false);
            await expectRevert(converter.removeLiquidity(poolToken2.address, new BN(100), new BN(0), { from: accounts[0] }), 'ERR_ZERO_VALUE');
        });

        it('addLiquidity should revert when min-return is larger than return', async () => {
            const converter = await initConverter(true, true, false);
            reserveToken2.approve(converter.address, new BN(100), { from: accounts[0] });
            await expectRevert(converter.addLiquidity(reserveToken2.address, new BN(1), new BN(100), { from: accounts[0] }), 'ERR_RETURN_TOO_LOW');
        });

        it('removeLiquidity should revert when min-return is larger than return', async () => {
            const converter = await initConverter(true, true, false);
            await expectRevert(converter.removeLiquidity(poolToken2.address, new BN(1), new BN(100), { from: accounts[0] }), 'ERR_RETURN_TOO_LOW');
        });
    });

    describe('exit-fee:', () => {
        for (let i = 1; i <= 5; i++) {
            const reserveTokenAmount = new BN(123 * i);
            const poolTokenAmount = new BN(456 * i);
            it(`convert ${reserveTokenAmount.toString()} reserve tokens and then remove ${poolTokenAmount.toString()} pool tokens`, async () => {
                const converter = await initConverter(true, true, false);
                await reserveToken.approve(bancorNetwork.address, reserveTokenAmount, { from: accounts[0] });
                await convert([reserveToken.address, anchorAddress, reserveToken2.address], reserveTokenAmount, 1, { from: accounts[0] });
                const oldTotalSupply = await poolToken1.totalSupply.call();
                const oldUserBalance = await reserveToken.balanceOf.call(accounts[0]);
                const oldActualBalance = await reserveToken.balanceOf.call(converter.address);
                const oldStakedBalance = await converter.reserveStakedBalance.call(reserveToken.address);
                const x = oldStakedBalance.mul(AMPLIFICATION_FACTOR);
                const y = oldStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(oldActualBalance);
                const [min, max] = x.lt(y) ? [x, y] : [y, x];
                const fee = poolTokenAmount.mul(oldStakedBalance.mul(min)).div(oldTotalSupply.mul(max));
                await converter.removeLiquidity(poolToken1.address, poolTokenAmount, MIN_RETURN, { from: accounts[0] });
                const newTotalSupply = await poolToken1.totalSupply.call();
                const newUserBalance = await reserveToken.balanceOf.call(accounts[0]);
                const newActualBalance = await reserveToken.balanceOf.call(converter.address);
                const newStakedBalance = await converter.reserveStakedBalance.call(reserveToken.address);
                expect(newTotalSupply).to.be.bignumber.equal(oldTotalSupply.sub(poolTokenAmount));
                expect(newUserBalance).to.be.bignumber.equal(oldUserBalance.add(fee));
                expect(newActualBalance).to.be.bignumber.equal(oldActualBalance.sub(fee));
                expect(newStakedBalance).to.be.bignumber.equal(oldStakedBalance.sub(fee));
            });
        }
    });

    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
        describe(`${isETHReserve === 0 ? 'with ERC20 reserves' : 'with ETH reserve'},`, () => {
            it('verifies the converter data after construction', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                const primary = await converter.primaryReserveToken.call();
                const secondary = await converter.secondaryReserveToken.call();
                expect(primary).to.eql(ZERO_ADDRESS);
                expect(secondary).to.eql(ZERO_ADDRESS);

                const oracle = await converter.priceOracle.call();
                expect(oracle).to.eql(ZERO_ADDRESS);
            });

            it('verifies that isActive returns false before calling activate', async () => {
                const converter = await initConverter(false, false, isETHReserve);
                expect(await converter.isActive.call()).to.be.false();
            });

            it('verifies that isActive returns true after calling activate', async () => {
                const converter = await initConverter(true, false, isETHReserve);
                expect(await converter.isActive.call()).to.be.true();
            });

            it('verifies that the owner can activate the converter', async () => {
                const converter = await initConverter(false, false, isETHReserve);
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
            });

            it('verifies that the primary / secondary reserves are set correctly when activating with the 1st reserve as primary', async () => {
                const converter = await initConverter(false, false, isETHReserve);
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                const primary = await converter.primaryReserveToken.call();
                const secondary = await converter.secondaryReserveToken.call();
                expect(primary).to.eql(getReserve1Address(isETHReserve));
                expect(secondary).to.eql(reserveToken2.address);
            });

            it('verifies that the primary / secondary reserves are set correctly when activating with the 2st reserve as primary', async () => {
                const converter = await initConverter(false, false, isETHReserve);
                await converter.activate(reserveToken2.address, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                const primary = await converter.primaryReserveToken.call();
                const secondary = await converter.secondaryReserveToken.call();
                expect(primary).to.eql(reserveToken2.address);
                expect(secondary).to.eql(getReserve1Address(isETHReserve));
            });

            it('verifies that the price oracle is created correctly when activating', async () => {
                const converter = await initConverter(false, false, isETHReserve);
                await converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address);
                const oracle = await converter.priceOracle.call();
                expect(oracle).not.to.be.eql(ZERO_ADDRESS);
            });

            it('should revert when attempting to activate an active converter', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address,
                    chainlinkPriceOracleB.address), 'ERR_ACTIVE');
            });

            it('should revert when a non owner attempts to activate the converter', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address,
                    chainlinkPriceOracleB.address, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('should revert when attempting to activate the converter with an invalid primary reserve', async () => {
                const converter = await initConverter(false, false, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.activate(token.address, chainlinkPriceOracleA.address, chainlinkPriceOracleB.address),
                    'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to activate the converter with zero primary reserve oracle address', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), ZERO_ADDRESS, chainlinkPriceOracleB.address),
                    'ERR_INVALID_ADDRESS');
            });

            // eslint-disable-next-line max-len
            it('should revert when attempting to activate the converter with the converter address as the primary reserve oracle address', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), converter.address, chainlinkPriceOracleB.address),
                    'ERR_ADDRESS_IS_SELF');
            });

            it('should revert when attempting to activate the converter with a non whitelisted primary reserve oracle', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await oracleWhitelist.removeAddress(chainlinkPriceOracleA.address);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address),
                    'ERR_INVALID_ORACLE');
            });

            it('should revert when attempting to activate the converter with zero secondary reserve oracle address', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, ZERO_ADDRESS),
                    'ERR_INVALID_ADDRESS');
            });

            // eslint-disable-next-line max-len
            it('should revert when attempting to activate the converter with the converter address as the secondary reserve oracle address', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, converter.address),
                    'ERR_ADDRESS_IS_SELF');
            });

            it('should revert when attempting to activate the converter with a non whitelisted secondary reserve oracle', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                await oracleWhitelist.removeAddress(chainlinkPriceOracleB.address);

                await expectRevert(converter.activate(getReserve1Address(isETHReserve), chainlinkPriceOracleA.address, chainlinkPriceOracleB.address),
                    'ERR_INVALID_ORACLE');
            });

            it('verifies that reserveStakedBalance returns the correct balance', async () => {
                const converter = await initConverter(true, false, isETHReserve);
                const balance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance).to.be.bignumber.equal(new BN(0));

                const amount = new BN(10000);
                if (!isETHReserve) {
                    await reserveToken.approve(converter.address, amount, { from: sender });
                }

                await converter.addLiquidity(getReserve1Address(isETHReserve), amount, MIN_RETURN, { value: isETHReserve ? amount : 0 });

                const balance2 = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance2).to.be.bignumber.equal(amount);

                const amount2 = new BN(2000);
                if (!isETHReserve) {
                    await reserveToken.approve(converter.address, amount2, { from: sender });
                }
                await converter.addLiquidity(getReserve1Address(isETHReserve), amount2, MIN_RETURN, { value: isETHReserve ? amount2 : 0 });

                const balance3 = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance3).to.be.bignumber.equal(amount.add(amount2));
            });

            it('should revert when attempting to get the reserve staked balance with an invalid reserve address', async () => {
                const converter = await initConverter(true, false, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.reserveStakedBalance.call(token.address), 'ERR_INVALID_RESERVE');
            });

            it('verifies that the owner can set the staked balance when owner is the upgrader', async () => {
                const converter = await initConverter(true, false, isETHReserve);
                const balance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance).to.be.bignumber.equal(new BN(0));

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender);

                const amount = new BN(2500);
                await converter.setReserveStakedBalance(getReserve1Address(isETHReserve), amount);

                const balance2 = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                expect(balance2).to.be.bignumber.equal(amount);

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
            });

            it('should revert when the owner attempts to set the staked balance when the owner is not the converter upgrader', async () => {
                const converter = await initConverter(true, false, isETHReserve);

                const amount = new BN(2500);
                await expectRevert(converter.setReserveStakedBalance(getReserve1Address(isETHReserve), amount), 'ERR_ACCESS_DENIED');
            });

            // eslint-disable-next-line max-len
            it('should revert when the converter upgrader attempts to set the staked balance when the converter upgrader is not the owner', async () => {
                const converter = await initConverter(true, false, isETHReserve);

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender2);

                const amount = new BN(2500);
                // eslint-disable-next-line max-len
                await expectRevert(converter.setReserveStakedBalance(getReserve1Address(isETHReserve), amount, { from: sender2 }), 'ERR_ACCESS_DENIED');

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
            });

            it('should revert when attempting to set the staked balance with an invalid reserve address', async () => {
                const converter = await initConverter(true, false, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, sender);

                const amount = new BN(2500);
                await expectRevert(converter.setReserveStakedBalance(token.address, amount), 'ERR_INVALID_RESERVE');

                await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
            });

            it('verifies that the owner can set the max staked balance', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                let reserve1MaxStakedBalanace = await converter.maxStakedBalances(getReserve1Address(isETHReserve));
                let reserve2MaxStakedBalanace = await converter.maxStakedBalances(reserveToken2.address);

                expect(reserve1MaxStakedBalanace).to.be.bignumber.equal(new BN(0));
                expect(reserve2MaxStakedBalanace).to.be.bignumber.equal(new BN(0));

                const amount1 = new BN(1000);
                const amount2 = new BN(2000);
                await converter.setMaxStakedBalances(amount1, amount2);
                reserve1MaxStakedBalanace = await converter.maxStakedBalances(getReserve1Address(isETHReserve));
                reserve2MaxStakedBalanace = await converter.maxStakedBalances(reserveToken2.address);

                expect(reserve1MaxStakedBalanace).to.be.bignumber.equal(amount1);
                expect(reserve2MaxStakedBalanace).to.be.bignumber.equal(amount2);
            });

            it('should revert when a non owner attempts to set the max staked balance', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                const amount1 = new BN(1000);
                const amount2 = new BN(2000);
                await expectRevert(converter.setMaxStakedBalances(amount1, amount2, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('verifies that the owner can disable the max staked balances', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                expect(await converter.maxStakedBalanceEnabled()).to.be.true();

                await converter.disableMaxStakedBalances();

                expect(await converter.maxStakedBalanceEnabled()).to.be.false();
            });

            it('should revert when a non owner attempts to disable the max staked balances', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                await expectRevert(converter.disableMaxStakedBalances({ from: nonOwner }), 'ERR_ACCESS_DENIED');
            });

            it('verifies that liquidationLimit returns the correct amount', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                const amount = new BN(8000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value });

                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                const poolTokenSupply = await poolToken2.totalSupply.call();

                const expectedLimit = reserve2Balance.mul(poolTokenSupply).div(reserve2StakedBalance);
                const limit = await converter.liquidationLimit.call(poolToken2.address);
                expect(limit).to.be.bignumber.equal(expectedLimit);
            });

            it('should revert when attempting to add 3rd reserve', async () => {
                const converter = await createConverter(anchorAddress, contractRegistry.address, 0);
                await converter.addReserve(getReserve1Address(isETHReserve), 500000);
                await converter.addReserve(reserveToken2.address, 300000);

                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.addReserve(token.address, 2000), 'ERR_INVALID_RESERVE_COUNT');
            });

            it('verifies that targetAmountAndFee returns the correct target amount and fee when there was no external price change', async () => {
                const converter = await initConverter(true, true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const amount = 2000;

                const expectedWeights = getExpectedWeights(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, true
                );

                const expectedTargetAmountWithNoFee = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 0, amount
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 3000, amount
                );

                const expectedFee = expectedTargetAmountWithNoFee.sub(expectedTargetAmount);

                const res = await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, amount);
                expectAlmostEqual(expectedTargetAmount, res[0]);
                expect(expectedFee).to.be.bignumber.equal(res[1]);
            });

            it('verifies that targetAmountAndFee returns an increased fee when the secondary reserve is in deficit', async () => {
                const conversionFee = 25000;
                const converter = await initConverter(true, true, isETHReserve, conversionFee);
                await converter.setConversionFee(conversionFee);

                // increase liquidity so that the fee will have more significant effect
                // approve the amount if needed
                let value = 0;
                if (isETHReserve) {
                    value = 10000000;
                } else {
                    await reserveToken.approve(converter.address, new BN(10000000));
                }

                await converter.addLiquidity(getReserve1Address(isETHReserve), new BN(10000000), MIN_RETURN, { value });
                await reserveToken2.approve(converter.address, new BN(12000000));
                await converter.addLiquidity(reserveToken2.address, new BN(12000000), MIN_RETURN);

                const amount = 2000000;

                // convert from the primary reserve to the secondary reserve
                value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value });

                // increase the secondary reserve external price
                const newOracleBPrice = INITIAL_ORACLE_B_PRICE.add(new BN(15000));
                await updateChainlinkOracle(converter, chainlinkPriceOracleB, newOracleBPrice);

                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                const expectedWeights = getExpectedWeights(
                    reserve1StakedBalance, reserve2StakedBalance,
                    reserve1Balance, reserve2Balance,
                    INITIAL_ORACLE_A_PRICE, newOracleBPrice, true
                );

                const expectedTargetAmountWithNoFee = getExpectedTargetAmount(
                    reserve1StakedBalance, reserve2StakedBalance,
                    reserve1Balance, reserve2Balance,
                    expectedWeights[0], expectedWeights[1], 0, amount
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    reserve1StakedBalance, reserve2StakedBalance,
                    reserve1Balance, reserve2Balance,
                    expectedWeights[0], expectedWeights[1], conversionFee, amount
                );

                const normalFee = expectedTargetAmountWithNoFee.sub(expectedTargetAmount);

                const res = await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, amount);
                expectAlmostEqual(expectedTargetAmount, res[0]);
                expect(normalFee).to.be.bignumber.lt(res[1]);
            });

            it('verifies that targetAmountAndFee returns a decreased fee when the secondary reserve is in surplus', async () => {
                const conversionFee = 25000;
                const converter = await initConverter(true, true, isETHReserve, conversionFee);
                await converter.setConversionFee(conversionFee);

                // increase liquidity so that the fee will have more significant effect
                // approve the amount if needed
                let value = 0;
                if (isETHReserve) {
                    value = 10000000;
                } else {
                    await reserveToken.approve(converter.address, new BN(10000000));
                }

                await converter.addLiquidity(getReserve1Address(isETHReserve), new BN(10000000), MIN_RETURN, { value });
                await reserveToken2.approve(converter.address, new BN(12000000));
                await converter.addLiquidity(reserveToken2.address, new BN(12000000), MIN_RETURN);

                const amount = 2000000;

                // convert from the primary reserve to the secondary reserve
                value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value });

                // increase the secondary reserve external price
                const newOracleBPrice = INITIAL_ORACLE_B_PRICE.add(new BN(15000));
                await updateChainlinkOracle(converter, chainlinkPriceOracleB, newOracleBPrice);

                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                const reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);

                const expectedWeights = getExpectedWeights(
                    reserve1StakedBalance, reserve2StakedBalance,
                    reserve1Balance, reserve2Balance,
                    newOracleBPrice, INITIAL_ORACLE_A_PRICE, true
                );

                const expectedTargetAmountWithNoFee = getExpectedTargetAmount(
                    reserve1StakedBalance, reserve2StakedBalance,
                    reserve1Balance, reserve2Balance,
                    expectedWeights[0], expectedWeights[1], 0, amount
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    reserve1StakedBalance, reserve2StakedBalance,
                    reserve1Balance, reserve2Balance,
                    expectedWeights[0], expectedWeights[1], conversionFee, amount
                );

                const normalFee = expectedTargetAmountWithNoFee.sub(expectedTargetAmount);

                const res = await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, amount);
                expectAlmostEqual(expectedTargetAmount, res[0]);
                expect(normalFee).to.be.bignumber.gt(res[1]);
            });

            it('verifies that targetAmountAndFee returns the correct target amount and fee when there was an external price change', async () => {
                const conversionFee = 3000;
                const converter = await initConverter(true, true, isETHReserve, 5000);
                await converter.setConversionFee(conversionFee);

                const amount = 2000;
                const oracleAPrice = 15000;

                const expectedWeights = getExpectedWeights(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    oracleAPrice, INITIAL_ORACLE_B_PRICE, true
                );

                const expectedTargetAmountWithNoFee = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 0, amount
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], conversionFee, amount
                );

                const normalFee = expectedTargetAmountWithNoFee.sub(expectedTargetAmount);

                await updateChainlinkOracle(converter, chainlinkPriceOracleA, oracleAPrice);

                const res = await converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), reserveToken2.address, amount);

                expectAlmostEqual(expectedTargetAmount, res[0]);
                expect(normalFee).to.be.bignumber.equal(res[1]);
            });

            it('verifies that convert returns valid amount after converting when there was no external price change', async () => {
                const converter = await initConverter(true, true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const amount = new BN(800);

                const expectedWeights = getExpectedWeights(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, true
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 3000, amount
                );

                const actualTargetAmount = await convertAndReturnTargetAmount(sender, converter, reserveToken,
                    getReserve1Address(isETHReserve), reserveToken2.address, amount);

                expectAlmostEqual(expectedTargetAmount, actualTargetAmount);
            });

            it('verifies that convert returns valid amount after converting when there was an external price change', async () => {
                const converter = await initConverter(true, true, isETHReserve, 5000);
                await converter.setConversionFee(3000);

                const newOracleAPrice = 17000;
                const amount = new BN(800);

                const expectedWeights = getExpectedWeights(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    newOracleAPrice, INITIAL_ORACLE_B_PRICE, true
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 3000, amount
                );

                await updateChainlinkOracle(converter, chainlinkPriceOracleA, newOracleAPrice);

                const actualTargetAmount = await convertAndReturnTargetAmount(sender, converter, reserveToken,
                    getReserve1Address(isETHReserve), reserveToken2.address, amount);

                expectAlmostEqual(expectedTargetAmount, actualTargetAmount);
            });

            it('verifies balances after conversion', async () => {
                const converter = await initConverter(true, true, isETHReserve, 5000);
                await converter.setConversionFee(3500);

                const amount = new BN(800);

                const expectedWeights = getExpectedWeights(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, true
                );

                const expectedTargetAmountWithNoFee = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 0, amount
                );

                const expectedTargetAmount = getExpectedTargetAmount(
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    INITIAL_RESERVE1_LIQUIDITY, INITIAL_RESERVE2_LIQUIDITY,
                    expectedWeights[0], expectedWeights[1], 3500, amount
                );

                const expectedFee = expectedTargetAmountWithNoFee.sub(expectedTargetAmount);

                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const prevSourceBalance = await getBalance(getReserve1(isETHReserve), getReserve1Address(isETHReserve), sender);
                const prevTargetBalance = await getBalance(reserveToken2, reserveToken2.address, sender);
                const prevConverterSourceBalance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const prevConverterTargetBalance = await converter.reserveBalance.call(reserveToken2.address);
                const prevConverterTargetStakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);

                const res = await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value });

                const newSourceBalance = await getBalance(getReserve1(isETHReserve), getReserve1Address(isETHReserve), sender);
                const newTargetBalance = await getBalance(reserveToken2, reserveToken2.address, sender);
                const newConverterSourceBalance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                const newConverterTargetBalance = await converter.reserveBalance.call(reserveToken2.address);
                const newConverterTargetStakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);

                let transactionCost = new BN(0);
                if (isETHReserve) {
                    transactionCost = await getTransactionCost(res);
                }

                // check balances
                expectAlmostEqual(prevSourceBalance.sub(transactionCost).sub(amount), newSourceBalance);
                expectAlmostEqual(prevTargetBalance.add(expectedTargetAmount), newTargetBalance);
                expectAlmostEqual(prevConverterSourceBalance.add(amount), newConverterSourceBalance);
                expectAlmostEqual(prevConverterTargetBalance.sub(expectedTargetAmount), newConverterTargetBalance);
                expectAlmostEqual(prevConverterTargetStakedBalance.add(expectedFee), newConverterTargetStakedBalance);
            });

            it('verifies the TokenRateUpdate events after conversion', async () => {
                const converter = await initConverter(true, true, isETHReserve, 5000);

                const amount = new BN(800);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                const res = await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value });

                const sourceStakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const targetStakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                let sourceBalance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                let targetBalance = await converter.reserveBalance.call(reserveToken2.address);
                const sourceWeight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                const targetWeight = await converter.reserveWeight(reserveToken2.address);
                const poolTokenSupply = await poolToken2.totalSupply.call();

                // apply amplification factor
                sourceBalance = sourceStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(sourceBalance);
                targetBalance = targetStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(targetBalance);

                const events = await converter.getPastEvents('TokenRateUpdate', {
                    fromBlock: res.receipt.blockNumber,
                    toBlock: res.receipt.blockNumber
                });

                const { args: event1 } = events[0];
                expect(event1._token1).to.eql(getReserve1Address(isETHReserve));
                expect(event1._token2).to.eql(reserveToken2.address);
                expect(event1._rateN).to.be.bignumber.equal(targetBalance.mul(sourceWeight));
                expect(event1._rateD).to.be.bignumber.equal(sourceBalance.mul(targetWeight));

                const { args: event2 } = events[1];
                expect(event2._token1).to.eql(poolToken2.address);
                expect(event2._token2).to.eql(reserveToken2.address);
                expect(event2._rateN).to.be.bignumber.equal(targetStakedBalance.mul(WEIGHT_RESOLUTION));
                expect(event2._rateD).to.be.bignumber.equal(poolTokenSupply.mul(targetWeight));
            });

            it('should revert when attempting to convert when the return is smaller than the minimum requested amount', async () => {
                await initConverter(true, true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, 20000, { value }),
                    'ERR_RETURN_TOO_LOW');
            });

            it('should revert when attempting to buy while the purchase yields 0 return', async () => {
                await initConverter(true, true, isETHReserve);

                const amount = new BN(1);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount,
                    MIN_RETURN, { value }), 'ERR_ZERO_TARGET_AMOUNT');
            });

            it('should revert when attempting to buy too many tokens', async () => {
                await initConverter(true, true, isETHReserve);

                const amount = new BN(100000);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount,
                    MIN_RETURN, { value }), 'ERR_TARGET_AMOUNT_TOO_HIGH.');
            });

            it('should revert when attempting to convert when source reserve is invalid', async () => {
                await initConverter(true, true, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await token.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([token.address, anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to convert when target reserve is invalid', async () => {
                await initConverter(true, true, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, token.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE');
            });

            it('verifies that liquidity cannot exceed the max staked balance', async () => {
                const converter = await initConverter(true, false, isETHReserve, 5000);

                let amount = new BN(40000);
                await converter.setMaxStakedBalances(20000, amount);

                await reserveToken2.approve(converter.address, amount, { from: sender });
                await converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN);

                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);

                expect(reserve2StakedBalance).be.bignumber.equal(amount);

                amount = new BN(1);

                await reserveToken2.approve(converter.address, amount, { from: sender });
                await expectRevert(converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN), 'ERR_MAX_STAKED_BALANCE_REACHED');
            });

            it('verifies that liquidity can exceed the max staked balance once max staked balances is disabled', async () => {
                const converter = await initConverter(true, false, isETHReserve, 5000);

                let amount = new BN(40000);
                await converter.setMaxStakedBalances(20000, amount);

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
                const converter = await initConverter(true, true, isETHReserve, 5000);

                const amount = new BN(800);
                await reserveToken2.approve(converter.address, amount, { from: sender });
                const res = await converter.addLiquidity(reserveToken2.address, amount, MIN_RETURN);

                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                let reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                let reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const reserve1Weight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                const reserve2Weight = await converter.reserveWeight(reserveToken2.address);
                const poolTokenSupply = await poolToken2.totalSupply.call();

                // apply amplification factor
                reserve1Balance = reserve1StakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve1Balance);
                reserve2Balance = reserve2StakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve2Balance);

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: poolToken2.address,
                    _token2: reserveToken2.address,
                    _rateN: reserve2StakedBalance.mul(WEIGHT_RESOLUTION),
                    _rateD: poolTokenSupply.mul(reserve2Weight)
                });

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: getReserve1Address(isETHReserve),
                    _token2: reserveToken2.address,
                    _rateN: reserve2Balance.mul(reserve1Weight),
                    _rateD: reserve1Balance.mul(reserve2Weight)
                });
            });

            it('verifies the TokenRateUpdate events when removing liquidity', async () => {
                const converter = await initConverter(true, true, isETHReserve, 5000);

                const amount = new BN(800);
                const res = await converter.removeLiquidity(poolToken1.address, amount, MIN_RETURN);

                const reserve1StakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                const reserve2StakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                let reserve1Balance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                let reserve2Balance = await converter.reserveBalance.call(reserveToken2.address);
                const reserve1Weight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                const reserve2Weight = await converter.reserveWeight(reserveToken2.address);
                const poolTokenSupply = await poolToken1.totalSupply.call();

                // apply amplification factor
                reserve1Balance = reserve1StakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve1Balance);
                reserve2Balance = reserve2StakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(reserve2Balance);

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: poolToken1.address,
                    _token2: getReserve1Address(isETHReserve),
                    _rateN: reserve1StakedBalance.mul(WEIGHT_RESOLUTION),
                    _rateD: poolTokenSupply.mul(reserve1Weight)
                });

                expectEvent(res, 'TokenRateUpdate', {
                    _token1: getReserve1Address(isETHReserve),
                    _token2: reserveToken2.address,
                    _rateN: reserve2Balance.mul(reserve1Weight),
                    _rateD: reserve1Balance.mul(reserve2Weight)
                });
            });

            for (const isOwner of [true, false]) {
                for (const isEmpty of [true, false]) {
                    for (const isReserve1 of [true, false]) {
                        // eslint-disable-next-line max-len
                        describe(`${isReserve1 ? 'adding reserve1' : 'adding reserve2'} ${isEmpty ? 'to an empty pool' : 'to a non empty pool'},`, () => {
                            it(`verifies all balances after ${isOwner ? 'the owner' : 'a non owner'} adds liquidity`, async () => {
                                const converter = await initConverter(true, !isEmpty, isETHReserve, 5000);
                                await converter.setConversionFee(3000);

                                // get the reserve and its address
                                let reserve;
                                let reserveAddress;
                                if (isReserve1) {
                                    if (!isETHReserve) {
                                        reserve = reserveToken;
                                    }

                                    reserveAddress = getReserve1Address(isETHReserve);
                                } else {
                                    reserve = reserveToken2;
                                    reserveAddress = reserveToken2.address;
                                }

                                const amount = new BN(800);

                                // get the caller account
                                const account = isOwner ? sender : sender2;
                                if (!isOwner) {
                                    await reserveToken.transfer(sender2, amount);
                                    await reserveToken2.transfer(sender2, amount);
                                }

                                // approve the amount if needed
                                let value = 0;
                                if (isETHReserve && isReserve1) {
                                    value = amount;
                                } else {
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
                                } else {
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
                                const reserveData = isReserve1 ? reserve1Data : reserve2Data;

                                const primaryReserveAddress = isReserve1Primary ? reserve1Data[1] : reserve2Data[1];
                                const converter = await initConverter(true, !isEmpty, isETHReserve, 5000, primaryReserveAddress);
                                await converter.setConversionFee(3000);

                                const amount = new BN(800);

                                // approve the amount if needed
                                let value = 0;
                                if (isETHReserve && isReserve1) {
                                    value = amount;
                                } else {
                                    await reserveData[0].approve(converter.address, amount, { from: sender });
                                }

                                // add the liquidity
                                await converter.addLiquidity(reserveData[1], amount, MIN_RETURN, { value });

                                // get new staked balances
                                let reserve1StakedBalance = new BN(isEmpty ? 0 : INITIAL_RESERVE1_LIQUIDITY);
                                let reserve2StakedBalance = new BN(isEmpty ? 0 : INITIAL_RESERVE2_LIQUIDITY);
                                if (isReserve1) {
                                    reserve1StakedBalance = reserve1StakedBalance.add(amount);
                                } else {
                                    reserve2StakedBalance = reserve2StakedBalance.add(amount);
                                }

                                // get expected weights
                                const expectedWeights = getExpectedWeights(
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, isReserve1Primary
                                );

                                const reserveWeight1 = await converter.reserveWeight(reserve1Data[1]);
                                const reserveWeight2 = await converter.reserveWeight(reserve2Data[1]);

                                // compare expected weights vs the actual weights
                                expect(reserveWeight1).to.be.bignumber.equal(expectedWeights[0]);
                                expect(reserveWeight2).to.be.bignumber.equal(expectedWeights[1]);
                            });
                        });
                    }
                }
            }

            it('should revert when attempting to add liquidity when the converter is not active', async () => {
                const converter = await initConverter(false, false, isETHReserve);

                const amount = new BN(700);

                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(converter.address, amount, { from: sender });
                }

                await expectRevert(converter.addLiquidity(getReserve1Address(isETHReserve), amount, MIN_RETURN, { value }), 'ERR_INACTIVE');
            });

            it('should revert when attempting to add liquidity with an invalid reserve token address', async () => {
                const converter = await initConverter(true, true, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                const amount = new BN(700);

                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await token.approve(converter.address, amount, { from: sender });
                }

                await expectRevert(converter.addLiquidity(token.address, amount, MIN_RETURN, { value }), 'ERR_INVALID_RESERVE');
            });

            it('should revert when attempting to add liquidity with zero amount', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                await expectRevert(converter.addLiquidity(getReserve1Address(isETHReserve), 0, MIN_RETURN), 'ERR_ZERO_VALUE');
            });

            for (const isOwner of [true, false]) {
                for (const isEntireSupply of [true, false]) {
                    for (const isPoolToken1 of [true, false]) {
                        // eslint-disable-next-line max-len
                        describe(`removing ${isEntireSupply ? 'entire' : 'partial'} ${isPoolToken1 ? 'pool token 1' : 'pool token 2'} supply,`, () => {
                            it(`verifies all balances after ${isOwner ? 'the owner' : 'a non owner'} removes liquidity`, async () => {
                                const converter = await initConverter(true, true, isETHReserve, 5000);
                                await converter.setConversionFee(3000);

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
                                } else {
                                    amount = new BN(100);
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
                                } else {
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
                                const converter = await initConverter(true, true, isETHReserve, 5000, primaryReserveAddress);
                                await converter.setConversionFee(3000);

                                // get the pool token
                                const poolToken = isPoolToken1 ? poolToken1 : poolToken2;
                                const poolTokenSupply = await poolToken.totalSupply.call();

                                let amount;
                                if (isEntireSupply) {
                                    amount = poolTokenSupply;
                                } else {
                                    amount = new BN(100);
                                }

                                await converter.removeLiquidity(poolToken.address, amount, MIN_RETURN);

                                // get new staked balances
                                let reserve1StakedBalance = new BN(INITIAL_RESERVE1_LIQUIDITY);
                                let reserve2StakedBalance = new BN(INITIAL_RESERVE2_LIQUIDITY);
                                if (isPoolToken1) {
                                    reserve1StakedBalance = reserve1StakedBalance.sub(amount);
                                } else {
                                    reserve2StakedBalance = reserve2StakedBalance.sub(amount);
                                }

                                // get expected weights
                                const expectedWeights = getExpectedWeights(
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    reserve1StakedBalance, reserve2StakedBalance,
                                    INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, isReserve1Primary
                                );

                                const reserveWeight1 = await converter.reserveWeight(getReserve1Address(isETHReserve));
                                const reserveWeight2 = await converter.reserveWeight(reserveToken2.address);

                                expect(reserveWeight1).to.be.bignumber.equal(expectedWeights[0]);
                                expect(reserveWeight2).to.be.bignumber.equal(expectedWeights[1]);
                            });
                        });
                    }
                }
            }

            it('should revert when attempting to remove liquidity with an invalid pool token address', async () => {
                const converter = await initConverter(true, true, isETHReserve);
                const token = await ERC20Token.new('ERC Token 1', 'ERC1', 18, 1000000000);

                await expectRevert(converter.removeLiquidity(token.address, 100, MIN_RETURN), 'ERR_INVALID_POOL_TOKEN');
            });

            it('should revert when attempting to remove liquidity with zero amount', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                await expectRevert(converter.removeLiquidity(poolToken1.address, 0, MIN_RETURN), 'ERR_ZERO_VALUE');
            });

            it('should revert when attempting to convert when the primary reserve weight is 0', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await converter.setReserveWeight(getReserve1Address(isETHReserve), 0);
                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE_WEIGHT');
            });

            it('should revert when attempting to convert when the secondary reserve weight is 0', async () => {
                const converter = await initConverter(true, true, isETHReserve);

                const amount = new BN(500);
                let value = 0;
                if (isETHReserve) {
                    value = amount;
                } else {
                    await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                }

                await converter.setReserveWeight(reserveToken2.address, 0);
                await expectRevert(convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address], amount, MIN_RETURN, { value }),
                    'ERR_INVALID_RESERVE_WEIGHT');
            });
        });
    }

    // main conversion tests
    for (const reserve1Liquidity of [10000, 51000, 100000]) {
        for (const reserve2Liquidity of [14000, 47000, 92000]) {
            describe(`liquidity: [${reserve1Liquidity},${reserve2Liquidity}],`, () => {
                for (const source of [1, 2]) {
                    for (const amountPercentage of [20, 40, 95]) {
                        for (const source2 of [1, 2]) {
                            for (const amountPercentage2 of [20, 40, 95]) {
                                // eslint-disable-next-line max-len
                                it(`verifies conversion of ${amountPercentage} percent of reserve ${source} and then ${amountPercentage2} percent of reserve ${source2}`, async () => {
                                    const converter = await initConverter(true, false, false, 5000);
                                    await converter.setConversionFee(4000);

                                    // add liquidity
                                    await reserveToken.approve(converter.address, reserve1Liquidity, { from: sender });
                                    await reserveToken2.approve(converter.address, reserve2Liquidity, { from: sender });
                                    await converter.addLiquidity(reserveToken.address, reserve1Liquidity, MIN_RETURN);
                                    await converter.addLiquidity(reserveToken2.address, reserve2Liquidity, MIN_RETURN);

                                    let reserve1Balance = new BN(reserve1Liquidity);
                                    let reserve2Balance = new BN(reserve2Liquidity);
                                    const expectedWeights = getExpectedWeights(
                                        reserve1Liquidity, reserve2Liquidity,
                                        reserve1Liquidity, reserve2Liquidity,
                                        INITIAL_ORACLE_A_PRICE, INITIAL_ORACLE_B_PRICE, true
                                    );

                                    // Conversion #1

                                    // get reserve data
                                    let reserve1Data = [reserveToken, reserveToken.address, reserve1Liquidity, reserve1Balance, expectedWeights[0]];
                                    let reserve2Data = [reserveToken2, reserveToken2.address, reserve2Liquidity, reserve2Balance, expectedWeights[1]];

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
                                        4000, amount
                                    );

                                    // not enough balance to complete the trade, should fail on chain
                                    if (expectedTargetAmount.gt(targetBalance)) {
                                        return expectRevert.unspecified(convertAndReturnTargetAmount(sender, converter, sourceToken,
                                            sourceTokenAddress, targetTokenAddress, amount));
                                    }

                                    const actualTargetAmount = await convertAndReturnTargetAmount(sender, converter, sourceToken,
                                        sourceTokenAddress, targetTokenAddress, amount);
                                    expectAlmostEqual(expectedTargetAmount, actualTargetAmount, 'conversion #1');

                                    // update balances for the next conversion
                                    if (source === 1) {
                                        reserve1Balance = reserve1Balance.add(new BN(amount));
                                        reserve2Balance = reserve2Balance.sub(expectedTargetAmount);
                                    } else {
                                        reserve2Balance = reserve2Balance.add(new BN(amount));
                                        reserve1Balance = reserve1Balance.sub(expectedTargetAmount);
                                    }

                                    // Conversion #2

                                    // get reserve data
                                    reserve1Data = [reserveToken, reserveToken.address, reserve1Liquidity, reserve1Balance, expectedWeights[0]];
                                    reserve2Data = [reserveToken2, reserveToken2.address, reserve2Liquidity, reserve2Balance, expectedWeights[1]];

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
                                        4000, amount
                                    );

                                    // not enough balance to complete the trade, should fail on chain
                                    if (expectedTargetAmount2.gt(targetBalance)) {
                                        return expectRevert.unspecified(convertAndReturnTargetAmount(sender, converter, sourceToken,
                                            sourceTokenAddress, targetTokenAddress, amount));
                                    }

                                    const actualTargetAmount2 = await convertAndReturnTargetAmount(sender, converter, sourceToken,
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
        it('should revert when attempting to add liquidity with ETH value different than amount', async () => {
            const converter = await initConverter(true, true, true);

            await expectRevert(converter.addLiquidity(ETH_RESERVE_ADDRESS, 700, MIN_RETURN, { value: 701 }), 'ERR_ETH_AMOUNT_MISMATCH');
        });

        it('should revert when attempting to add liquidity with ETH value when there is no ETH reserve', async () => {
            const converter = await initConverter(true, true, false);

            const amount = 600;
            await reserveToken.approve(converter.address, amount, { from: sender });
            await expectRevert(converter.addLiquidity(reserveToken.address, amount, MIN_RETURN, { value: amount }), 'ERR_ETH_AMOUNT_MISMATCH');
        });
    });

    describe('internal rate', () => {
        for (const isReserve1Primary of [true, false]) {
            describe(`${isReserve1Primary ? 'reserve1 is primary' : 'reserve2 is primary'}`, () => {
                for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                    describe(`${isETHReserve === 0 ? 'with ERC20 reserves' : 'with ETH reserve'},`, () => {
                        const convertAndReturnRates = async (amount) => {
                            let value = 0;
                            if (isETHReserve) {
                                value = amount;
                            } else {
                                await reserveToken.approve(bancorNetwork.address, amount, { from: sender });
                            }

                            await convert([getReserve1Address(isETHReserve), anchorAddress, reserveToken2.address],
                                amount, MIN_RETURN, { value });

                            const referenceRate = await converter.referenceRate.call();
                            const lastConversionRate = await converter.lastConversionRate.call();

                            return { referenceRate, lastConversionRate };
                        };

                        let converter;
                        beforeEach(async () => {
                            const reserve1Data = [getReserve1(isETHReserve), getReserve1Address(isETHReserve)];
                            const reserve2Data = [reserveToken2, reserveToken2.address];
                            const primaryReserveAddress = isReserve1Primary ? reserve1Data[1] : reserve2Data[1];
                            converter = await initConverter(true, true, isETHReserve, 5000, primaryReserveAddress);
                        });

                        it('should be initially equal to the external rate', async () => {
                            const referenceRate = await converter.referenceRate.call();
                            const lastConversionRate = await converter.lastConversionRate.call();

                            expect(referenceRate.n).to.be.bignumber.equal(INITIAL_ORACLE_A_PRICE);
                            expect(referenceRate.d).to.be.bignumber.equal(INITIAL_ORACLE_B_PRICE);
                            expect(lastConversionRate.n).to.be.bignumber.equal(INITIAL_ORACLE_A_PRICE);
                            expect(lastConversionRate.d).to.be.bignumber.equal(INITIAL_ORACLE_B_PRICE);
                        });

                        it('should reset to the external oracle rate after its update', async () => {
                            const amount = new BN(100);

                            let { referenceRate } = await convertAndReturnRates(amount);

                            expect(referenceRate.n).to.be.bignumber.equal(INITIAL_ORACLE_A_PRICE);
                            expect(referenceRate.d).to.be.bignumber.equal(INITIAL_ORACLE_B_PRICE);

                            const rateN = new BN(15000);
                            const rateD = new BN(22000);

                            await updateChainlinkOracle(converter, chainlinkPriceOracleA, rateN);
                            await updateChainlinkOracle(converter, chainlinkPriceOracleB, rateD);

                            ({ referenceRate } = await convertAndReturnRates(amount));

                            expect(referenceRate.n).to.be.bignumber.equal(rateN);
                            expect(referenceRate.d).to.be.bignumber.equal(rateD);
                        });

                        it('should only change on rate changing conversion in the same block', async () => {
                            // We will simulate the case when an internal rate doesn't change by creating an external
                            // update to the same price.
                            const prevReferenceUpdateTime = now.sub(new BN(100));
                            const prevLastConversionRate = await converter.lastConversionRate.call();

                            await converter.setReferenceRateUpdateTime(prevReferenceUpdateTime);

                            await chainlinkPriceOracleA.setAnswer(INITIAL_ORACLE_A_PRICE);
                            await chainlinkPriceOracleA.setTimestamp(now);
                            await chainlinkPriceOracleB.setAnswer(INITIAL_ORACLE_B_PRICE);
                            await chainlinkPriceOracleB.setTimestamp(now);

                            const amount = new BN(100);
                            const { lastConversionRate } = await convertAndReturnRates(amount);

                            expect(await converter.referenceRateUpdateTime.call()).to.be.bignumber.equal(prevReferenceUpdateTime);
                            expect(lastConversionRate.n).to.be.bignumber.equal(prevLastConversionRate.n);
                            expect(lastConversionRate.d).to.be.bignumber.equal(prevLastConversionRate.d);
                        });

                        [
                            duration.seconds(0),
                            duration.seconds(1),
                            duration.seconds(2),
                            duration.seconds(3),
                            duration.seconds(10),
                            duration.seconds(100),
                            duration.seconds(200),
                            RATE_PROPAGATION_PERIOD.add(duration.seconds(1)),
                            RATE_PROPAGATION_PERIOD.add(duration.minutes(10)),
                            RATE_PROPAGATION_PERIOD.add(duration.minutes(10)).add(duration.seconds(10)),
                            RATE_PROPAGATION_PERIOD.add(duration.days(2)),
                            duration.years(1)
                        ].forEach((timeElapsed) => {
                            const expectRatesAlmostEqual = (rate, newRate) => {
                                const rate1 = Decimal(rate.n.toString()).div(Decimal(rate.d.toString()));
                                const rate2 = Decimal(newRate.n.toString()).div(Decimal(newRate.d.toString()));

                                const ratio = rate1.div(rate2);
                                expect(ratio.gte(0.99999999999999999999999999999), 'below MIN_RATIO');
                                expect(ratio.lte(1.00000000000000000000000000001), 'above MAX_RATIO');
                            };

                            const getLastConversionRate = async (timeElapsed) => {
                                if (timeElapsed.eq(new BN(0))) {
                                    return { lastConversionRate: await converter.referenceRate.call() };
                                }

                                if (timeElapsed.gte(RATE_PROPAGATION_PERIOD)) {
                                    return { lastConversionRate: await converter.lastConversionRate.call() };
                                }

                                const sourceStakedBalance = await converter.reserveStakedBalance.call(getReserve1Address(isETHReserve));
                                const targetStakedBalance = await converter.reserveStakedBalance.call(reserveToken2.address);
                                const sourceWeight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                                const targetWeight = await converter.reserveWeight(reserveToken2.address);

                                let sourceBalance = await converter.reserveBalance.call(getReserve1Address(isETHReserve));
                                let targetBalance = await converter.reserveBalance.call(reserveToken2.address);
                                sourceBalance = sourceStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(sourceBalance);
                                targetBalance = targetStakedBalance.mul(AMPLIFICATION_FACTOR.sub(new BN(1))).add(targetBalance);

                                return { lastConversionRate: { n: targetBalance.mul(sourceWeight), d: sourceBalance.mul(targetWeight) } };
                            };

                            const getReferenceRate = (referenceRate, lastConversionRate, timeElapsed) => {
                                if (timeElapsed.eq(new BN(0))) {
                                    return { referenceRate };
                                }

                                if (timeElapsed.gte(RATE_PROPAGATION_PERIOD)) {
                                    return { referenceRate: lastConversionRate };
                                }

                                const newReferenceRateN = referenceRate.n.mul(lastConversionRate.d).mul(RATE_PROPAGATION_PERIOD.sub(timeElapsed))
                                    .add(referenceRate.d.mul(lastConversionRate.n).mul(timeElapsed));
                                const newReferenceRateD = RATE_PROPAGATION_PERIOD.mul(referenceRate.d).mul(lastConversionRate.d);

                                return { referenceRate: { n: newReferenceRateN, d: newReferenceRateD } };
                            };

                            context(`with conversion after ${timeElapsed.toString()} seconds`, async () => {
                                beforeEach(async () => {
                                    // Set the external oracle update time to the past to trigger the update of the internal
                                    // rate.
                                    const updateTime = now.sub(duration.years(10));
                                    await chainlinkPriceOracleA.setTimestamp(updateTime);
                                    await chainlinkPriceOracleB.setTimestamp(updateTime);

                                    // Make sure that now - referenceRateUpdateTime == timeElapsed.
                                    await converter.setReferenceRateUpdateTime(now.sub(timeElapsed));
                                });

                                it('should properly calculate the internal rate', async () => {
                                    const amount = new BN(100);

                                    const initialReferenceRate = { n: INITIAL_ORACLE_A_PRICE, d: INITIAL_ORACLE_B_PRICE };
                                    const initialLastConversionRate = initialReferenceRate;

                                    const { referenceRate: expectedReferenceRate } = getReferenceRate(initialReferenceRate,
                                        initialLastConversionRate, timeElapsed);
                                    const { referenceRate, lastConversionRate } = await convertAndReturnRates(amount);
                                    const { lastConversionRate: expectedLastConversionRate } = await getLastConversionRate(timeElapsed);

                                    expectRatesAlmostEqual(referenceRate, expectedReferenceRate);
                                    expectRatesAlmostEqual(lastConversionRate, expectedLastConversionRate);
                                });

                                it('should not change more than once in a block', async () => {
                                    const amount = new BN(100);

                                    const { referenceRate, lastConversionRate } = await convertAndReturnRates(amount);

                                    for (let i = 0; i < 5; ++i) {
                                        const {
                                            referenceRate: referenceRate2,
                                            lastConversionRate: lastConversionRate2
                                        } = await convertAndReturnRates(amount);

                                        expect(referenceRate.n).to.be.bignumber.equal(referenceRate2.n);
                                        expect(referenceRate.d).to.be.bignumber.equal(referenceRate2.d);
                                        expect(lastConversionRate.n).to.be.bignumber.equal(lastConversionRate2.n);
                                        expect(lastConversionRate.d).to.be.bignumber.equal(lastConversionRate2.d);
                                    }
                                });

                                it('should continue calculating the rate', async () => {
                                    const amount = new BN(100);

                                    let referenceRate = { n: INITIAL_ORACLE_A_PRICE, d: INITIAL_ORACLE_B_PRICE };
                                    let lastConversionRate = { n: INITIAL_ORACLE_A_PRICE, d: INITIAL_ORACLE_B_PRICE };

                                    for (let i = 1; i < 40; ++i) {
                                        const totalTimeElapsed = timeElapsed.add(new BN(i));
                                        await converter.setReferenceRateUpdateTime(now.sub(totalTimeElapsed));

                                        const { referenceRate: expectedReferenceRate } = getReferenceRate(referenceRate,
                                            lastConversionRate, timeElapsed);

                                        ({ referenceRate, lastConversionRate } = await convertAndReturnRates(amount));

                                        const { lastConversionRate: expectedLastConversionRate } = await getLastConversionRate(timeElapsed);

                                        expectRatesAlmostEqual(referenceRate, expectedReferenceRate);
                                        expectRatesAlmostEqual(lastConversionRate, expectedLastConversionRate);
                                    }
                                });
                            });
                        });
                    });
                }
            });
        }
    });
});
