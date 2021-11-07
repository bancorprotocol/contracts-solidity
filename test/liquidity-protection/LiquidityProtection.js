const chai = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { ZERO_ADDRESS, registry, roles, MAX_UINT256, NATIVE_TOKEN_ADDRESS } = require('../helpers/Constants');
const { duration, latest } = require('../helpers/Time');

const Contracts = require('../../components/Contracts').default;
const { Decimal } = require('../helpers/MathUtils');

chai.use(require('chai-arrays'));
const { expect } = chai;

const { ROLE_OWNER, ROLE_GOVERNOR, ROLE_MINTER } = roles;

const PPM_RESOLUTION = BigNumber.from(1000000);

const RESERVE1_AMOUNT = BigNumber.from(1000000);
const RESERVE2_AMOUNT = BigNumber.from(2500000);
const TOTAL_SUPPLY = BigNumber.from(10).pow(BigNumber.from(25));

const PROTECTION_NO_PROTECTION = 0;
const PROTECTION_PARTIAL_PROTECTION = 1;
const PROTECTION_FULL_PROTECTION = 2;
const PROTECTION_EXCESSIVE_PROTECTION = 3;

const POOL_AVAILABLE_SPACE_TEST_ADDITIONAL_BALANCES = [
    { baseBalance: 1000000, networkBalance: 1000000 },
    { baseBalance: 1234567, networkBalance: 2000000 },
    { baseBalance: 2345678, networkBalance: 3000000 },
    { baseBalance: 3456789, networkBalance: 4000000 },
    { baseBalance: 4000000, networkBalance: 4000000 },
    { baseBalance: 5000000, networkBalance: 3000000 },
    { baseBalance: 6000000, networkBalance: 2000000 },
    { baseBalance: 7000000, networkBalance: 1000000 }
];

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

describe('LiquidityProtection', () => {
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
                    .addLiquidity(poolTokenAddress, tokenAddress, amount, { value });
            };

            const getProtection = (protection) => {
                return {
                    provider: protection[0],
                    poolToken: protection[1],
                    reserveToken: protection[2],
                    poolAmount: protection[3],
                    reserveAmount: protection[4],
                    reserveRateN: protection[5],
                    reserveRateD: protection[6],
                    timestamp: protection[7]
                };
            };

            const getTimestamp = async (protectionLevel) => {
                switch (protectionLevel) {
                    case PROTECTION_NO_PROTECTION:
                        return now.add(duration.days(15));
                    case PROTECTION_PARTIAL_PROTECTION:
                        return now.add(duration.days(40));
                    case PROTECTION_FULL_PROTECTION:
                        return now.add(duration.days(100));
                    case PROTECTION_EXCESSIVE_PROTECTION:
                        return now.add(duration.days(300));
                }
            };

            const poolTokenRate = (poolSupply, reserveBalance) => {
                return { n: reserveBalance.mul(BigNumber.from(2)), d: poolSupply };
            };

            const getBalance = async (token, address, account) => {
                if (address === NATIVE_TOKEN_ADDRESS) {
                    return await ethers.provider.getBalance(account);
                }

                return token.balanceOf(account);
            };

            const getTransactionCost = async (txResult) => {
                const cumulativeGasUsed = (await txResult.wait()).cumulativeGasUsed;
                return BigNumber.from(txResult.gasPrice).mul(BigNumber.from(cumulativeGasUsed));
            };

            const expectAlmostEqual = (amount1, amount2, maxError = '0.01') => {
                if (!amount1.eq(amount2)) {
                    const error = Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
                    expect(error.lte(maxError)).to.equal(true, `error = ${error.toFixed(maxError.length)}`);
                }
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

            const getPoolStats = async (poolToken, reserveToken, isETHReserve) => {
                const poolTokenAddress = poolToken.address;
                const reserveTokenAddress = isETHReserve ? NATIVE_TOKEN_ADDRESS : reserveToken.address;
                return {
                    totalPoolAmount: await liquidityProtectionStats.totalPoolAmount(poolTokenAddress),
                    totalReserveAmount: await liquidityProtectionStats.totalReserveAmount(
                        poolTokenAddress,
                        reserveTokenAddress
                    )
                };
            };

            const getProviderStats = async (provider, poolToken, reserveToken, isETHReserve) => {
                const poolTokenAddress = poolToken.address;
                const reserveTokenAddress = isETHReserve ? NATIVE_TOKEN_ADDRESS : reserveToken.address;
                return {
                    totalProviderAmount: await liquidityProtectionStats.totalProviderAmount(
                        provider.address,
                        poolTokenAddress,
                        reserveTokenAddress
                    ),
                    providerPools: await liquidityProtectionStats.providerPools(provider.address)
                };
            };

            const getRate = async (reserveAddress) => {
                const reserve1Balance = await converter.reserveBalance(baseTokenAddress);
                const reserve2Balance = await converter.reserveBalance(networkToken.address);
                if (reserveAddress === baseTokenAddress) {
                    return { n: reserve2Balance, d: reserve1Balance };
                }

                return { n: reserve1Balance, d: reserve2Balance };
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

            const getLockedBalance = async (account) => {
                let lockedBalance = BigNumber.from(0);
                const lockedCount = await liquidityProtectionStore.lockedBalanceCount(account);
                for (let i = 0; i < lockedCount; i++) {
                    const balance = (await liquidityProtectionStore.lockedBalance(account, i))[0];
                    lockedBalance = lockedBalance.add(balance);
                }

                return lockedBalance;
            };

            const setTime = async (time) => {
                now = time;

                for (const t of [converter, checkpointStore, liquidityProtection]) {
                    if (t) {
                        await t.setTime(now);
                    }
                }
            };

            const initLiquidityProtection = async () => {
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

                await initPool();
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

            describe('unit tests', () => {
                beforeEach(async () => {
                    await initLiquidityProtection();
                });

                it('verifies the liquidity protection contract after initialization', async () => {
                    const settings = await liquidityProtection.settings();
                    expect(settings).to.equal(liquidityProtectionSettings.address);

                    const store = await liquidityProtection.store();
                    expect(store).to.equal(liquidityProtectionStore.address);

                    const stats = await liquidityProtection.stats();
                    expect(stats).to.equal(liquidityProtectionStats.address);

                    const systemStore = await liquidityProtection.systemStore();
                    expect(systemStore).to.equal(liquidityProtectionSystemStore.address);

                    const wallet = await liquidityProtection.wallet();
                    expect(wallet).to.equal(liquidityProtectionWallet.address);
                });

                it('verifies that the owner can transfer the store ownership', async () => {
                    await liquidityProtection.transferStoreOwnership(accounts[1].address);
                    liquidityProtectionStore.connect(accounts[1]).acceptOwnership();
                });

                it('should revert when a non owner attempts to transfer the store ownership', async () => {
                    await expect(
                        liquidityProtection.connect(accounts[1]).transferStoreOwnership(accounts[2].address)
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('verifies that the owner can transfer the wallet ownership', async () => {
                    await liquidityProtection.transferWalletOwnership(accounts[1].address);
                    liquidityProtectionWallet.connect(accounts[1]).acceptOwnership();
                });

                it('should revert when a non owner attempts to transfer the wallet ownership', async () => {
                    await expect(
                        liquidityProtection.connect(accounts[1]).transferWalletOwnership(accounts[2].address)
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when the caller attempts to add and remove base tokens on the same block', async () => {
                    const balance = await baseToken.balanceOf(owner.address);
                    const amount = (await liquidityProtection.poolAvailableSpace(poolToken.address))[0];
                    await baseToken.approve(liquidityProtection.address, amount);

                    await liquidityProtection.addLiquidity(poolToken.address, baseToken.address, amount);
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                    let protection1 = await liquidityProtectionStore.protectedLiquidity(protectionIds[0]);
                    protection1 = getProtection(protection1);

                    await govToken.approve(liquidityProtection.address, protection1.reserveAmount);
                    await expect(
                        liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION)
                    ).to.be.revertedWith('ERR_TOO_EARLY');
                    protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                    expect(protectionIds.length).to.equal(1);

                    const newBalance = await baseToken.balanceOf(owner.address);
                    expect(newBalance).to.equal(balance.sub(amount));
                });

                it('should revert when the caller attempts to add and partially remove base tokens on the same block', async () => {
                    const balance = await baseToken.balanceOf(owner.address);
                    const amount = (await liquidityProtection.poolAvailableSpace(poolToken.address))[0];
                    await baseToken.approve(liquidityProtection.address, amount);

                    await liquidityProtection.addLiquidity(poolToken.address, baseToken.address, amount);
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                    let protection1 = await liquidityProtectionStore.protectedLiquidity(protectionIds[0]);
                    protection1 = getProtection(protection1);

                    await govToken.approve(liquidityProtection.address, protection1.reserveAmount);
                    await expect(
                        liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION.div(BigNumber.from(2)))
                    ).to.be.revertedWith('ERR_TOO_EARLY');
                    protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                    expect(protectionIds.length).to.equal(1);

                    const newBalance = await baseToken.balanceOf(owner.address);
                    expect(newBalance).to.equal(balance.sub(amount));
                });

                for (const { baseBalance, networkBalance } of POOL_AVAILABLE_SPACE_TEST_ADDITIONAL_BALANCES) {
                    it(`pool available space with additional balances of ${baseBalance} and ${networkBalance}`, async () => {
                        await baseToken.approve(converter.address, baseBalance);
                        await networkToken.approve(converter.address, networkBalance);
                        await converter.addLiquidity(
                            [baseToken.address, networkToken.address],
                            [baseBalance, networkBalance],
                            1
                        );

                        await baseToken.approve(liquidityProtection.address, TOTAL_SUPPLY);
                        await networkToken.approve(liquidityProtection.address, TOTAL_SUPPLY);

                        const poolTokenAvailableSpace = await liquidityProtection.poolAvailableSpace(poolToken.address);
                        const baseTokenAvailableSpace = poolTokenAvailableSpace[0];

                        await expect(
                            liquidityProtection.addLiquidity(
                                poolToken.address,
                                baseToken.address,
                                baseTokenAvailableSpace.add(1)
                            )
                        ).to.be.revertedWith('ERR_MAX_AMOUNT_REACHED');
                        await liquidityProtection.addLiquidity(
                            poolToken.address,
                            baseToken.address,
                            baseTokenAvailableSpace
                        );

                        const poolTokenAvailableSpace2 = await liquidityProtection.poolAvailableSpace(
                            poolToken.address
                        );
                        const networkTokenAvailableSpace = poolTokenAvailableSpace2[1];

                        await expect(
                            liquidityProtection.addLiquidity(
                                poolToken.address,
                                networkToken.address,
                                networkTokenAvailableSpace.add(1)
                            )
                        ).to.be.revertedWith('SafeMath: subtraction overflow');
                        await liquidityProtection.addLiquidity(
                            poolToken.address,
                            networkToken.address,
                            networkTokenAvailableSpace
                        );
                    });
                }

                describe('add liquidity', () => {
                    let recipient;
                    const accountsTmp = [0, 3];

                    // test both addLiquidity and addLiquidityFor
                    for (const account of accountsTmp) {
                        context(account === 0 ? 'for self' : 'for another account', async () => {
                            beforeEach(async () => {
                                recipient = accounts[account];
                            });

                            for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                                describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                    beforeEach(async () => {
                                        await initPool(isETHReserve);
                                    });

                                    it('verifies that the caller can add liquidity', async () => {
                                        const totalSupply = await poolToken.totalSupply();
                                        const reserveBalance = await converter.reserveBalance(baseTokenAddress);
                                        const rate = poolTokenRate(totalSupply, reserveBalance);

                                        const prevPoolStats = await getPoolStats(poolToken, baseToken, isETHReserve);
                                        const prevProviderStats = await getProviderStats(
                                            recipient,
                                            poolToken,
                                            baseToken,
                                            isETHReserve
                                        );
                                        const reserveAmount = BigNumber.from(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );

                                        // verify protection details
                                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                            recipient.address
                                        );
                                        expect(protectionIds.length).to.equal(1);

                                        const expectedPoolAmount = reserveAmount.mul(rate.d).div(rate.n);
                                        const reserve1Balance = await converter.reserveBalance(baseTokenAddress);
                                        const reserve2Balance = await converter.reserveBalance(networkToken.address);

                                        let protection = await liquidityProtectionStore.protectedLiquidity(
                                            protectionIds[0]
                                        );
                                        protection = getProtection(protection);

                                        expect(protection.provider).to.equal(recipient.address);
                                        expect(protection.poolToken).to.equal(poolToken.address);
                                        expect(protection.reserveToken).to.equal(baseTokenAddress);
                                        expect(protection.poolAmount).to.equal(expectedPoolAmount);
                                        expect(protection.reserveAmount).to.equal(reserveAmount);
                                        expect(protection.reserveRateN).to.equal(reserve2Balance);
                                        expect(protection.reserveRateD).to.equal(reserve1Balance);
                                        expect(protection.timestamp).to.equal(BigNumber.from(now));

                                        // verify stats
                                        const poolStats = await getPoolStats(poolToken, baseToken, isETHReserve);
                                        expect(poolStats.totalPoolAmount).to.equal(
                                            prevPoolStats.totalPoolAmount.add(protection.poolAmount)
                                        );
                                        expect(poolStats.totalReserveAmount).to.equal(
                                            prevPoolStats.totalReserveAmount.add(protection.reserveAmount)
                                        );

                                        const providerStats = await getProviderStats(
                                            recipient,
                                            poolToken,
                                            baseToken,
                                            isETHReserve
                                        );

                                        expect(providerStats.totalProviderAmount).to.equal(
                                            prevProviderStats.totalProviderAmount.add(protection.reserveAmount)
                                        );
                                        expect(providerStats.providerPools).to.equalTo([poolToken.address]);

                                        // verify balances
                                        const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                            poolToken.address
                                        );
                                        expect(systemBalance).to.equal(expectedPoolAmount);

                                        const walletBalance = await poolToken.balanceOf(
                                            liquidityProtectionWallet.address
                                        );
                                        expect(walletBalance).to.equal(expectedPoolAmount.mul(BigNumber.from(2)));

                                        const govBalance = await govToken.balanceOf(recipient.address);
                                        expect(govBalance).to.equal(BigNumber.from(0));

                                        const protectionPoolBalance = await poolToken.balanceOf(
                                            liquidityProtection.address
                                        );
                                        expect(protectionPoolBalance).to.equal(BigNumber.from(0));

                                        const protectionBaseBalance = await getBalance(
                                            baseToken,
                                            baseTokenAddress,
                                            liquidityProtection.address
                                        );
                                        expect(protectionBaseBalance).to.equal(BigNumber.from(0));

                                        const protectionNetworkBalance = await networkToken.balanceOf(
                                            liquidityProtection.address
                                        );
                                        expect(protectionNetworkBalance).to.equal(BigNumber.from(0));
                                    });

                                    it('should revert when attempting to add liquidity with zero amount', async () => {
                                        const reserveAmount = BigNumber.from(0);
                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve,
                                                owner,
                                                recipient
                                            )
                                        ).to.be.revertedWith('ERR_ZERO_VALUE');
                                    });

                                    if (converterType === 1) {
                                        it('should revert when attempting to add liquidity to an unsupported pool', async () => {
                                            await initPool(isETHReserve, false, false);

                                            const reserveAmount = BigNumber.from(1000);
                                            await expect(
                                                addProtectedLiquidity(
                                                    poolToken.address,
                                                    baseToken,
                                                    baseTokenAddress,
                                                    reserveAmount,
                                                    isETHReserve,
                                                    owner,
                                                    recipient
                                                )
                                            ).to.be.revertedWith('ERR_POOL_NOT_SUPPORTED');
                                        });
                                    }

                                    it('should revert when attempting to add liquidity to a non whitelisted pool', async () => {
                                        await liquidityProtectionSettings.removePoolFromWhitelist(poolToken.address);

                                        const reserveAmount = BigNumber.from(1000);
                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve,
                                                owner,
                                                recipient
                                            )
                                        ).to.be.revertedWith('ERR_POOL_NOT_WHITELISTED');
                                    });

                                    it('should revert when attempting to add liquidity when add liquidity is disabled', async () => {
                                        await liquidityProtectionSettings.disableAddLiquidity(
                                            poolToken.address,
                                            baseTokenAddress,
                                            true
                                        );

                                        const reserveAmount = BigNumber.from(1000);
                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve,
                                                owner,
                                                recipient
                                            )
                                        ).to.be.revertedWith('ERR_ADD_LIQUIDITY_DISABLED');
                                    });

                                    it('should revert when attempting to add liquidity with the wrong ETH value', async () => {
                                        const reserveAmount = BigNumber.from(1000);
                                        let value = 0;
                                        if (!isETHReserve) {
                                            value = reserveAmount;
                                            await baseToken.approve(liquidityProtection.address, reserveAmount);
                                        }

                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                false,
                                                owner,
                                                recipient,
                                                value
                                            )
                                        ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
                                    });

                                    // eslint-disable-next-line max-len
                                    it('should revert when attempting to add liquidity when the pool has less liquidity than the minimum required', async () => {
                                        let reserveAmount = BigNumber.from(10000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );

                                        await liquidityProtectionSettings.setNetworkTokenMintingLimit(
                                            poolToken.address,
                                            500000
                                        );
                                        await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(
                                            100000000
                                        );
                                        reserveAmount = BigNumber.from(2000);

                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve,
                                                owner,
                                                recipient
                                            )
                                        ).to.be.revertedWith('ERR_NOT_ENOUGH_LIQUIDITY');
                                    });

                                    // eslint-disable-next-line max-len
                                    it('should revert when attempting to add liquidity which will increase the system network token balance above the pool limit', async () => {
                                        let reserveAmount = BigNumber.from(10000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );

                                        await liquidityProtectionSettings.setNetworkTokenMintingLimit(
                                            poolToken.address,
                                            500
                                        );
                                        reserveAmount = BigNumber.from(2000);

                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve,
                                                owner,
                                                recipient
                                            )
                                        ).to.be.revertedWith('ERR_MAX_AMOUNT_REACHED');
                                    });

                                    it('should revert when attempting to add liquidity while the average rate is invalid', async () => {
                                        const reserveAmount = BigNumber.from(1000);
                                        await increaseRate(baseTokenAddress);
                                        await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                                        await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve
                                            )
                                        ).to.be.revertedWith('ERR_INVALID_RATE');
                                    });
                                });
                            }

                            describe('network token', () => {
                                it('verifies that the caller can add liquidity', async () => {
                                    let reserveAmount = BigNumber.from(5000);

                                    await baseToken.transfer(accounts[1].address, 5000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        false,
                                        accounts[1],
                                        accounts[1]
                                    );
                                    const totalSupply = await poolToken.totalSupply();
                                    const reserveBalance = await converter.reserveBalance(networkToken.address);
                                    const rate = poolTokenRate(totalSupply, reserveBalance);

                                    const prevOwnerBalance = await networkToken.balanceOf(owner.address);
                                    const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                        poolToken.address
                                    );
                                    const prevWalletBalance = await poolToken.balanceOf(
                                        liquidityProtectionWallet.address
                                    );

                                    const prevPoolStats = await getPoolStats(poolToken, networkToken);
                                    const prevProviderStats = await getProviderStats(
                                        recipient,
                                        poolToken,
                                        networkToken
                                    );

                                    reserveAmount = BigNumber.from(1000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        networkToken,
                                        networkToken.address,
                                        reserveAmount,
                                        false,
                                        owner,
                                        recipient
                                    );

                                    // verify protection details
                                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                        recipient.address
                                    );
                                    expect(protectionIds.length).to.equal(1);

                                    const expectedPoolAmount = reserveAmount.mul(rate.d).div(rate.n);
                                    const reserve1Balance = await converter.reserveBalance(networkToken.address);
                                    const reserve2Balance = await converter.reserveBalance(baseTokenAddress);

                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                        protectionIds[0]
                                    );
                                    protection = getProtection(protection);
                                    expect(protection.provider).to.equal(recipient.address);
                                    expect(protection.poolToken).to.equal(poolToken.address);
                                    expect(protection.reserveToken).to.equal(networkToken.address);
                                    expect(protection.poolAmount).to.equal(expectedPoolAmount);
                                    expect(protection.reserveAmount).to.equal(reserveAmount);
                                    expect(protection.reserveRateN).to.equal(reserve2Balance);
                                    expect(protection.reserveRateD).to.equal(reserve1Balance);
                                    expect(protection.timestamp).to.equal(BigNumber.from(now));

                                    // verify stats
                                    const poolStats = await getPoolStats(poolToken, networkToken);
                                    expect(poolStats.totalPoolAmount).to.equal(
                                        prevPoolStats.totalPoolAmount.add(protection.poolAmount)
                                    );
                                    expect(poolStats.totalReserveAmount).to.equal(
                                        prevPoolStats.totalReserveAmount.add(protection.reserveAmount)
                                    );

                                    const providerStats = await getProviderStats(recipient, poolToken, networkToken);
                                    expect(providerStats.totalProviderAmount).to.equal(
                                        prevProviderStats.totalProviderAmount.add(protection.reserveAmount)
                                    );
                                    expect(providerStats.providerPools).to.equalTo([poolToken.address]);

                                    // verify balances
                                    const balance = await networkToken.balanceOf(owner.address);
                                    expect(balance).to.equal(prevOwnerBalance.sub(reserveAmount));

                                    const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                        poolToken.address
                                    );
                                    expect(systemBalance).to.equal(prevSystemBalance.sub(expectedPoolAmount));

                                    const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                                    expect(walletBalance).to.equal(prevWalletBalance);

                                    const govBalance = await govToken.balanceOf(recipient.address);
                                    expect(govBalance).to.equal(reserveAmount);

                                    const protectionPoolBalance = await poolToken.balanceOf(
                                        liquidityProtection.address
                                    );
                                    expect(protectionPoolBalance).to.equal(BigNumber.from(0));

                                    const protectionBaseBalance = await getBalance(
                                        baseToken,
                                        baseTokenAddress,
                                        liquidityProtection.address
                                    );
                                    expect(protectionBaseBalance).to.equal(BigNumber.from(0));

                                    const protectionNetworkBalance = await networkToken.balanceOf(
                                        liquidityProtection.address
                                    );
                                    expect(protectionNetworkBalance).to.equal(BigNumber.from(0));
                                });

                                it('should revert when attempting to add liquidity with zero amount', async () => {
                                    const reserveAmount = BigNumber.from(0);
                                    await expect(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            networkToken,
                                            networkToken.address,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient
                                        )
                                    ).to.be.revertedWith('ERR_ZERO_VALUE');
                                });

                                if (converterType === 1) {
                                    it('should revert when attempting to add liquidity to an unsupported pool', async () => {
                                        await initPool(false, false, false);

                                        const reserveAmount = BigNumber.from(1000);
                                        await expect(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                networkToken,
                                                networkToken.address,
                                                reserveAmount,
                                                false,
                                                owner,
                                                recipient
                                            )
                                        ).to.be.revertedWith('ERR_POOL_NOT_SUPPORTED');
                                    });
                                }

                                it('should revert when attempting to add liquidity to a non whitelisted pool', async () => {
                                    await liquidityProtectionSettings.removePoolFromWhitelist(poolToken.address);

                                    const reserveAmount = BigNumber.from(1000);
                                    await expect(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            networkToken,
                                            networkToken.address,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient
                                        )
                                    ).to.be.revertedWith('ERR_POOL_NOT_WHITELISTED');
                                });

                                it('should revert when attempting to add liquidity with non-zero ETH value', async () => {
                                    const reserveAmount = BigNumber.from(1000);

                                    await expect(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient,
                                            reserveAmount
                                        )
                                    ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
                                });

                                it('should revert when attempting to add more liquidity than the system currently owns', async () => {
                                    let reserveAmount = BigNumber.from(5000);
                                    await baseToken.transfer(accounts[1].address, 5000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        false,
                                        accounts[1]
                                    );

                                    reserveAmount = BigNumber.from(100000);

                                    await expect(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            networkToken,
                                            networkToken.address,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient
                                        )
                                    ).to.be.revertedWith('SafeMath: subtraction overflow');
                                });

                                it('should revert when attempting to add liquidity while the average rate is invalid', async () => {
                                    const reserveAmount = BigNumber.from(5000);
                                    await baseToken.transfer(accounts[1].address, 5000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        false,
                                        accounts[1]
                                    );

                                    await increaseRate(baseTokenAddress);
                                    await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                                    await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                    await expect(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            networkToken,
                                            networkToken.address,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient
                                        )
                                    ).to.be.revertedWith('ERR_INVALID_RATE');
                                });
                            });
                        });
                    }
                });

                describe('removeLiquidityReturn', () => {
                    it('verifies that removeLiquidityReturn returns the correct amount for removing entire protection', async () => {
                        const reserveAmount = BigNumber.from(1000);
                        await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                        const protectionId = protectionIds[0];

                        const amount = (
                            await liquidityProtection.removeLiquidityReturn(protectionId, PPM_RESOLUTION, now)
                        )[0];

                        expect(amount).to.equal(reserveAmount);
                    });

                    it('verifies that removeLiquidityReturn returns the correct amount for removing a portion of a protection', async () => {
                        const reserveAmount = BigNumber.from(1000);
                        await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                        const protectionId = protectionIds[0];

                        const amount = (await liquidityProtection.removeLiquidityReturn(protectionId, 800000, now))[0];

                        expect(amount).to.equal(BigNumber.from(800));
                    });

                    it('verifies that removeLiquidityReturn can be called even if the average rate is invalid', async () => {
                        const reserveAmount = BigNumber.from(1000);
                        await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                        const protectionId = protectionIds[0];

                        await increaseRate(baseTokenAddress);
                        await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                        await liquidityProtection.removeLiquidityReturn(protectionId, PPM_RESOLUTION, now);
                    });

                    it('should revert when calling removeLiquidityReturn with zero portion of the liquidity', async () => {
                        await expect(liquidityProtection.removeLiquidityReturn('1234', 0, now)).to.be.revertedWith(
                            'ERR_INVALID_PORTION'
                        );
                    });

                    it('should revert when calling removeLiquidityReturn with remove more than 100% of the liquidity', async () => {
                        await expect(
                            liquidityProtection.removeLiquidityReturn(
                                '1234',
                                PPM_RESOLUTION.add(BigNumber.from(1)),
                                now
                            )
                        ).to.be.revertedWith('ERR_INVALID_PORTION');
                    });

                    it('should revert when calling removeLiquidityReturn with a date earlier than the protection deposit', async () => {
                        const reserveAmount = BigNumber.from(1000);
                        await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                        const protectionId = protectionIds[0];

                        await expect(
                            liquidityProtection.removeLiquidityReturn(
                                protectionId,
                                PPM_RESOLUTION,
                                now.sub(duration.years(1))
                            )
                        ).to.be.revertedWith('ERR_INVALID_TIMESTAMP');
                    });

                    it('should revert when calling removeLiquidityReturn with invalid id', async () => {
                        await expect(
                            liquidityProtection.removeLiquidityReturn('1234', PPM_RESOLUTION, now)
                        ).to.be.revertedWith('ERR_INVALID_ID');
                    });
                });

                describe('remove liquidity', () => {
                    for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                        describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                            beforeEach(async () => {
                                await initPool(isETHReserve);
                            });

                            it('verifies that the caller can remove entire protection', async () => {
                                const reserveAmount = BigNumber.from(1000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );
                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                                const protectionId = protectionIds[0];
                                let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                                protection = getProtection(protection);

                                const prevPoolStats = await getPoolStats(poolToken, baseToken, isETHReserve);
                                const prevProviderStats = await getProviderStats(
                                    owner,
                                    poolToken,
                                    baseToken,
                                    isETHReserve
                                );

                                const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );

                                await govToken.approve(liquidityProtection.address, protection.reserveAmount);

                                await liquidityProtection.setTime(now.add(duration.seconds(1)));

                                const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                                const prevBalance = await getBalance(baseToken, baseTokenAddress, owner.address);
                                const prevGovBalance = await govToken.balanceOf(owner.address);

                                const res = await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                                expect(protectionIds.length).to.equal(0);

                                let transactionCost = BigNumber.from(0);
                                if (isETHReserve) {
                                    transactionCost = transactionCost.add(await getTransactionCost(res));
                                }

                                // verify stats
                                const poolStats = await getPoolStats(poolToken, baseToken, isETHReserve);
                                expect(poolStats.totalPoolAmount).to.equal(
                                    prevPoolStats.totalPoolAmount.sub(protection.poolAmount)
                                );
                                expect(poolStats.totalReserveAmount).to.equal(
                                    prevPoolStats.totalReserveAmount.sub(protection.reserveAmount)
                                );

                                const providerStats = await getProviderStats(owner, poolToken, baseToken, isETHReserve);
                                expect(providerStats.totalProviderAmount).to.equal(
                                    prevProviderStats.totalProviderAmount.sub(protection.reserveAmount)
                                );
                                expect(providerStats.providerPools).to.equalTo([poolToken.address]);

                                // verify balances
                                const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );
                                expect(systemBalance).to.equal(prevSystemBalance.sub(protection.poolAmount));

                                const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);

                                // double since system balance was also liquidated
                                const delta = protection.poolAmount.mul(BigNumber.from(2));
                                expect(walletBalance).to.equal(prevWalletBalance.sub(delta));

                                const balance = await getBalance(baseToken, baseTokenAddress, owner.address);
                                expect(balance).to.equal(prevBalance.add(reserveAmount).sub(transactionCost));

                                const govBalance = await govToken.balanceOf(owner.address);
                                expect(govBalance).to.equal(prevGovBalance);

                                const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                                expect(protectionPoolBalance).to.equal(BigNumber.from(0));

                                const protectionBaseBalance = await getBalance(
                                    baseToken,
                                    baseTokenAddress,
                                    liquidityProtection.address
                                );
                                expect(protectionBaseBalance).to.equal(BigNumber.from(0));

                                const protectionNetworkBalance = await networkToken.balanceOf(
                                    liquidityProtection.address
                                );
                                expect(protectionNetworkBalance).to.equal(BigNumber.from(0));
                            });

                            it('verifies that the caller can remove a portion of a protection', async () => {
                                const reserveAmount = BigNumber.from(1000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );
                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                                const protectionId = protectionIds[0];
                                let prevProtection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                                prevProtection = getProtection(prevProtection);

                                const prevPoolStats = await getPoolStats(poolToken, baseToken, isETHReserve);
                                const prevProviderStats = await getProviderStats(
                                    owner,
                                    poolToken,
                                    baseToken,
                                    isETHReserve
                                );
                                const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );

                                const portion = BigNumber.from(800000);

                                await govToken.approve(
                                    liquidityProtection.address,
                                    prevProtection.reserveAmount.mul(portion).div(PPM_RESOLUTION)
                                );

                                await liquidityProtection.setTime(now.add(duration.seconds(1)));

                                const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                                const prevBalance = await getBalance(baseToken, baseTokenAddress, owner.address);
                                const prevGovBalance = await govToken.balanceOf(owner.address);

                                const res = await liquidityProtection.removeLiquidity(protectionId, portion);
                                let transactionCost = BigNumber.from(0);
                                if (isETHReserve) {
                                    transactionCost = transactionCost.add(await getTransactionCost(res));
                                }

                                protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                                expect(protectionIds.length).to.equal(1);

                                let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                                protection = getProtection(protection);

                                expect(protection.poolAmount).to.equal(
                                    prevProtection.poolAmount.div(BigNumber.from(5))
                                );
                                expect(protection.reserveAmount).to.equal(
                                    prevProtection.reserveAmount.div(BigNumber.from(5))
                                );

                                // verify stats
                                const poolStats = await getPoolStats(poolToken, baseToken, isETHReserve);
                                expect(poolStats.totalPoolAmount).to.equal(
                                    prevPoolStats.totalPoolAmount.sub(
                                        prevProtection.poolAmount.sub(protection.poolAmount)
                                    )
                                );
                                expect(poolStats.totalReserveAmount).to.equal(
                                    prevPoolStats.totalReserveAmount.sub(
                                        prevProtection.reserveAmount.sub(protection.reserveAmount)
                                    )
                                );

                                const providerStats = await getProviderStats(owner, poolToken, baseToken, isETHReserve);
                                expect(providerStats.totalProviderAmount).to.equal(
                                    prevProviderStats.totalProviderAmount.sub(
                                        prevProtection.reserveAmount.sub(protection.reserveAmount)
                                    )
                                );
                                expect(providerStats.providerPools).to.equalTo([poolToken.address]);

                                // verify balances
                                const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );
                                expect(systemBalance).to.equal(
                                    prevSystemBalance.sub(prevProtection.poolAmount.sub(protection.poolAmount))
                                );

                                const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);

                                // double since system balance was also liquidated
                                const delta = prevProtection.poolAmount
                                    .sub(protection.poolAmount)
                                    .mul(BigNumber.from(2));
                                expect(walletBalance).to.equal(prevWalletBalance.sub(delta));

                                const balance = await getBalance(baseToken, baseTokenAddress, owner.address);
                                expect(balance).to.equal(prevBalance.add(BigNumber.from(800)).sub(transactionCost));

                                const govBalance = await govToken.balanceOf(owner.address);
                                expect(govBalance).to.equal(prevGovBalance);

                                const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                                expect(protectionPoolBalance).to.equal(BigNumber.from(0));

                                const protectionBaseBalance = await getBalance(
                                    baseToken,
                                    baseTokenAddress,
                                    liquidityProtection.address
                                );
                                expect(protectionBaseBalance).to.equal(BigNumber.from(0));

                                const protectionNetworkBalance = await networkToken.balanceOf(
                                    liquidityProtection.address
                                );
                                expect(protectionNetworkBalance).to.equal(BigNumber.from(0));
                            });

                            it('verifies that removing the entire protection updates the removal checkpoint', async () => {
                                const reserveAmount = BigNumber.from(100000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );

                                await setTime(now.add(duration.days(3)));

                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                expect(await checkpointStore.checkpoint(owner.address)).to.equal(BigNumber.from(0));

                                const portion = BigNumber.from(PPM_RESOLUTION);
                                await liquidityProtection.removeLiquidity(protectionId, portion);

                                expect(await checkpointStore.checkpoint(owner.address)).to.equal(now);
                            });

                            it('verifies that removing a portion of a protection updates the removal checkpoint', async () => {
                                const reserveAmount = BigNumber.from(100000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );

                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                expect(await checkpointStore.checkpoint(owner.address)).to.equal(BigNumber.from(0));

                                const portion = BigNumber.from(500000);
                                for (let i = 1; i < 5; i++) {
                                    await setTime(now.add(duration.days(3)));

                                    await liquidityProtection.removeLiquidity(protectionId, portion);

                                    expect(await checkpointStore.checkpoint(owner.address)).to.equal(now);
                                }
                            });

                            it('should revert when attempting to remove zero portion of the liquidity', async () => {
                                const reserveAmount = BigNumber.from(1000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );
                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                await expect(liquidityProtection.removeLiquidity(protectionId, 0)).to.be.revertedWith(
                                    'ERR_INVALID_PORTION'
                                );
                            });

                            it('should revert when attempting to remove more than 100% of the liquidity', async () => {
                                const reserveAmount = BigNumber.from(1000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );
                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                await expect(
                                    liquidityProtection.removeLiquidity(
                                        protectionId,
                                        PPM_RESOLUTION.add(BigNumber.from(1))
                                    )
                                ).to.be.revertedWith('ERR_INVALID_PORTION');
                            });

                            it('should revert when attempting to remove liquidity while the average rate is invalid', async () => {
                                const reserveAmount = BigNumber.from(1000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );
                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                await increaseRate(baseTokenAddress);
                                await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                                await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                await expect(
                                    liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION)
                                ).to.be.revertedWith('ERR_INVALID_RATE');
                            });

                            it('should revert when attempting to remove liquidity that does not exist', async () => {
                                await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                await expect(
                                    liquidityProtection.removeLiquidity('1234', PPM_RESOLUTION)
                                ).to.be.revertedWith('ERR_ACCESS_DENIED');
                            });

                            it('should revert when attempting to remove liquidity that belongs to another account', async () => {
                                const reserveAmount = BigNumber.from(5000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );

                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                await expect(
                                    liquidityProtection
                                        .connect(accounts[1])
                                        .removeLiquidity(protectionId, PPM_RESOLUTION)
                                ).to.be.revertedWith('ERR_ACCESS_DENIED');
                            });

                            it('should revert when attempting to remove liquidity from a non whitelisted pool', async () => {
                                const reserveAmount = BigNumber.from(5000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    isETHReserve
                                );

                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    owner.address
                                );
                                const protectionId = protectionIds[0];

                                await liquidityProtectionSettings.removePoolFromWhitelist(poolToken.address);

                                await liquidityProtection.setTime(now.add(duration.seconds(1)));
                                await expect(
                                    liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION)
                                ).to.be.revertedWith('ERR_POOL_NOT_WHITELISTED');
                            });
                        });
                    }

                    describe('network token', () => {
                        it('verifies that the caller can remove entire protection', async () => {
                            let reserveAmount = BigNumber.from(5000);
                            await baseToken.transfer(accounts[1].address, 5000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                false,
                                accounts[1]
                            );

                            reserveAmount = BigNumber.from(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                networkToken,
                                networkToken.address,
                                reserveAmount
                            );
                            let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            const protectionId = protectionIds[0];
                            let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                            protection = getProtection(protection);

                            const prevPoolStats = await getPoolStats(poolToken, networkToken);
                            const prevProviderStats = await getProviderStats(owner, poolToken, networkToken);
                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );
                            const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            const prevBalance = await getBalance(networkToken, networkToken.address, owner.address);
                            const prevGovBalance = await govToken.balanceOf(owner.address);

                            await govToken.approve(liquidityProtection.address, protection.reserveAmount);
                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                            protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            expect(protectionIds.length).to.equal(0);

                            // verify stats
                            const poolStats = await getPoolStats(poolToken, networkToken);
                            expect(poolStats.totalPoolAmount).to.equal(prevSystemBalance.add(protection.poolAmount));
                            expect(poolStats.totalReserveAmount).to.equal(
                                prevPoolStats.totalReserveAmount.sub(protection.reserveAmount)
                            );

                            const providerStats = await getProviderStats(owner, poolToken, networkToken);
                            expect(providerStats.totalProviderAmount).to.equal(
                                prevProviderStats.totalProviderAmount.sub(protection.reserveAmount)
                            );
                            expect(prevProviderStats.providerPools).to.equalTo([poolToken.address]);

                            // verify balances
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.equal(prevSystemBalance.add(protection.poolAmount));

                            const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            expect(walletBalance).to.equal(prevWalletBalance);

                            const balance = await getBalance(networkToken, networkToken.address, owner.address);
                            expectAlmostEqual(balance, prevBalance.add(reserveAmount));

                            const govBalance = await govToken.balanceOf(owner.address);
                            expect(govBalance).to.equal(prevGovBalance.sub(reserveAmount));

                            const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                            expect(protectionPoolBalance).to.equal(BigNumber.from(0));

                            const protectionBaseBalance = await getBalance(
                                baseToken,
                                baseTokenAddress,
                                liquidityProtection.address
                            );
                            expect(protectionBaseBalance).to.equal(BigNumber.from(0));

                            const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                            expect(protectionNetworkBalance).to.equal(BigNumber.from(0));
                        });

                        it('verifies that the caller can remove a portion of a protection', async () => {
                            let reserveAmount = BigNumber.from(5000);
                            await baseToken.transfer(accounts[1].address, 5000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                false,
                                accounts[1]
                            );

                            reserveAmount = BigNumber.from(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                networkToken,
                                networkToken.address,
                                reserveAmount
                            );
                            let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            const protectionId = protectionIds[0];
                            let prevProtection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                            prevProtection = getProtection(prevProtection);

                            const prevPoolStats = await getPoolStats(poolToken, networkToken);
                            const prevProviderStats = await getProviderStats(owner, poolToken, networkToken);
                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );
                            const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            const prevBalance = await getBalance(networkToken, networkToken.address, owner.address);
                            const prevGovBalance = await govToken.balanceOf(owner.address);

                            const portion = BigNumber.from(800000);
                            await govToken.approve(
                                liquidityProtection.address,
                                prevProtection.reserveAmount.mul(portion).div(PPM_RESOLUTION)
                            );
                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await liquidityProtection.removeLiquidity(protectionId, portion);
                            protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            expect(protectionIds.length).to.equal(1);

                            let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                            protection = getProtection(protection);

                            expect(protection.poolAmount).to.equal(prevProtection.poolAmount.div(BigNumber.from(5)));
                            expect(protection.reserveAmount).to.equal(
                                prevProtection.reserveAmount.div(BigNumber.from(5))
                            );

                            // verify stats
                            const poolStats = await getPoolStats(poolToken, networkToken);
                            expect(poolStats.totalPoolAmount).to.equal(
                                prevPoolStats.totalPoolAmount.sub(prevProtection.poolAmount.sub(protection.poolAmount))
                            );
                            expect(poolStats.totalReserveAmount).to.equal(
                                prevPoolStats.totalReserveAmount.sub(
                                    prevProtection.reserveAmount.sub(protection.reserveAmount)
                                )
                            );

                            const providerStats = await getProviderStats(owner, poolToken, networkToken);
                            expect(providerStats.totalProviderAmount).to.equal(
                                prevProviderStats.totalProviderAmount.sub(
                                    prevProtection.reserveAmount.sub(protection.reserveAmount)
                                )
                            );
                            expect(providerStats.providerPools).to.equalTo([poolToken.address]);

                            // verify balances
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.equal(
                                prevSystemBalance.add(prevProtection.poolAmount.sub(protection.poolAmount))
                            );

                            const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            expect(walletBalance).to.equal(prevWalletBalance);

                            const balance = await getBalance(networkToken, networkToken.address, owner.address);
                            expectAlmostEqual(balance, prevBalance.add(BigNumber.from(800)));

                            const govBalance = await govToken.balanceOf(owner.address);
                            expect(govBalance).to.equal(prevGovBalance.sub(BigNumber.from(800)));

                            const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                            expect(protectionPoolBalance).to.equal(BigNumber.from(0));

                            const protectionBaseBalance = await getBalance(
                                baseToken,
                                baseTokenAddress,
                                liquidityProtection.address
                            );
                            expect(protectionBaseBalance).to.equal(BigNumber.from(0));

                            const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                            expect(protectionNetworkBalance).to.equal(BigNumber.from(0));
                        });
                    });

                    const protectionText = {
                        [PROTECTION_NO_PROTECTION]: 'no protection',
                        [PROTECTION_PARTIAL_PROTECTION]: 'partial protection',
                        [PROTECTION_FULL_PROTECTION]: 'full protection',
                        [PROTECTION_EXCESSIVE_PROTECTION]: 'excessive protection'
                    };

                    const rateChangeText = {
                        0: 'no rate change',
                        1: 'price increase',
                        2: 'price decrease'
                    };

                    for (let reserve = 0; reserve < 2; reserve++) {
                        for (let rateChange = 0; rateChange < 3; rateChange++) {
                            for (const withFee of [true, false]) {
                                for (
                                    let protection = PROTECTION_NO_PROTECTION;
                                    protection <= PROTECTION_EXCESSIVE_PROTECTION;
                                    protection++
                                ) {
                                    context(
                                        `(${reserve === 0 ? 'base token' : 'network token'}) with ${
                                            protectionText[protection]
                                        } and ${rateChangeText[rateChange]} ${withFee ? 'with fee' : 'without fee'}`,
                                        () => {
                                            const reserveAmount = BigNumber.from(5000);
                                            let reserveToken1;
                                            let reserveToken2;
                                            let timestamp;

                                            beforeEach(async () => {
                                                await addProtectedLiquidity(
                                                    poolToken.address,
                                                    baseToken,
                                                    baseTokenAddress,
                                                    reserveAmount
                                                );

                                                if (reserve === 0) {
                                                    reserveToken1 = baseToken;
                                                    reserveToken2 = networkToken;
                                                } else {
                                                    reserveToken1 = networkToken;
                                                    reserveToken2 = baseToken;

                                                    // adding more liquidity so that the system has enough pool tokens
                                                    await addProtectedLiquidity(
                                                        poolToken.address,
                                                        baseToken,
                                                        baseTokenAddress,
                                                        BigNumber.from(20000)
                                                    );
                                                    await addProtectedLiquidity(
                                                        poolToken.address,
                                                        networkToken,
                                                        networkToken.address,
                                                        reserveAmount
                                                    );
                                                }

                                                if (withFee) {
                                                    await generateFee(reserveToken1, reserveToken2);
                                                }

                                                if (rateChange === 1) {
                                                    await increaseRate(reserveToken1.address);
                                                } else if (rateChange === 2) {
                                                    await increaseRate(reserveToken2.address);
                                                }

                                                timestamp = await getTimestamp(protection);
                                                await setTime(timestamp);
                                            });

                                            const isLoss =
                                                (protection === PROTECTION_NO_PROTECTION ||
                                                    protection === PROTECTION_PARTIAL_PROTECTION) &&
                                                rateChange !== 0;
                                            const shouldLock = reserve === 1 || rateChange === 1; // || (rateChange == 0 && withFee);

                                            if (isLoss) {
                                                // eslint-disable-next-line max-len
                                                it('verifies that removeLiquidityReturn returns an amount that is smaller than the initial amount', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];

                                                    const amount = (
                                                        await liquidityProtection.removeLiquidityReturn(
                                                            protectionId,
                                                            PPM_RESOLUTION,
                                                            timestamp
                                                        )
                                                    )[0];

                                                    expect(amount).to.be.lt(reserveAmount);
                                                });

                                                // eslint-disable-next-line max-len
                                                it('verifies that removeLiquidity returns an amount that is smaller than the initial amount', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];
                                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                                        protectionId
                                                    );
                                                    protection = getProtection(protection);

                                                    const prevBalance = await getBalance(
                                                        reserveToken1,
                                                        reserveToken1.address,
                                                        owner.address
                                                    );
                                                    await govToken.approve(
                                                        liquidityProtection.address,
                                                        protection.reserveAmount
                                                    );
                                                    await liquidityProtection.setTime(
                                                        timestamp.add(duration.seconds(1))
                                                    );
                                                    await liquidityProtection.removeLiquidity(
                                                        protectionId,
                                                        PPM_RESOLUTION
                                                    );
                                                    const balance = await getBalance(
                                                        reserveToken1,
                                                        reserveToken1.address,
                                                        owner.address
                                                    );

                                                    let lockedBalance = await getLockedBalance(owner.address);
                                                    if (reserveToken1.address === baseTokenAddress) {
                                                        const rate = await getRate(networkToken.address);
                                                        lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                    }

                                                    expect(balance.sub(prevBalance).add(lockedBalance)).to.be.lt(
                                                        reserveAmount
                                                    );
                                                });
                                            } else if (withFee) {
                                                // eslint-disable-next-line max-len
                                                it('verifies that removeLiquidityReturn returns an amount that is larger than the initial amount', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];

                                                    const amount = (
                                                        await liquidityProtection.removeLiquidityReturn(
                                                            protectionId,
                                                            PPM_RESOLUTION,
                                                            timestamp
                                                        )
                                                    )[0];

                                                    expect(amount).to.be.gt(reserveAmount);
                                                });

                                                // eslint-disable-next-line max-len
                                                it('verifies that removeLiquidity returns an amount that is larger than the initial amount', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];
                                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                                        protectionId
                                                    );
                                                    protection = getProtection(protection);

                                                    const prevBalance = await getBalance(
                                                        reserveToken1,
                                                        reserveToken1.address,
                                                        owner.address
                                                    );
                                                    await govToken.approve(
                                                        liquidityProtection.address,
                                                        protection.reserveAmount
                                                    );
                                                    await liquidityProtection.setTime(
                                                        timestamp.add(duration.seconds(1))
                                                    );
                                                    await liquidityProtection.removeLiquidity(
                                                        protectionId,
                                                        PPM_RESOLUTION
                                                    );
                                                    const balance = await getBalance(
                                                        reserveToken1,
                                                        reserveToken1.address,
                                                        owner.address
                                                    );

                                                    let lockedBalance = await getLockedBalance(owner.address);
                                                    if (reserveToken1.address === baseTokenAddress) {
                                                        const rate = await getRate(networkToken.address);
                                                        lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                    }

                                                    expect(balance.sub(prevBalance).add(lockedBalance)).to.be.gt(
                                                        reserveAmount
                                                    );
                                                });
                                            } else {
                                                // eslint-disable-next-line max-len
                                                it('verifies that removeLiquidityReturn returns an amount that is almost equal to the initial amount', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];

                                                    const amount = (
                                                        await liquidityProtection.removeLiquidityReturn(
                                                            protectionId,
                                                            PPM_RESOLUTION,
                                                            timestamp
                                                        )
                                                    )[0];

                                                    expectAlmostEqual(amount, reserveAmount);
                                                });

                                                // eslint-disable-next-line max-len
                                                it('verifies that removeLiquidity returns an amount that is almost equal to the initial amount', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];
                                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                                        protectionId
                                                    );
                                                    protection = getProtection(protection);

                                                    const prevBalance = await getBalance(
                                                        reserveToken1,
                                                        reserveToken1.address,
                                                        owner.address
                                                    );
                                                    await govToken.approve(
                                                        liquidityProtection.address,
                                                        protection.reserveAmount
                                                    );
                                                    await liquidityProtection.setTime(
                                                        timestamp.add(duration.seconds(1))
                                                    );
                                                    await liquidityProtection.removeLiquidity(
                                                        protectionId,
                                                        PPM_RESOLUTION
                                                    );
                                                    const balance = await getBalance(
                                                        reserveToken1,
                                                        reserveToken1.address,
                                                        owner.address
                                                    );

                                                    let lockedBalance = await getLockedBalance(owner.address);
                                                    if (reserveToken1.address === baseTokenAddress) {
                                                        const rate = await getRate(networkToken.address);
                                                        lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                    }

                                                    expectAlmostEqual(
                                                        balance.sub(prevBalance).add(lockedBalance),
                                                        reserveAmount
                                                    );
                                                });
                                            }

                                            if (shouldLock) {
                                                it('verifies that removeLiquidity locks network tokens for the caller', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];
                                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                                        protectionId
                                                    );
                                                    protection = getProtection(protection);

                                                    await govToken.approve(
                                                        liquidityProtection.address,
                                                        protection.reserveAmount
                                                    );
                                                    await liquidityProtection.setTime(
                                                        timestamp.add(duration.seconds(1))
                                                    );
                                                    await liquidityProtection.removeLiquidity(
                                                        protectionId,
                                                        PPM_RESOLUTION
                                                    );

                                                    const lockedBalanceCount =
                                                        await liquidityProtectionStore.lockedBalanceCount(
                                                            owner.address
                                                        );
                                                    expect(lockedBalanceCount).to.equal(BigNumber.from(1));

                                                    const lockedBalance = await getLockedBalance(owner.address);
                                                    expect(lockedBalance).to.be.gt(BigNumber.from(0));
                                                });
                                            } else {
                                                it('verifies that removeLiquidity does not lock network tokens for the caller', async () => {
                                                    const protectionIds =
                                                        await liquidityProtectionStore.protectedLiquidityIds(
                                                            owner.address
                                                        );
                                                    const protectionId = protectionIds[protectionIds.length - 1];
                                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                                        protectionId
                                                    );
                                                    protection = getProtection(protection);

                                                    await govToken.approve(
                                                        liquidityProtection.address,
                                                        protection.reserveAmount
                                                    );
                                                    await liquidityProtection.setTime(
                                                        timestamp.add(duration.seconds(1))
                                                    );
                                                    await liquidityProtection.removeLiquidity(
                                                        protectionId,
                                                        PPM_RESOLUTION
                                                    );

                                                    const lockedBalanceCount =
                                                        await liquidityProtectionStore.lockedBalanceCount(
                                                            owner.address
                                                        );
                                                    expect(lockedBalanceCount).to.equal(BigNumber.from(0));

                                                    const lockedBalance = await getLockedBalance(owner.address);
                                                    expect(lockedBalance).to.equal(BigNumber.from(0));
                                                });
                                            }
                                        }
                                    );
                                }
                            }
                        }
                    }
                });

                describe('claim balance', () => {
                    beforeEach(async () => {
                        await addProtectedLiquidity(
                            poolToken.address,
                            baseToken,
                            baseTokenAddress,
                            BigNumber.from(20000)
                        );
                        await addProtectedLiquidity(
                            poolToken.address,
                            networkToken,
                            networkToken.address,
                            BigNumber.from(2000)
                        );
                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                        const protectionId = protectionIds[protectionIds.length - 1];

                        const portion = PPM_RESOLUTION.div(BigNumber.from(2));
                        const amount = BigNumber.from(2000).mul(portion).div(PPM_RESOLUTION);
                        await govToken.approve(liquidityProtection.address, amount);
                        await liquidityProtection.setTime(now.add(duration.seconds(1)));
                        await liquidityProtection.removeLiquidity(protectionId, portion);
                        await govToken.approve(liquidityProtection.address, amount);
                        await liquidityProtection.removeLiquidity(protectionId, portion);
                    });

                    it('verifies that locked balance owner can claim locked tokens if sufficient time has passed', async () => {
                        const timestamp = await getTimestamp(PROTECTION_FULL_PROTECTION);
                        await setTime(timestamp);

                        const prevBalance = await networkToken.balanceOf(owner.address);
                        const lockedBalance = (await liquidityProtectionStore.lockedBalance(owner.address, 0))[0];
                        const prevTotalLockedBalance = await getLockedBalance(owner.address);

                        await liquidityProtection.claimBalance(0, 1);

                        const balance = await networkToken.balanceOf(owner.address);
                        expect(balance).to.equal(prevBalance.add(lockedBalance));

                        const totalLockedBalance = await getLockedBalance(owner.address);
                        expect(totalLockedBalance).to.equal(prevTotalLockedBalance.sub(lockedBalance));
                    });

                    it('verifies that locked balance owner can claim multiple locked tokens if sufficient time has passed', async () => {
                        const timestamp = await getTimestamp(PROTECTION_FULL_PROTECTION);
                        await setTime(timestamp);

                        const prevBalance = await networkToken.balanceOf(owner.address);
                        const prevTotalLockedBalance = await getLockedBalance(owner.address);

                        await liquidityProtection.claimBalance(0, 2);

                        const balance = await networkToken.balanceOf(owner.address);
                        expect(balance).to.equal(prevBalance.add(prevTotalLockedBalance));

                        const totalLockedBalance = await getLockedBalance(owner.address);
                        expect(totalLockedBalance).to.equal(BigNumber.from(0));

                        const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(owner.address);
                        expect(lockedBalanceCount).to.equal(BigNumber.from(0));
                    });

                    it('verifies that attempting to claim tokens that are still locked does not change any balance', async () => {
                        const prevBalance = await networkToken.balanceOf(owner.address);
                        const prevTotalLockedBalance = await getLockedBalance(owner.address);

                        await liquidityProtection.claimBalance(0, 2);

                        const balance = await networkToken.balanceOf(owner.address);
                        expect(balance).to.equal(prevBalance);

                        const totalLockedBalance = await getLockedBalance(owner.address);
                        expect(totalLockedBalance).to.equal(prevTotalLockedBalance);
                    });

                    it('should revert when locked balance owner attempts claim tokens with invalid indices', async () => {
                        await expect(liquidityProtection.claimBalance(2, 3)).to.be.revertedWith('ERR_INVALID_INDICES');
                    });
                });

                describe('transfer position', () => {
                    let recipient;
                    const testTransfer = (isBaseReserveToken, isETHReserve, recipientNb) => {
                        before(async () => {
                            newOwner = accounts[5];
                            recipient = accounts[recipientNb];
                        });
                        const verifyTransfer = async (transferFunc) => {
                            let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                            protection = getProtection(protection);

                            expect(await checkpointStore.checkpoint(recipient.address)).to.equal(BigNumber.from(0));
                            expect(await checkpointStore.checkpoint(newOwner.address)).to.equal(BigNumber.from(0));

                            const prevPoolStats = await getPoolStats(poolToken, reserveToken, isETHReserve);
                            const prevRecipientStats = await getProviderStats(
                                recipient,
                                poolToken,
                                reserveToken,
                                isETHReserve
                            );
                            const prevNewOwnerStats = await getProviderStats(
                                newOwner,
                                poolToken,
                                reserveToken,
                                isETHReserve
                            );
                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );

                            await transferFunc();

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                recipient.address
                            );
                            expect(protectionIds).not.to.have.members([protectionId]);

                            const protectionIds2 = await liquidityProtectionStore.protectedLiquidityIds(
                                newOwner.address
                            );
                            expect(protectionIds2.length).to.equal(1);

                            let protection2 = await liquidityProtectionStore.protectedLiquidity(protectionIds2[0]);
                            protection2 = getProtection(protection2);
                            expect(protection2.provider).to.equal(newOwner.address);
                            expect(protection.poolToken).to.equal(protection2.poolToken);
                            expect(protection.reserveToken).to.equal(protection2.reserveToken);
                            expect(protection.poolAmount).to.equal(protection2.poolAmount);
                            expect(protection.reserveAmount).to.equal(protection2.reserveAmount);
                            expect(protection.reserveRateN).to.equal(protection2.reserveRateN);
                            expect(protection.reserveRateD).to.equal(protection2.reserveRateD);
                            expect(protection.timestamp).to.equal(protection2.timestamp);

                            // verify system balance
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.equal(prevSystemBalance);

                            // verify stats
                            const poolStats = await getPoolStats(poolToken, reserveToken, isETHReserve);
                            expect(poolStats.totalPoolAmount).to.equal(prevPoolStats.totalPoolAmount);
                            expect(poolStats.totalReserveAmount).to.equal(prevPoolStats.totalReserveAmount);

                            const recipientStats = await getProviderStats(
                                recipient,
                                poolToken,
                                reserveToken,
                                isETHReserve
                            );
                            expect(recipientStats.totalProviderAmount).to.equal(
                                prevRecipientStats.totalProviderAmount.sub(protection.reserveAmount)
                            );
                            expect(recipientStats.providerPools).to.equalTo([protection.poolToken]);

                            const newOwnerStats = await getProviderStats(
                                newOwner,
                                poolToken,
                                reserveToken,
                                isETHReserve
                            );
                            expect(newOwnerStats.totalProviderAmount).to.equal(
                                prevNewOwnerStats.totalProviderAmount.add(protection2.reserveAmount)
                            );
                            expect(newOwnerStats.providerPools).to.equalTo([protection2.poolToken]);

                            // verify removal checkpoints
                            expect(await checkpointStore.checkpoint(recipient.address)).to.equal(now);
                            expect(await checkpointStore.checkpoint(newOwner.address)).to.equal(BigNumber.from(0));
                        };

                        let protectionId;
                        let newOwner;
                        const reserveAmount = BigNumber.from(5000);
                        let reserveToken;
                        let reserveTokenAddress;

                        beforeEach(async () => {
                            await initPool(isETHReserve);

                            if (isBaseReserveToken) {
                                reserveToken = baseToken;
                                reserveTokenAddress = isETHReserve ? NATIVE_TOKEN_ADDRESS : reserveToken.address;

                                await addProtectedLiquidity(
                                    poolToken.address,
                                    reserveToken,
                                    reserveTokenAddress,
                                    reserveAmount,
                                    isETHReserve,
                                    owner,
                                    recipient
                                );
                            } else {
                                reserveToken = networkToken;
                                reserveTokenAddress = networkToken.address;

                                await baseToken.transfer(accounts[1].address, reserveAmount);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    false,
                                    accounts[1],
                                    accounts[1]
                                );

                                await addProtectedLiquidity(
                                    poolToken.address,
                                    reserveToken,
                                    reserveTokenAddress,
                                    reserveAmount,
                                    false,
                                    owner,
                                    recipient
                                );
                            }

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                recipient.address
                            );
                            expect(protectionIds.length).to.equal(1);

                            protectionId = protectionIds[0];

                            await setTime(now.add(duration.days(3)));
                        });

                        it('should allow the provider to transfer position to another provider', async () => {
                            await verifyTransfer(async () =>
                                liquidityProtection.connect(recipient).transferPosition(protectionId, newOwner.address)
                            );
                        });

                        it('should revert when attempting to transfer position that belongs to another account', async () => {
                            const nonOwner = accounts[8];
                            await expect(
                                liquidityProtection.connect(nonOwner).transferPosition(protectionId, newOwner.address)
                            ).to.be.revertedWith('ERR_ACCESS_DENIED');
                        });

                        describe('notification', () => {
                            let callback;

                            beforeEach(async () => {
                                callback = await Contracts.TestTransferPositionCallback.deploy();
                            });

                            it('should revert when called with an invalid callback', async () => {
                                await expect(
                                    liquidityProtection
                                        .connect(recipient)
                                        .transferPositionAndNotify(protectionId, newOwner.address, ZERO_ADDRESS, [])
                                ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                            });

                            it('should notify on transfer', async () => {
                                const transferEvent = await callback.transferEvent();
                                expect(transferEvent[0]).to.equal(BigNumber.from(0));
                                expect(transferEvent[1]).to.equal(ZERO_ADDRESS);
                                expect(transferEvent[2]).to.equal('0x');

                                const data = '0x1234';

                                await verifyTransfer(async () =>
                                    liquidityProtection
                                        .connect(recipient)
                                        .transferPositionAndNotify(
                                            protectionId,
                                            newOwner.address,
                                            callback.address,
                                            data
                                        )
                                );

                                const protectionIds2 = await liquidityProtectionStore.protectedLiquidityIds(
                                    newOwner.address
                                );
                                expect(protectionIds2.length).to.equal(1);

                                const transferEvent2 = await callback.transferEvent();
                                expect(transferEvent2[0]).to.equal(protectionIds2[0]);
                                expect(transferEvent2[1]).to.equal(recipient.address);
                                expect(transferEvent2[2]).to.equal(data);
                            });
                        });
                    };

                    it('should revert when attempting to transfer position to a zero address', async () => {
                        await expect(
                            liquidityProtection.transferPosition(BigNumber.from(0), ZERO_ADDRESS)
                        ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                    });

                    it('should revert when attempting to transfer position that does not exist', async () => {
                        await expect(
                            liquidityProtection.transferPosition(BigNumber.from(1234), accounts[3].address)
                        ).to.be.revertedWith('ERR_ACCESS_DENIED');
                    });

                    // test both addLiquidity and addLiquidityFor
                    const testAccounts = [0, 3];

                    for (const testAccount of testAccounts) {
                        context(testAccount === 0 ? 'for self' : 'for another account', async () => {
                            for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                                describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                    testTransfer(true, isETHReserve, testAccount);
                                });
                            }

                            describe('network token', () => {
                                testTransfer(false, false, testAccount);
                            });
                        });
                    }
                });

                describe('notifications', () => {
                    let eventsSubscriber;

                    beforeEach(async () => {
                        eventsSubscriber = await Contracts.TestLiquidityProvisionEventsSubscriber.deploy();
                    });

                    const getEvents = async () => {
                        const data = [];

                        const count = (await eventsSubscriber.eventCount()).toNumber();
                        for (let i = 0; i < count; ++i) {
                            const event = await eventsSubscriber.events(i);
                            data.push({
                                id: event[0],
                                provider: event[1],
                                poolAnchor: event[2],
                                reserveToken: event[3],
                                poolAmount: event[4],
                                reserveAmount: event[5],
                                adding: event[6]
                            });
                        }

                        return data;
                    };

                    const testNotifications = (isBaseReserveToken, isETHReserve, recipientNb) => {
                        const reserveAmount = BigNumber.from(5000);
                        let reserveToken;
                        let reserveTokenAddress;
                        let id;
                        let protection;
                        let recipient;

                        const init = async () => {
                            await initPool(isETHReserve);

                            if (isBaseReserveToken) {
                                reserveToken = baseToken;
                                reserveTokenAddress = isETHReserve ? NATIVE_TOKEN_ADDRESS : reserveToken.address;

                                await addProtectedLiquidity(
                                    poolToken.address,
                                    reserveToken,
                                    reserveTokenAddress,
                                    reserveAmount,
                                    isETHReserve,
                                    owner,
                                    recipient
                                );
                            } else {
                                reserveToken = networkToken;
                                reserveTokenAddress = networkToken.address;

                                await baseToken.transfer(accounts[1].address, reserveAmount);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    false,
                                    accounts[1],
                                    accounts[1]
                                );

                                await eventsSubscriber.reset();

                                await addProtectedLiquidity(
                                    poolToken.address,
                                    reserveToken,
                                    reserveTokenAddress,
                                    reserveAmount,
                                    false,
                                    owner,
                                    recipient
                                );
                            }

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                recipient.address
                            );
                            id = protectionIds[0];
                            protection = await liquidityProtectionStore.protectedLiquidity(id);
                            protection = getProtection(protection);
                        };

                        context('without an events notifier', () => {
                            before(async () => {
                                recipient = accounts[recipientNb];
                            });
                            beforeEach(async () => {
                                await init();
                            });

                            describe('adding liquidity', () => {
                                it('should not publish events', async () => {
                                    const events = await getEvents();
                                    expect(events).to.have.lengthOf(0);
                                });
                            });

                            describe('removing liquidity', () => {
                                beforeEach(async () => {
                                    await setTime(now.add(BigNumber.from(1)));

                                    if (!isBaseReserveToken) {
                                        await govToken
                                            .connect(recipient)
                                            .approve(liquidityProtection.address, protection.reserveAmount);
                                    }
                                });

                                it('should not publish events', async () => {
                                    await liquidityProtection.connect(recipient).removeLiquidity(id, PPM_RESOLUTION);

                                    const events = await getEvents();
                                    expect(events).to.have.lengthOf(0);
                                });
                            });

                            describe('transferring liquidity', () => {
                                beforeEach(async () => {
                                    await setTime(now.add(BigNumber.from(1)));
                                });

                                it('should not publish events', async () => {
                                    const newOwner = accounts[8];
                                    await liquidityProtection.connect(recipient).transferPosition(id, newOwner.address);

                                    const events = await getEvents();
                                    expect(events).to.have.lengthOf(0);
                                });
                            });
                        });

                        context('with an events notifier', () => {
                            before(async () => {
                                recipient = accounts[recipientNb];
                            });

                            beforeEach(async () => {
                                await liquidityProtectionSettings
                                    .connect(owner)
                                    .addSubscriber(eventsSubscriber.address);

                                await init();
                            });

                            describe('adding liquidity', () => {
                                it('should publish events', async () => {
                                    const totalSupply = await poolToken.totalSupply();
                                    const reserveBalance = await converter.reserveBalance(reserveTokenAddress);
                                    const rate = poolTokenRate(totalSupply, reserveBalance);

                                    const events = await getEvents();
                                    expect(events).to.have.lengthOf(1);

                                    const event = events[0];
                                    expect(event.adding).to.be.true;
                                    expect(event.id).to.equal(BigNumber.from(0));
                                    expect(event.provider).to.equal(recipient.address);
                                    expect(event.poolAnchor).to.equal(poolToken.address);
                                    expect(event.reserveToken).to.equal(reserveTokenAddress);
                                    expect(event.poolAmount).to.equal(reserveAmount.mul(rate.d).div(rate.n));
                                    expect(event.reserveAmount).to.equal(reserveAmount);
                                });
                            });

                            describe('removing liquidity', () => {
                                beforeEach(async () => {
                                    await eventsSubscriber.reset();

                                    await setTime(now.add(BigNumber.from(1)));

                                    if (!isBaseReserveToken) {
                                        await govToken
                                            .connect(recipient)
                                            .approve(liquidityProtection.address, protection.reserveAmount);
                                    }
                                });

                                it('should publish events', async () => {
                                    const totalSupply = await poolToken.totalSupply();
                                    const reserveBalance = await converter.reserveBalance(reserveTokenAddress);
                                    const rate = poolTokenRate(totalSupply, reserveBalance);

                                    await liquidityProtection.connect(recipient).removeLiquidity(id, PPM_RESOLUTION);

                                    const events = await getEvents();
                                    expect(events).to.have.lengthOf(1);

                                    const event = events[0];
                                    expect(event.adding).to.be.false;
                                    expect(event.id).to.equal(id);
                                    expect(event.provider).to.equal(recipient.address);
                                    expect(event.poolAnchor).to.equal(poolToken.address);
                                    expect(event.reserveToken).to.equal(reserveTokenAddress);
                                    expect(event.poolAmount).to.equal(reserveAmount.mul(rate.d).div(rate.n));
                                    expect(event.reserveAmount).to.equal(reserveAmount);
                                });
                            });

                            describe('transferring liquidity', () => {
                                beforeEach(async () => {
                                    await eventsSubscriber.reset();

                                    await setTime(now.add(BigNumber.from(1)));
                                });

                                it('should publish events', async () => {
                                    const totalSupply = await poolToken.totalSupply();
                                    const reserveBalance = await converter.reserveBalance(reserveTokenAddress);
                                    const rate = poolTokenRate(totalSupply, reserveBalance);

                                    const newOwner = accounts[8];
                                    await liquidityProtection.connect(recipient).transferPosition(id, newOwner.address);

                                    const events = await getEvents();
                                    expect(events).to.have.lengthOf(2);

                                    const removeEvent = events[0];
                                    expect(removeEvent.adding).to.be.false;
                                    expect(removeEvent.id).to.equal(id);
                                    expect(removeEvent.provider).to.equal(recipient.address);
                                    expect(removeEvent.poolAnchor).to.equal(poolToken.address);
                                    expect(removeEvent.reserveToken).to.equal(reserveTokenAddress);
                                    expect(removeEvent.poolAmount).to.equal(reserveAmount.mul(rate.d).div(rate.n));
                                    expect(removeEvent.reserveAmount).to.equal(reserveAmount);

                                    const addEvent = events[1];
                                    expect(addEvent.adding).to.be.true;
                                    expect(addEvent.id).to.equal(BigNumber.from(0));
                                    expect(addEvent.provider).to.equal(newOwner.address);
                                    expect(addEvent.poolAnchor).to.equal(poolToken.address);
                                    expect(addEvent.reserveToken).to.equal(reserveTokenAddress);
                                    expect(addEvent.poolAmount).to.equal(reserveAmount.mul(rate.d).div(rate.n));
                                    expect(addEvent.reserveAmount).to.equal(reserveAmount);
                                });
                            });
                        });
                    };

                    const accountsTmp = [0, 3];

                    // test both addLiquidity and addLiquidityFor
                    for (const accountTmp of accountsTmp) {
                        context(accountTmp === 0 ? 'for self' : 'for another account', async () => {
                            for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                                describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                    testNotifications(true, isETHReserve, accountTmp);
                                });
                            }

                            describe('network token', () => {
                                testNotifications(false, false, accountTmp);
                            });
                        });
                    }
                });
            });

            describe('stress tests', () => {
                describe('average rate', () => {
                    beforeEach(async () => {
                        await initLiquidityProtection();
                    });

                    for (let minutesElapsed = 1; minutesElapsed <= 10; minutesElapsed += 2) {
                        for (let convertPortion = 1; convertPortion <= 10; convertPortion += 2) {
                            for (let maxDeviation = 1; maxDeviation <= 10; maxDeviation += 2) {
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
                                                expect(reserveTokenRate[0]).to.equal(averageRate[0]);
                                                expect(reserveTokenRate[1]).to.equal(averageRate[1]);
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
                    before(async () => {
                        await initLiquidityProtection();
                    });

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
                                                                    const testDesc = JSON.stringify({
                                                                        poolTokenRateN: poolTokenRateN.toString(),
                                                                        poolTokenRateD: poolTokenRateD.toString(),
                                                                        poolAmount: poolAmount.toString(),
                                                                        reserveAmount: reserveAmount.toString(),
                                                                        addSpotRateN: addSpotRateN.toString(),
                                                                        addSpotRateD: addSpotRateD.toString(),
                                                                        removeSpotRateN: removeSpotRateN.toString(),
                                                                        removeSpotRateD: removeSpotRateD.toString(),
                                                                        removeAverageRateN:
                                                                            removeAverageRateN.toString(),
                                                                        removeAverageRateD:
                                                                            removeAverageRateD.toString(),
                                                                        timeElapsed
                                                                    })
                                                                        .split('"')
                                                                        .join('')
                                                                        .slice(1, -1);
                                                                    it(`test ${++testNum} out of ${numOfTest}: ${testDesc}`, async () => {
                                                                        // eslint-disable-next-line max-len
                                                                        const actual =
                                                                            await liquidityProtection.callStatic.removeLiquidityTargetAmountTest(
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
                                                    // eslint-disable-next-line max-len
                                                    const testDesc = `compensationAmount(${poolAmount}, ${poolRateN}/${poolRateD}, ${addRateN}/${addRateD}, ${removeRateN}/${removeRateD})`;
                                                    it(`test ${++testNum} out of ${numOfTest}: ${testDesc}`, async () => {
                                                        const expected = protectedAmountPlusFee(
                                                            poolAmount,
                                                            poolRateN,
                                                            poolRateD,
                                                            addRateN,
                                                            addRateD,
                                                            removeRateN,
                                                            removeRateD
                                                        );
                                                        const actual =
                                                            await liquidityProtection.protectedAmountPlusFeeTest(
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
                                        const testDesc = `impLoss(${initialRateN}/${initialRateD}, ${currentRateN}/${currentRateD})`;
                                        it(`test ${++testNum} out of ${numOfTest}: ${testDesc}`, async () => {
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
                                                const testDesc = `compensationAmount(${amount}, ${total}, ${lossN}/${lossD}, ${levelN}/${levelD})`;
                                                it(`test ${++testNum} out of ${numOfTest}: ${testDesc}`, async () => {
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

                    const protectedAmountPlusFee = (...args) => {
                        const [poolAmount, poolRateN, poolRateD, addRateN, addRateD, removeRateN, removeRateD] =
                            args.map((x) => Decimal(x.toString()));

                        return removeRateN
                            .div(removeRateD)
                            .mul(addRateD)
                            .div(addRateN)
                            .sqrt()
                            .mul(poolRateN)
                            .div(poolRateD)
                            .mul(poolAmount);
                    };

                    const impLoss = (...args) => {
                        const [initialRateN, initialRateD, currentRateN, currentRateD] = args.map((x) =>
                            Decimal(x.toString())
                        );
                        const ratioN = currentRateN.mul(initialRateD);
                        const ratioD = currentRateD.mul(initialRateN);
                        const ratio = ratioN.div(ratioD);
                        return ratio.sqrt().mul(2).div(ratio.add(1)).sub(1).neg();
                    };

                    const compensationAmount = (...args) => {
                        const [amount, total, lossN, lossD, levelN, levelD] = args.map((x) => Decimal(x.toString()));

                        return total
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
                            ).to.equal(
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
                    beforeEach(async () => {
                        await initLiquidityProtection();
                    });

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
                                    const amount = BigNumber.min(amounts[3], await getNetworkTokenMaxAmount());
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
                                    const amount = BigNumber.min(amounts[3], await getNetworkTokenMaxAmount());
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
