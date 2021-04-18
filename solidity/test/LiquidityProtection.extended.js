const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { ZERO_ADDRESS, registry, roles, MAX_UINT256, NATIVE_TOKEN_ADDRESS } = require('./helpers/Constants');
const { latest } = require('./helpers/Time');

const Contracts = require('./helpers/Contracts');
const { Decimal, min } = require('./helpers/MathUtils');

const { ROLE_OWNER, ROLE_GOVERNOR, ROLE_MINTER } = roles;

const PPM_RESOLUTION = BigNumber.from(1000000);

const RESERVE1_AMOUNT = BigNumber.from(1000000);
const RESERVE2_AMOUNT = BigNumber.from(2500000);
const TOTAL_SUPPLY = BigNumber.from(10).pow(BigNumber.from(25));

const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_CONVERTER_WEIGHTS = [500_000, 500_000];

let now;
let contractRegistry;
let bancorNetwork;
let networkToken;
let networkTokenGovernance;
let govToken;
let govTokenGovernance;
let checkpointStore;
let poolToken;
let converterRegistry;
let converterRegistryData;
let converter;
let liquidityProtectionSettings;
let liquidityProtectionStore;
let liquidityProtectionStats;
let liquidityProtectionSystemStore;
let liquidityProtectionWallet;
let liquidityProtection;
let baseToken;
let baseTokenAddress;
let owner;
let governor;
let accounts;

describe('LiquidityProtection - Extended', () => {
    const getConverterName = (type) => {
        switch (type) {
            case STANDARD_CONVERTER_TYPE:
                return 'StandardPoolConverter';
            default:
                throw new Error(`Unsupported type ${type}`);
        }
    };

    for (const converterType of [STANDARD_CONVERTER_TYPE]) {
        context(getConverterName(converterType), () => {
            const initPool = async (isETH = false, whitelist = true, standard = true) => {
                if (isETH) {
                    baseTokenAddress = NATIVE_TOKEN_ADDRESS;
                } else {
                    // create a pool with ERC20 as the base token
                    baseToken = await Contracts.DSToken.deploy('RSV1', 'RSV1', 18);
                    await baseToken.issue(owner.address, TOTAL_SUPPLY);
                    baseTokenAddress = baseToken.address;
                }

                await converterRegistry.newConverter(
                    converterType,
                    'PT',
                    'PT',
                    18,
                    PPM_RESOLUTION,
                    [baseTokenAddress, networkToken.address],
                    STANDARD_CONVERTER_WEIGHTS
                );
                const anchorCount = await converterRegistry.getAnchorCount();
                const poolTokenAddress = await converterRegistry.getAnchor(anchorCount - 1);
                poolToken = await Contracts.DSToken.attach(poolTokenAddress);
                const converterAddress = await poolToken.owner();

                switch (converterType) {
                    case STANDARD_CONVERTER_TYPE:
                        converter = await Contracts.TestStandardPoolConverter.attach(converterAddress);
                        break;

                    default:
                        throw new Error(`Unsupported converter type ${converterType}`);
                }

                await setTime(now);
                await converter.acceptOwnership();
                await networkToken.approve(converter.address, RESERVE2_AMOUNT);

                let value = 0;
                if (isETH) {
                    value = RESERVE1_AMOUNT;
                } else {
                    await baseToken.approve(converter.address, RESERVE1_AMOUNT);
                }

                await converter.addLiquidity(
                    [baseTokenAddress, networkToken.address],
                    [RESERVE1_AMOUNT, RESERVE2_AMOUNT],
                    1,
                    {
                        value: value
                    }
                );

                // whitelist pool
                if (whitelist) {
                    await liquidityProtectionSettings.addPoolToWhitelist(poolToken.address);
                }
            };

            const addProtectedLiquidity = async (
                poolTokenAddress,
                token,
                tokenAddress,
                amount,
                isETH = false,
                from = owner,
                recipient = undefined,
                value = 0
            ) => {
                if (isETH) {
                    value = amount;
                } else {
                    await token.connect(from).approve(liquidityProtection.address, amount);
                }

                if (recipient) {
                    return liquidityProtection
                        .connect(from)
                        .addLiquidityFor(recipient.address, poolTokenAddress, tokenAddress, amount, {
                            value: value
                        });
                }

                return liquidityProtection
                    .connect(from)
                    .addLiquidity(poolTokenAddress, tokenAddress, amount, { value: value });
            };

            const convert = async (path, amount, minReturn) => {
                let token;
                if (path[0] === baseTokenAddress) {
                    token = baseToken;
                } else {
                    token = networkToken;
                }

                await token.approve(bancorNetwork.address, amount);
                return bancorNetwork.convertByPath2(path, amount, minReturn, ZERO_ADDRESS);
            };

            const generateFee = async (sourceToken, targetToken, conversionFee = BigNumber.from(10000)) => {
                await converter.setConversionFee(conversionFee);

                const prevBalance = await targetToken.balanceOf(owner.address);
                const sourceBalance = await converter.reserveBalance(sourceToken.address);

                await convert(
                    [sourceToken.address, poolToken.address, targetToken.address],
                    sourceBalance.div(BigNumber.from(2)),
                    BigNumber.from(1)
                );

                const currBalance = await targetToken.balanceOf(owner.address);

                await convert(
                    [targetToken.address, poolToken.address, sourceToken.address],
                    currBalance.sub(prevBalance),
                    BigNumber.from(1)
                );

                await converter.setConversionFee(BigNumber.from(0));
            };

            const getNetworkTokenMaxAmount = async () => {
                const totalSupply = await poolToken.totalSupply();
                const reserveBalance = await converter.reserveBalance(networkToken.address);
                const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                return systemBalance.mul(reserveBalance).div(totalSupply);
            };

            const increaseRate = async (reserveAddress) => {
                let sourceAddress;
                if (reserveAddress === baseTokenAddress) {
                    sourceAddress = networkToken.address;
                } else {
                    sourceAddress = baseTokenAddress;
                }

                const path = [sourceAddress, poolToken.address, reserveAddress];
                let amount = await converter.reserveBalance(networkToken.address);
                amount = Decimal(2).sqrt().sub(1).mul(amount.toString());
                amount = BigNumber.from(amount.floor().toFixed());

                await convert(path, amount, 1);
            };

            const setTime = async (time) => {
                now = time;

                for (const t of [converter, checkpointStore, liquidityProtection]) {
                    if (t) {
                        await t.setTime(now);
                    }
                }
            };

            before(async () => {
                accounts = await ethers.getSigners();
                owner = accounts[0];
                governor = accounts[1];

                contractRegistry = await Contracts.ContractRegistry.deploy();
                converterRegistry = await Contracts.ConverterRegistry.deploy(contractRegistry.address);
                converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);
                bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);

                const standardPoolConverterFactory = await Contracts.TestStandardPoolConverterFactory.deploy();
                const converterFactory = await Contracts.ConverterFactory.deploy();
                await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

                const networkSettings = await Contracts.NetworkSettings.deploy(owner.address, 0);

                await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
                await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);
                await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);
            });

            beforeEach(async () => {
                networkToken = await Contracts.DSToken.deploy('BNT', 'BNT', 18);
                await networkToken.issue(owner.address, TOTAL_SUPPLY);
                networkTokenGovernance = await Contracts.TestTokenGovernance.deploy(networkToken.address);
                await networkTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await networkToken.transferOwnership(networkTokenGovernance.address);
                await networkTokenGovernance.acceptTokenOwnership();

                govToken = await Contracts.DSToken.deploy('vBNT', 'vBNT', 18);
                govTokenGovernance = await Contracts.TestTokenGovernance.deploy(govToken.address);
                await govTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await govToken.transferOwnership(govTokenGovernance.address);
                await govTokenGovernance.acceptTokenOwnership();

                // initialize liquidity protection
                checkpointStore = await Contracts.TestCheckpointStore.deploy();
                liquidityProtectionSettings = await Contracts.LiquidityProtectionSettings.deploy(
                    networkToken.address,
                    contractRegistry.address
                );
                await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(BigNumber.from(100));
                await liquidityProtectionSettings.setMinNetworkCompensation(BigNumber.from(3));

                liquidityProtectionStore = await Contracts.LiquidityProtectionStore.deploy();
                liquidityProtectionStats = await Contracts.LiquidityProtectionStats.deploy();
                liquidityProtectionSystemStore = await Contracts.LiquidityProtectionSystemStore.deploy();
                liquidityProtectionWallet = await Contracts.TokenHolder.deploy();
                liquidityProtection = await Contracts.TestLiquidityProtection.deploy(
                    liquidityProtectionSettings.address,
                    liquidityProtectionStore.address,
                    liquidityProtectionStats.address,
                    liquidityProtectionSystemStore.address,
                    liquidityProtectionWallet.address,
                    networkTokenGovernance.address,
                    govTokenGovernance.address,
                    checkpointStore.address
                );

                await liquidityProtectionSettings.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await liquidityProtectionStats.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await liquidityProtectionSystemStore.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await checkpointStore.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await liquidityProtectionStore.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptStoreOwnership();
                await liquidityProtectionWallet.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptWalletOwnership();
                await networkTokenGovernance.connect(governor).grantRole(ROLE_MINTER, liquidityProtection.address);
                await govTokenGovernance.connect(governor).grantRole(ROLE_MINTER, liquidityProtection.address);

                await setTime(await latest());

                // initialize pool
                await initPool();
            });

            describe('stress tests', () => {
                describe('average rate', () => {
                    for (let minutesElapsed = 1; minutesElapsed <= 10; minutesElapsed += 1) {
                        for (let convertPortion = 1; convertPortion <= 10; convertPortion += 1) {
                            for (let maxDeviation = 1; maxDeviation <= 10; maxDeviation += 1) {
                                context(
                                    `minutesElapsed = ${minutesElapsed}, convertPortion = ${convertPortion}%, maxDeviation = ${maxDeviation}%`,
                                    () => {
                                        beforeEach(async () => {
                                            await liquidityProtectionSettings.setAverageRateMaxDeviation(
                                                BigNumber.from(maxDeviation)
                                                    .mul(PPM_RESOLUTION)
                                                    .div(BigNumber.from(100))
                                            );
                                            await baseToken.approve(converter.address, RESERVE1_AMOUNT);
                                            await networkToken.approve(converter.address, RESERVE2_AMOUNT);

                                            await converter.addLiquidity(
                                                [baseToken.address, networkToken.address],
                                                [RESERVE1_AMOUNT, RESERVE2_AMOUNT],
                                                1
                                            );

                                            await convert(
                                                [baseTokenAddress, poolToken.address, networkToken.address],
                                                RESERVE1_AMOUNT.mul(BigNumber.from(convertPortion)).div(
                                                    BigNumber.from(100)
                                                ),
                                                1
                                            );

                                            let time = await converter.currentTime();
                                            time = time.add(BigNumber.from(minutesElapsed * 60));
                                            await converter.setTime(time);
                                        });

                                        it('should properly calculate the average rate', async () => {
                                            const averageRate = await converter.recentAverageRate(baseToken.address);
                                            const actualRate = await Promise.all(
                                                [networkToken, baseToken].map((reserveToken) => {
                                                    return reserveToken.balanceOf(converter.address);
                                                })
                                            );
                                            const min = Decimal(actualRate[0].toString())
                                                .div(actualRate[1].toString())
                                                .mul(100 - maxDeviation)
                                                .div(100);
                                            const max = Decimal(actualRate[0].toString())
                                                .div(actualRate[1].toString())
                                                .mul(100)
                                                .div(100 - maxDeviation);
                                            const mid = Decimal(averageRate[0].toString()).div(
                                                averageRate[1].toString()
                                            );
                                            if (min.lte(mid) && mid.lte(max)) {
                                                const reserveTokenRate = await liquidityProtection.averageRateTest(
                                                    poolToken.address,
                                                    baseToken.address
                                                );
                                                expect(reserveTokenRate[0]).to.be.equal(averageRate[0]);
                                                expect(reserveTokenRate[1]).to.be.equal(averageRate[1]);
                                            } else {
                                                await expect(
                                                    liquidityProtection.averageRateTest(
                                                        poolToken.address,
                                                        baseToken.address
                                                    )
                                                ).to.be.revertedWith('ERR_INVALID_RATE');
                                            }
                                        });
                                    }
                                );
                            }
                        }
                    }
                });

                describe('accuracy', () => {
                    const MIN_AMOUNT = Decimal(2).pow(0);
                    const MAX_AMOUNT = Decimal(2).pow(127);

                    const MIN_RATIO = Decimal(2).pow(256 / 4);
                    const MAX_RATIO = Decimal(2).pow(256 / 3);

                    const MIN_DURATION = 30 * 24 * 60 * 60;
                    const MAX_DURATION = 100 * 24 * 60 * 60;

                    const removeLiquidityTargetAmountTest = (amounts, durations, deviation, range) => {
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
                                                                        poolTokenRateN: poolTokenRateN.toString(),
                                                                        poolTokenRateD: poolTokenRateD.toString(),
                                                                        poolAmount: poolAmount.toString(),
                                                                        reserveAmount: reserveAmount.toString(),
                                                                        addSpotRateN: addSpotRateN.toString(),
                                                                        addSpotRateD: addSpotRateD.toString(),
                                                                        removeSpotRateN: removeSpotRateN.toString(),
                                                                        removeSpotRateD: removeSpotRateD.toString(),
                                                                        removeAverageRateN: removeAverageRateN.toString(),
                                                                        removeAverageRateD: removeAverageRateD.toString(),
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
                                                                        expectAlmostEqual(
                                                                            Decimal(actual.toString()),
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
                    };

                    const protectedAmountPlusFeeTest = (
                        poolAmounts,
                        poolRateNs,
                        poolRateDs,
                        addRateNs,
                        addRateDs,
                        removeRateNs,
                        removeRateDs,
                        range
                    ) => {
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
                                                    // eslint-disable-next-line max-len
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
                    };

                    const impLossTest = (initialRateNs, initialRateDs, currentRateNs, currentRateDs, range) => {
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
                                            const expected = impLoss(
                                                initialRateN,
                                                initialRateD,
                                                currentRateN,
                                                currentRateD
                                            );
                                            const actual = await liquidityProtection.impLossTest(
                                                initialRateN,
                                                initialRateD,
                                                currentRateN,
                                                currentRateD
                                            );
                                            expectAlmostEqual(
                                                Decimal(actual[0].toString()).div(actual[1].toString()),
                                                expected,
                                                range
                                            );
                                        });
                                    }
                                }
                            }
                        }
                    };

                    const compensationAmountTest = (amounts, fees, lossNs, lossDs, levelNs, levelDs, range) => {
                        let testNum = 0;
                        const numOfTest = [amounts, fees, lossNs, lossDs, levelNs, levelDs].reduce(
                            (a, b) => a * b.length,
                            1
                        );

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
                                                    const expected = compensationAmount(
                                                        amount,
                                                        total,
                                                        lossN,
                                                        lossD,
                                                        levelN,
                                                        levelD
                                                    );
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
                    };

                    const removeLiquidityTargetAmount = (
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
                    ) => {
                        const poolTokenRate = Decimal(poolTokenRateN.toString()).div(poolTokenRateD.toString());
                        const addSpotRate = Decimal(addSpotRateN.toString()).div(addSpotRateD.toString());
                        const removeSpotRate = Decimal(removeSpotRateN.toString()).div(removeSpotRateD.toString());
                        const removeAverageRate = Decimal(removeAverageRateN.toString()).div(
                            removeAverageRateD.toString()
                        );
                        poolAmount = Decimal(poolAmount.toString());
                        reserveAmount = Decimal(reserveAmount.toString());

                        // calculate the protected amount of reserve tokens plus accumulated fee before compensation
                        const reserveAmountPlusFee = removeSpotRate
                            .div(addSpotRate)
                            .sqrt()
                            .mul(poolTokenRate)
                            .mul(poolAmount);
                        const total = reserveAmountPlusFee.gt(reserveAmount) ? reserveAmountPlusFee : reserveAmount;

                        // calculate the impermanent loss
                        const ratio = removeAverageRate.div(addSpotRate);
                        const loss = ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();

                        // calculate the protection level
                        const delay = timeElapsed < MIN_DURATION ? 0 : timeElapsed;
                        const level = Decimal(Math.min(delay, MAX_DURATION)).div(MAX_DURATION);

                        // calculate the compensation amount
                        return total.mul(Decimal(1).sub(loss)).add(reserveAmount.mul(loss).mul(level));
                    };

                    const protectedAmountPlusFee = (
                        poolAmount,
                        poolRateN,
                        poolRateD,
                        addRateN,
                        addRateD,
                        removeRateN,
                        removeRateD
                    ) => {
                        return Decimal(removeRateN.toString())
                            .div(removeRateD)
                            .mul(addRateD)
                            .div(addRateN)
                            .sqrt()
                            .mul(poolRateN)
                            .div(poolRateD)
                            .mul(poolAmount);
                    };

                    const impLoss = (initialRateN, initialRateD, currentRateN, currentRateD) => {
                        const ratioN = currentRateN.mul(initialRateD);
                        const ratioD = currentRateD.mul(initialRateN);
                        const ratio = Decimal(ratioN.toString()).div(ratioD.toString());
                        return ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();
                    };

                    const compensationAmount = (amount, total, lossN, lossD, levelN, levelD) => {
                        return Decimal(total.toString())
                            .mul(lossD.sub(lossN))
                            .div(lossD)
                            .add(lossN.mul(levelN).mul(amount).div(lossD.mul(levelD)));
                    };

                    const fixedDev = (a, b, p) => {
                        const x = Decimal(a.toString());
                        const y = Decimal(b.toString());
                        const q = Decimal(1).sub(p);
                        if (x.lt(y.mul(q))) {
                            return BigNumber.from(y.mul(q).toFixed(0, Decimal.ROUND_UP));
                        }
                        if (x.gt(y.div(q))) {
                            return BigNumber.from(y.div(q).toFixed(0, Decimal.ROUND_DOWN));
                        }
                        return a;
                    };

                    const expectAlmostEqual = (actual, expected, range) => {
                        if (!actual.eq(expected)) {
                            const absoluteError = actual.sub(expected).abs();
                            const relativeError = actual.div(expected).sub(1).abs();
                            expect(
                                absoluteError.lte(range.maxAbsoluteError) || relativeError.lte(range.maxRelativeError)
                            ).to.be.equal(
                                true,
                                `\nabsoluteError = ${absoluteError.toFixed(
                                    25
                                )}\nrelativeError = ${relativeError.toFixed(25)}`
                            );
                        }
                    };

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
                });

                describe('edge cases', () => {
                    const f = (a, b) => [].concat(...a.map((d) => b.map((e) => [].concat(d, e))));
                    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
                    const condOrAlmostEqual = (cond, actual, expected, maxError) => {
                        if (!cond) {
                            const error = Decimal(actual.toString()).div(expected.toString()).sub(1).abs();
                            if (error.gt(maxError)) {
                                return `error = ${error.toFixed(maxError.length)}`;
                            }
                        }
                        return '';
                    };

                    const CONFIGURATIONS = [
                        { increaseRate: false, generateFee: false },
                        { increaseRate: false, generateFee: true },
                        { increaseRate: true, generateFee: false }
                    ];

                    const NUM_OF_DAYS = [30, 100];
                    const DECIMAL_COMBINATIONS = cartesian([12, 24], [12, 24], [15, 21], [15, 21]);

                    beforeEach(async () => {
                        await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(BigNumber.from(0));
                        await liquidityProtectionSettings.setNetworkTokenMintingLimit(poolToken.address, MAX_UINT256);

                        await setTime(BigNumber.from(1));
                    });

                    for (const config of CONFIGURATIONS) {
                        for (const numOfDays of NUM_OF_DAYS) {
                            const timestamp = numOfDays * 24 * 60 * 60 + 1;
                            for (const decimals of DECIMAL_COMBINATIONS) {
                                const amounts = decimals.map((n) => BigNumber.from(10).pow(BigNumber.from(n)));

                                let test;
                                if (!config.increaseRate && !config.generateFee) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.eq(expected),
                                            actual,
                                            expected,
                                            { 1: '0.000000000000001', 3: '0.00000004' }[converterType]
                                        );
                                } else if (!config.increaseRate && config.generateFee) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.gt(expected),
                                            actual,
                                            expected,
                                            { 1: '0.0', 3: '0.0' }[converterType]
                                        );
                                } else if (config.increaseRate && !config.generateFee && numOfDays < 100) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.lt(expected),
                                            actual,
                                            expected,
                                            { 1: '0.0', 3: '0.0' }[converterType]
                                        );
                                } else if (config.increaseRate && !config.generateFee && numOfDays >= 100) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.eq(expected),
                                            actual,
                                            expected,
                                            { 1: '0.000000000000001', 3: '0.00000005' }[converterType]
                                        );
                                } else {
                                    throw new Error('invalid configuration');
                                }

                                // eslint-disable-next-line max-len
                                it(`base token, increaseRate = ${config.increaseRate}, generateFee = ${config.generateFee}, numOfDays = ${numOfDays}, decimals = ${decimals}`, async () => {
                                    await baseToken.approve(converter.address, amounts[0]);
                                    await networkToken.approve(converter.address, amounts[1]);
                                    await converter.addLiquidity(
                                        [baseToken.address, networkToken.address],
                                        [amounts[0], amounts[1]],
                                        1
                                    );

                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        amounts[2]
                                    );
                                    const amount = min(amounts[3], await getNetworkTokenMaxAmount());
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        networkToken,
                                        networkToken.address,
                                        amount
                                    );

                                    if (config.increaseRate) {
                                        await increaseRate(networkToken.address);
                                    }

                                    if (config.generateFee) {
                                        await generateFee(baseToken, networkToken);
                                    }

                                    await setTime(timestamp);
                                    const actual = await liquidityProtection.removeLiquidityReturn(
                                        0,
                                        PPM_RESOLUTION,
                                        timestamp
                                    );
                                    const error = test(actual[0], amounts[2]);
                                    expect(error).to.be.empty;
                                });
                            }
                        }
                    }

                    for (const config of CONFIGURATIONS) {
                        for (const numOfDays of NUM_OF_DAYS) {
                            const timestamp = numOfDays * 24 * 60 * 60 + 1;
                            for (const decimals of DECIMAL_COMBINATIONS) {
                                const amounts = decimals.map((n) => BigNumber.from(10).pow(BigNumber.from(n)));

                                let test;
                                if (!config.increaseRate && !config.generateFee) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.eq(expected),
                                            actual,
                                            expected,
                                            { 1: '0.000000000000001', 3: '0.00000004' }[converterType]
                                        );
                                } else if (!config.increaseRate && config.generateFee) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.gt(expected),
                                            actual,
                                            expected,
                                            { 1: '0.002', 3: '0.002' }[converterType]
                                        );
                                } else if (config.increaseRate && !config.generateFee && numOfDays < 100) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.lt(expected),
                                            actual,
                                            expected,
                                            { 1: '0.0', 3: '0.0' }[converterType]
                                        );
                                } else if (config.increaseRate && !config.generateFee && numOfDays >= 100) {
                                    test = (actual, expected) =>
                                        condOrAlmostEqual(
                                            actual.eq(expected),
                                            actual,
                                            expected,
                                            { 1: '0.002', 3: '0.002' }[converterType]
                                        );
                                } else {
                                    throw new Error('invalid configuration');
                                }

                                // eslint-disable-next-line max-len
                                it(`network token, increaseRate = ${config.increaseRate}, generateFee = ${config.generateFee}, numOfDays = ${numOfDays}, decimals = ${decimals}`, async () => {
                                    await baseToken.approve(converter.address, amounts[0]);
                                    await networkToken.approve(converter.address, amounts[1]);
                                    await converter.addLiquidity(
                                        [baseToken.address, networkToken.address],
                                        [amounts[0], amounts[1]],
                                        1
                                    );

                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        amounts[2]
                                    );
                                    const amount = min(amounts[3], await getNetworkTokenMaxAmount());
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        networkToken,
                                        networkToken.address,
                                        amount
                                    );

                                    if (config.increaseRate) {
                                        await increaseRate(baseTokenAddress);
                                    }

                                    if (config.generateFee) {
                                        await generateFee(networkToken, baseToken);
                                    }

                                    await setTime(timestamp);
                                    const actual = await liquidityProtection.removeLiquidityReturn(
                                        1,
                                        PPM_RESOLUTION,
                                        timestamp
                                    );
                                    const error = test(actual[0], amount);
                                    expect(error).to.be.empty;
                                });
                            }
                        }
                    }
                });
            });
        });
    }
});
