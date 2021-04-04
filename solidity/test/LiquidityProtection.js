const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, BN, constants, time, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { NATIVE_TOKEN_ADDRESS, registry, roles } = require('./helpers/Constants');
const Decimal = require('decimal.js');

const { ZERO_ADDRESS } = constants;
const { duration, latest } = time;
const { ROLE_OWNER, ROLE_GOVERNOR, ROLE_MINTER } = roles;

const ContractRegistry = contract.fromArtifact('ContractRegistry');
const BancorFormula = contract.fromArtifact('BancorFormula');
const BancorNetwork = contract.fromArtifact('BancorNetwork');
const DSToken = contract.fromArtifact('DSToken');
const ConverterRegistry = contract.fromArtifact('TestConverterRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('TestLiquidityPoolV1ConverterFactory');
const LiquidityPoolV1Converter = contract.fromArtifact('TestLiquidityPoolV1Converter');
const StandardPoolConverterFactory = contract.fromArtifact('TestStandardPoolConverterFactory');
const StandardPoolConverter = contract.fromArtifact('TestStandardPoolConverter');
const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionStore = contract.fromArtifact('LiquidityProtectionStore');
const LiquidityProtectionStats = contract.fromArtifact('LiquidityProtectionStats');
const LiquidityProtectionSystemStore = contract.fromArtifact('LiquidityProtectionSystemStore');
const TokenHolder = contract.fromArtifact('TokenHolder');
const LiquidityProtectionEventsSubscriber = contract.fromArtifact('TestLiquidityProtectionEventsSubscriber');
const TokenGovernance = contract.fromArtifact('TestTokenGovernance');
const CheckpointStore = contract.fromArtifact('TestCheckpointStore');
const LiquidityProtection = contract.fromArtifact('TestLiquidityProtection');
const NetworkSettings = contract.fromArtifact('NetworkSettings');

const PPM_RESOLUTION = new BN(1000000);

const RESERVE1_AMOUNT = new BN(1000000);
const RESERVE2_AMOUNT = new BN(2500000);
const TOTAL_SUPPLY = new BN(10).pow(new BN(24));

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

describe('LiquidityProtection', () => {
    for (const converterType of [1, 3]) {
        describe(`${converterType === 1 ? 'LiquidityPoolV1Converter' : 'StandardPoolConverter'}`, () => {
            const initPool = async (isETH = false, whitelist = true, standard = true) => {
                if (isETH) {
                    baseTokenAddress = NATIVE_TOKEN_ADDRESS;
                } else {
                    // create a pool with ERC20 as the base token
                    baseToken = await DSToken.new('RSV1', 'RSV1', 18);
                    await baseToken.issue(owner, TOTAL_SUPPLY);
                    baseTokenAddress = baseToken.address;
                }

                let weights = [500000, 500000];
                if (converterType === 1 && !standard) {
                    weights = [450000, 550000];
                }

                await converterRegistry.newConverter(
                    converterType,
                    'PT',
                    'PT',
                    18,
                    PPM_RESOLUTION,
                    [baseTokenAddress, networkToken.address],
                    weights
                );
                const anchorCount = await converterRegistry.getAnchorCount.call();
                const poolTokenAddress = await converterRegistry.getAnchor.call(anchorCount - 1);
                poolToken = await DSToken.at(poolTokenAddress);
                const converterAddress = await poolToken.owner.call();
                if (converterType === 1) {
                    converter = await LiquidityPoolV1Converter.at(converterAddress);
                } else {
                    converter = await StandardPoolConverter.at(converterAddress);
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
                        value
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
                    await token.approve(liquidityProtection.address, amount, { from });
                }

                if (recipient) {
                    return liquidityProtection.addLiquidityFor(recipient, poolTokenAddress, tokenAddress, amount, {
                        from,
                        value
                    });
                }

                return liquidityProtection.addLiquidity(poolTokenAddress, tokenAddress, amount, { from, value });
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
                return { n: reserveBalance.mul(new BN('2')), d: poolSupply };
            };

            const getBalance = async (token, address, account) => {
                if (address === NATIVE_TOKEN_ADDRESS) {
                    return balance.current(account);
                }

                return token.balanceOf.call(account);
            };

            const getTransactionCost = async (txResult) => {
                const transaction = await web3.eth.getTransaction(txResult.tx);
                return new BN(transaction.gasPrice).mul(new BN(txResult.receipt.cumulativeGasUsed));
            };

            const expectAlmostEqual = (amount1, amount2, maxError = '0.01') => {
                if (!amount1.eq(amount2)) {
                    const error = Decimal(amount1.toString()).div(amount2.toString()).sub(1).abs();
                    expect(error.lte(maxError)).to.be.true(`error = ${error.toFixed(maxError.length)}`);
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

            const generateFee = async () => {
                await converter.setConversionFee(10000);

                // convert back & forth
                const prevBalance = await networkToken.balanceOf(owner);

                let amount = RESERVE1_AMOUNT.div(new BN(2));
                await convert([baseTokenAddress, poolToken.address, networkToken.address], amount, 1);

                const balance = await networkToken.balanceOf(owner);

                amount = balance.sub(prevBalance);
                await convert([networkToken.address, poolToken.address, baseTokenAddress], amount, 1);

                await converter.setConversionFee(0);
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
                amount = new BN(amount.floor().toFixed());

                await convert(path, amount, 1);
            };

            const getLockedBalance = async (account) => {
                let lockedBalance = new BN(0);
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

            const owner = defaultSender;
            const governor = accounts[1];

            before(async () => {
                contractRegistry = await ContractRegistry.new();
                converterRegistry = await ConverterRegistry.new(contractRegistry.address);
                converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);
                bancorNetwork = await BancorNetwork.new(contractRegistry.address);

                const liquidityPoolV1ConverterFactory = await LiquidityPoolV1ConverterFactory.new();
                const standardPoolConverterFactory = await StandardPoolConverterFactory.new();
                const converterFactory = await ConverterFactory.new();
                await converterFactory.registerTypedConverterFactory(liquidityPoolV1ConverterFactory.address);
                await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);
        
                const bancorFormula = await BancorFormula.new();
                await bancorFormula.init();

                const networkSettings = await NetworkSettings.new(defaultSender, 0);

                await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
                await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
                await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);
                await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);

                await converterRegistry.enableTypeChanging(false);
            });

            beforeEach(async () => {
                networkToken = await DSToken.new('BNT', 'BNT', 18);
                await networkToken.issue(owner, TOTAL_SUPPLY);
                networkTokenGovernance = await TokenGovernance.new(networkToken.address);
                await networkTokenGovernance.grantRole(ROLE_GOVERNOR, governor);
                await networkToken.transferOwnership(networkTokenGovernance.address);
                await networkTokenGovernance.acceptTokenOwnership();

                govToken = await DSToken.new('vBNT', 'vBNT', 18);
                govTokenGovernance = await TokenGovernance.new(govToken.address);
                await govTokenGovernance.grantRole(ROLE_GOVERNOR, governor);
                await govToken.transferOwnership(govTokenGovernance.address);
                await govTokenGovernance.acceptTokenOwnership();

                // initialize liquidity protection
                checkpointStore = await CheckpointStore.new({ from: owner });
                liquidityProtectionSettings = await LiquidityProtectionSettings.new(
                    networkToken.address,
                    contractRegistry.address
                );
                await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(new BN(100));
                await liquidityProtectionSettings.setMinNetworkCompensation(new BN(3));

                liquidityProtectionStore = await LiquidityProtectionStore.new();
                liquidityProtectionStats = await LiquidityProtectionStats.new();
                liquidityProtectionSystemStore = await LiquidityProtectionSystemStore.new();
                liquidityProtectionWallet = await TokenHolder.new();
                liquidityProtection = await LiquidityProtection.new(
                    liquidityProtectionSettings.address,
                    liquidityProtectionStore.address,
                    liquidityProtectionStats.address,
                    liquidityProtectionSystemStore.address,
                    liquidityProtectionWallet.address,
                    networkTokenGovernance.address,
                    govTokenGovernance.address,
                    checkpointStore.address
                );

                await liquidityProtectionSettings.grantRole(ROLE_OWNER, liquidityProtection.address, { from: owner });
                await liquidityProtectionStats.grantRole(ROLE_OWNER, liquidityProtection.address, { from: owner });
                await liquidityProtectionSystemStore.grantRole(ROLE_OWNER, liquidityProtection.address, {
                    from: owner
                });
                await checkpointStore.grantRole(ROLE_OWNER, liquidityProtection.address, { from: owner });
                await liquidityProtectionStore.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptStoreOwnership();
                await liquidityProtectionWallet.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptWalletOwnership();
                await networkTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address, { from: governor });
                await govTokenGovernance.grantRole(ROLE_MINTER, liquidityProtection.address, { from: governor });

                await setTime(await latest());

                // initialize pool
                await initPool();
            });

            it('verifies the liquidity protection contract after initialization', async () => {
                const settings = await liquidityProtection.settings.call();
                expect(settings).to.eql(liquidityProtectionSettings.address);

                const store = await liquidityProtection.store.call();
                expect(store).to.eql(liquidityProtectionStore.address);

                const stats = await liquidityProtection.stats.call();
                expect(stats).to.eql(liquidityProtectionStats.address);

                const systemStore = await liquidityProtection.systemStore.call();
                expect(systemStore).to.eql(liquidityProtectionSystemStore.address);

                const wallet = await liquidityProtection.wallet.call();
                expect(wallet).to.eql(liquidityProtectionWallet.address);
            });

            it('verifies that the owner can transfer the store ownership', async () => {
                await liquidityProtection.transferStoreOwnership(accounts[1]);
                liquidityProtectionStore.acceptOwnership({ from: accounts[1] });
            });

            it('should revert when a non owner attempts to transfer the store ownership', async () => {
                await expectRevert(
                    liquidityProtection.transferStoreOwnership(accounts[2], {
                        from: accounts[1]
                    }),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('verifies that the owner can transfer the wallet ownership', async () => {
                await liquidityProtection.transferWalletOwnership(accounts[1]);
                liquidityProtectionWallet.acceptOwnership({ from: accounts[1] });
            });

            it('should revert when a non owner attempts to transfer the wallet ownership', async () => {
                await expectRevert(
                    liquidityProtection.transferWalletOwnership(accounts[2], {
                        from: accounts[1]
                    }),
                    'ERR_ACCESS_DENIED'
                );
            });

            it('should revert when the caller attempts to add and remove base tokens on the same block', async () => {
                const balance = await baseToken.balanceOf.call(owner);
                const amount = (await liquidityProtection.poolAvailableSpace(poolToken.address))[0];
                await baseToken.approve(liquidityProtection.address, amount);

                await liquidityProtection.addLiquidity(poolToken.address, baseToken.address, amount);
                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                let protection1 = await liquidityProtectionStore.protectedLiquidity.call(protectionIds[0]);
                protection1 = getProtection(protection1);

                await govToken.approve(liquidityProtection.address, protection1.reserveAmount);
                await expectRevert(
                    liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION),
                    'ERR_TOO_EARLY'
                );
                protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                expect(protectionIds.length).to.eql(1);

                const newBalance = await baseToken.balanceOf.call(owner);
                expect(newBalance).to.be.bignumber.equal(balance.sub(amount));
            });

            it('should revert when the caller attempts to add and partially remove base tokens on the same block', async () => {
                const balance = await baseToken.balanceOf.call(owner);
                const amount = (await liquidityProtection.poolAvailableSpace(poolToken.address))[0];
                await baseToken.approve(liquidityProtection.address, amount);

                await liquidityProtection.addLiquidity(poolToken.address, baseToken.address, amount);
                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                let protection1 = await liquidityProtectionStore.protectedLiquidity.call(protectionIds[0]);
                protection1 = getProtection(protection1);

                await govToken.approve(liquidityProtection.address, protection1.reserveAmount);
                await expectRevert(
                    liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION.div(new BN(2))),
                    'ERR_TOO_EARLY'
                );
                protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                expect(protectionIds.length).to.eql(1);

                const newBalance = await baseToken.balanceOf.call(owner);
                expect(newBalance).to.be.bignumber.equal(balance.sub(amount));
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

                    await expectRevert(
                        liquidityProtection.addLiquidity(
                            poolToken.address,
                            baseToken.address,
                            baseTokenAvailableSpace.addn(1)
                        ),
                        'ERR_MAX_AMOUNT_REACHED'
                    );
                    await liquidityProtection.addLiquidity(
                        poolToken.address,
                        baseToken.address,
                        baseTokenAvailableSpace
                    );

                    const poolTokenAvailableSpace2 = await liquidityProtection.poolAvailableSpace(poolToken.address);
                    const networkTokenAvailableSpace = poolTokenAvailableSpace2[1];

                    await expectRevert(
                        liquidityProtection.addLiquidity(
                            poolToken.address,
                            networkToken.address,
                            networkTokenAvailableSpace.addn(1)
                        ),
                        'SafeMath: subtraction overflow'
                    );
                    await liquidityProtection.addLiquidity(
                        poolToken.address,
                        networkToken.address,
                        networkTokenAvailableSpace
                    );
                });
            }

            describe('add liquidity', () => {
                // test both addLiquidity and addLiquidityFor
                for (const recipient of [owner, accounts[3]]) {
                    context(recipient === owner ? 'for self' : 'for another account', async () => {
                        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                            describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                beforeEach(async () => {
                                    await initPool(isETHReserve);
                                });

                                it('verifies that the caller can add liquidity', async () => {
                                    const totalSupply = await poolToken.totalSupply.call();
                                    const reserveBalance = await converter.reserveBalance.call(baseTokenAddress);
                                    const rate = poolTokenRate(totalSupply, reserveBalance);

                                    const reserveAmount = new BN(1000);
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
                                        recipient
                                    );
                                    expect(protectionIds.length).to.eql(1);

                                    const expectedPoolAmount = reserveAmount.mul(rate.d).div(rate.n);
                                    const reserve1Balance = await converter.reserveBalance.call(baseTokenAddress);
                                    const reserve2Balance = await converter.reserveBalance.call(networkToken.address);

                                    let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                        protectionIds[0]
                                    );
                                    protection = getProtection(protection);
                                    expect(protection.poolToken).to.eql(poolToken.address);
                                    expect(protection.reserveToken).to.eql(baseTokenAddress);
                                    expect(protection.poolAmount).to.be.bignumber.equal(expectedPoolAmount);
                                    expect(protection.reserveAmount).to.be.bignumber.equal(reserveAmount);
                                    expect(protection.reserveRateN).to.be.bignumber.equal(reserve2Balance);
                                    expect(protection.reserveRateD).to.be.bignumber.equal(reserve1Balance);
                                    expect(protection.timestamp).to.be.bignumber.equal(new BN(now));

                                    // verify balances
                                    const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                        poolToken.address
                                    );
                                    expect(systemBalance).to.be.bignumber.equal(expectedPoolAmount);

                                    const walletBalance = await poolToken.balanceOf.call(
                                        liquidityProtectionWallet.address
                                    );
                                    expect(walletBalance).to.be.bignumber.equal(expectedPoolAmount.mul(new BN(2)));

                                    const govBalance = await govToken.balanceOf.call(recipient);
                                    expect(govBalance).to.be.bignumber.equal(new BN(0));

                                    const protectionPoolBalance = await poolToken.balanceOf(
                                        liquidityProtection.address
                                    );
                                    expect(protectionPoolBalance).to.be.bignumber.equal(new BN(0));

                                    const protectionBaseBalance = await getBalance(
                                        baseToken,
                                        baseTokenAddress,
                                        liquidityProtection.address
                                    );
                                    expect(protectionBaseBalance).to.be.bignumber.equal(new BN(0));

                                    const protectionNetworkBalance = await networkToken.balanceOf(
                                        liquidityProtection.address
                                    );
                                    expect(protectionNetworkBalance).to.be.bignumber.equal(new BN(0));
                                });

                                it('should revert when attempting to add liquidity with zero amount', async () => {
                                    const reserveAmount = new BN(0);
                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        ),
                                        'ERR_ZERO_VALUE'
                                    );
                                });

                                if (converterType === 1) {
                                    it('should revert when attempting to add liquidity to an unsupported pool', async () => {
                                        await initPool(isETHReserve, false, false);

                                        const reserveAmount = new BN(1000);
                                        await expectRevert(
                                            addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount,
                                                isETHReserve,
                                                owner,
                                                recipient
                                            ),
                                            'ERR_POOL_NOT_SUPPORTED'
                                        );
                                    });
                                }

                                it('should revert when attempting to add liquidity to a non whitelisted pool', async () => {
                                    await liquidityProtectionSettings.removePoolFromWhitelist(poolToken.address);

                                    const reserveAmount = new BN(1000);
                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        ),
                                        'ERR_POOL_NOT_WHITELISTED'
                                    );
                                });

                                it('should revert when attempting to add liquidity when add liquidity is disabled', async () => {
                                    await liquidityProtectionSettings.disableAddLiquidity(
                                        poolToken.address,
                                        baseTokenAddress,
                                        true
                                    );

                                    const reserveAmount = new BN(1000);
                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        ),
                                        'ERR_ADD_LIQUIDITY_DISABLED'
                                    );
                                });

                                it('should revert when attempting to add liquidity with the wrong ETH value', async () => {
                                    const reserveAmount = new BN(1000);
                                    let value = 0;
                                    if (!isETHReserve) {
                                        value = reserveAmount;
                                        await baseToken.approve(liquidityProtection.address, reserveAmount);
                                    }

                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient,
                                            value
                                        ),
                                        'ERR_ETH_AMOUNT_MISMATCH'
                                    );
                                });

                                // eslint-disable-next-line max-len
                                it('should revert when attempting to add liquidity when the pool has less liquidity than the minimum required', async () => {
                                    let reserveAmount = new BN(10000);
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
                                    await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(100000000);
                                    reserveAmount = new BN(2000);

                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        ),
                                        'ERR_NOT_ENOUGH_LIQUIDITY'
                                    );
                                });

                                // eslint-disable-next-line max-len
                                it('should revert when attempting to add liquidity which will increase the system network token balance above the pool limit', async () => {
                                    let reserveAmount = new BN(10000);
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
                                    reserveAmount = new BN(2000);

                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        ),
                                        'ERR_MAX_AMOUNT_REACHED'
                                    );
                                });
                            });
                        }

                        describe('network token', () => {
                            it('verifies that the caller can add liquidity', async () => {
                                let reserveAmount = new BN(5000);
                                await baseToken.transfer(accounts[1], 5000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    false,
                                    accounts[1],
                                    accounts[1]
                                );

                                const totalSupply = await poolToken.totalSupply.call();
                                const reserveBalance = await converter.reserveBalance.call(networkToken.address);
                                const rate = poolTokenRate(totalSupply, reserveBalance);

                                const prevOwnerBalance = await networkToken.balanceOf(owner);
                                const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );
                                const prevWalletBalance = await poolToken.balanceOf.call(
                                    liquidityProtectionWallet.address
                                );

                                reserveAmount = new BN(1000);
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
                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(recipient);
                                expect(protectionIds.length).to.eql(1);

                                const expectedPoolAmount = reserveAmount.mul(rate.d).div(rate.n);
                                const reserve1Balance = await converter.reserveBalance.call(networkToken.address);
                                const reserve2Balance = await converter.reserveBalance.call(baseTokenAddress);

                                let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                    protectionIds[0]
                                );
                                protection = getProtection(protection);
                                expect(protection.poolToken).to.eql(poolToken.address);
                                expect(protection.reserveToken).to.eql(networkToken.address);
                                expect(protection.poolAmount).to.be.bignumber.equal(expectedPoolAmount);
                                expect(protection.reserveAmount).to.be.bignumber.equal(reserveAmount);
                                expect(protection.reserveRateN).to.be.bignumber.equal(reserve2Balance);
                                expect(protection.reserveRateD).to.be.bignumber.equal(reserve1Balance);
                                expect(protection.timestamp).to.be.bignumber.equal(new BN(now));

                                // verify balances
                                const balance = await networkToken.balanceOf(owner);
                                expect(balance).to.be.bignumber.equal(prevOwnerBalance.sub(reserveAmount));

                                const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );
                                expect(systemBalance).to.be.bignumber.equal(prevSystemBalance.sub(expectedPoolAmount));

                                const walletBalance = await poolToken.balanceOf.call(liquidityProtectionWallet.address);
                                expect(walletBalance).to.be.bignumber.equal(prevWalletBalance);

                                const govBalance = await govToken.balanceOf.call(recipient);
                                expect(govBalance).to.be.bignumber.equal(reserveAmount);

                                const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                                expect(protectionPoolBalance).to.be.bignumber.equal(new BN(0));

                                const protectionBaseBalance = await getBalance(
                                    baseToken,
                                    baseTokenAddress,
                                    liquidityProtection.address
                                );
                                expect(protectionBaseBalance).to.be.bignumber.equal(new BN(0));

                                const protectionNetworkBalance = await networkToken.balanceOf(
                                    liquidityProtection.address
                                );
                                expect(protectionNetworkBalance).to.be.bignumber.equal(new BN(0));
                            });

                            it('should revert when attempting to add liquidity with zero amount', async () => {
                                const reserveAmount = new BN(0);
                                await expectRevert(
                                    addProtectedLiquidity(
                                        poolToken.address,
                                        networkToken,
                                        networkToken.address,
                                        reserveAmount,
                                        false,
                                        owner,
                                        recipient
                                    ),
                                    'ERR_ZERO_VALUE'
                                );
                            });

                            if (converterType === 1) {
                                it('should revert when attempting to add liquidity to an unsupported pool', async () => {
                                    await initPool(false, false, false);

                                    const reserveAmount = new BN(1000);
                                    await expectRevert(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            networkToken,
                                            networkToken.address,
                                            reserveAmount,
                                            false,
                                            owner,
                                            recipient
                                        ),
                                        'ERR_POOL_NOT_SUPPORTED'
                                    );
                                });
                            }

                            it('should revert when attempting to add liquidity to a non whitelisted pool', async () => {
                                await liquidityProtectionSettings.removePoolFromWhitelist(poolToken.address);

                                const reserveAmount = new BN(1000);
                                await expectRevert(
                                    addProtectedLiquidity(
                                        poolToken.address,
                                        networkToken,
                                        networkToken.address,
                                        reserveAmount,
                                        false,
                                        owner,
                                        recipient
                                    ),
                                    'ERR_POOL_NOT_WHITELISTED'
                                );
                            });

                            it('should revert when attempting to add liquidity with non-zero ETH value', async () => {
                                const reserveAmount = new BN(1000);

                                await expectRevert(
                                    addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        false,
                                        owner,
                                        recipient,
                                        reserveAmount
                                    ),
                                    'ERR_ETH_AMOUNT_MISMATCH'
                                );
                            });

                            it('should revert when attempting to add more liquidity than the system currently owns', async () => {
                                let reserveAmount = new BN(5000);
                                await baseToken.transfer(accounts[1], 5000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    false,
                                    accounts[1]
                                );

                                reserveAmount = new BN(100000);

                                await expectRevert(
                                    addProtectedLiquidity(
                                        poolToken.address,
                                        networkToken,
                                        networkToken.address,
                                        reserveAmount,
                                        false,
                                        owner,
                                        recipient
                                    ),
                                    'SafeMath: subtraction overflow'
                                );
                            });
                        });
                    });
                }
            });

            describe('removeLiquidityReturn', () => {
                it('verifies that removeLiquidityReturn returns the correct amount for removing entire protection', async () => {
                    const reserveAmount = new BN(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                    const protectionId = protectionIds[0];

                    const amount = (
                        await liquidityProtection.removeLiquidityReturn(protectionId, PPM_RESOLUTION, now)
                    )[0];

                    expect(amount).to.be.bignumber.equal(reserveAmount);
                });

                it('verifies that removeLiquidityReturn returns the correct amount for removing a portion of a protection', async () => {
                    const reserveAmount = new BN(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                    const protectionId = protectionIds[0];

                    const amount = (await liquidityProtection.removeLiquidityReturn(protectionId, 800000, now))[0];

                    expect(amount).to.be.bignumber.equal(new BN(800));
                });

                it('verifies that removeLiquidityReturn can be called even if the average rate is invalid', async () => {
                    const reserveAmount = new BN(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                    const protectionId = protectionIds[0];

                    await increaseRate(baseTokenAddress);
                    await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                    await liquidityProtection.removeLiquidityReturn(protectionId, PPM_RESOLUTION, now);
                });

                it('should revert when calling removeLiquidityReturn with zero portion of the liquidity', async () => {
                    await expectRevert(
                        liquidityProtection.removeLiquidityReturn('1234', 0, now),
                        'ERR_INVALID_PORTION'
                    );
                });

                it('should revert when calling removeLiquidityReturn with remove more than 100% of the liquidity', async () => {
                    await expectRevert(
                        liquidityProtection.removeLiquidityReturn('1234', PPM_RESOLUTION.add(new BN(1)), now),
                        'ERR_INVALID_PORTION'
                    );
                });

                it('should revert when calling removeLiquidityReturn with a date earlier than the protection deposit', async () => {
                    const reserveAmount = new BN(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                    const protectionId = protectionIds[0];

                    await expectRevert(
                        liquidityProtection.removeLiquidityReturn(
                            protectionId,
                            PPM_RESOLUTION,
                            now.sub(duration.years(1))
                        ),
                        'ERR_INVALID_TIMESTAMP'
                    );
                });

                it('should revert when calling removeLiquidityReturn with invalid id', async () => {
                    await expectRevert(
                        liquidityProtection.removeLiquidityReturn('1234', PPM_RESOLUTION, now),
                        'ERR_INVALID_ID'
                    );
                });
            });

            describe('claim balance', () => {
                beforeEach(async () => {
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, new BN(20000));
                    await addProtectedLiquidity(poolToken.address, networkToken, networkToken.address, new BN(2000));
                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                    const protectionId = protectionIds[protectionIds.length - 1];

                    const portion = PPM_RESOLUTION.div(new BN(2));
                    const amount = new BN(2000).mul(portion).div(PPM_RESOLUTION);
                    await govToken.approve(liquidityProtection.address, amount);
                    await liquidityProtection.setTime(now.add(duration.seconds(1)));
                    await liquidityProtection.removeLiquidity(protectionId, portion);
                    await govToken.approve(liquidityProtection.address, amount);
                    await liquidityProtection.removeLiquidity(protectionId, portion);
                });

                it('verifies that locked balance owner can claim locked tokens if sufficient time has passed', async () => {
                    const timestamp = await getTimestamp(PROTECTION_FULL_PROTECTION);
                    await setTime(timestamp);

                    const prevBalance = await networkToken.balanceOf(owner);
                    const lockedBalance = (await liquidityProtectionStore.lockedBalance(owner, 0))[0];
                    const prevTotalLockedBalance = await getLockedBalance(owner);

                    await liquidityProtection.claimBalance(0, 1);

                    const balance = await networkToken.balanceOf(owner);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(lockedBalance));

                    const totalLockedBalance = await getLockedBalance(owner);
                    expect(totalLockedBalance).to.be.bignumber.equal(prevTotalLockedBalance.sub(lockedBalance));
                });

                it('verifies that locked balance owner can claim multiple locked tokens if sufficient time has passed', async () => {
                    const timestamp = await getTimestamp(PROTECTION_FULL_PROTECTION);
                    await setTime(timestamp);

                    const prevBalance = await networkToken.balanceOf(owner);
                    const prevTotalLockedBalance = await getLockedBalance(owner);

                    await liquidityProtection.claimBalance(0, 2);

                    const balance = await networkToken.balanceOf(owner);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(prevTotalLockedBalance));

                    const totalLockedBalance = await getLockedBalance(owner);
                    expect(totalLockedBalance).to.be.bignumber.equal(new BN(0));

                    const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(owner);
                    expect(lockedBalanceCount).to.be.bignumber.equal(new BN(0));
                });

                it('verifies that attempting to claim tokens that are still locked does not change any balance', async () => {
                    const prevBalance = await networkToken.balanceOf(owner);
                    const prevTotalLockedBalance = await getLockedBalance(owner);

                    await liquidityProtection.claimBalance(0, 2);

                    const balance = await networkToken.balanceOf(owner);
                    expect(balance).to.be.bignumber.equal(prevBalance);

                    const totalLockedBalance = await getLockedBalance(owner);
                    expect(totalLockedBalance).to.be.bignumber.equal(prevTotalLockedBalance);
                });

                it('should revert when locked balance owner attempts claim tokens with invalid indices', async () => {
                    await expectRevert(liquidityProtection.claimBalance(2, 3), 'ERR_INVALID_INDICES');
                });
            });

            describe('remove liquidity', () => {
                for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                    describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                        beforeEach(async () => {
                            await initPool(isETHReserve);
                        });

                        it('verifies that the caller can remove entire protection', async () => {
                            const reserveAmount = new BN(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );
                            let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];
                            let protection = await liquidityProtectionStore.protectedLiquidity.call(protectionId);
                            protection = getProtection(protection);

                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );
                            const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            const prevBalance = await getBalance(baseToken, baseTokenAddress, owner);
                            const prevGovBalance = await govToken.balanceOf(owner);

                            let transactionCost = new BN(0);
                            if (protection.reserveToken === networkToken.address) {
                                const res = await govToken.approve(
                                    liquidityProtection.address,
                                    protection.reserveAmount
                                );
                                transactionCost = transactionCost.add(await getTransactionCost(res));
                            }
                            const response = await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            if (isETHReserve) {
                                transactionCost = transactionCost.add(await getTransactionCost(response));
                            }
                            const res = await liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION);
                            protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            expect(protectionIds.length).to.eql(0);

                            if (isETHReserve) {
                                transactionCost = transactionCost.add(await getTransactionCost(res));
                            }

                            // verify balances
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.be.bignumber.equal(prevSystemBalance.sub(protection.poolAmount));

                            const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            // double since system balance was also liquidated
                            const delta = protection.poolAmount.mul(new BN(2));
                            expect(walletBalance).to.be.bignumber.equal(prevWalletBalance.sub(delta));

                            const balance = await getBalance(baseToken, baseTokenAddress, owner);
                            expect(balance).to.be.bignumber.equal(prevBalance.add(reserveAmount).sub(transactionCost));

                            const govBalance = await govToken.balanceOf.call(owner);
                            expect(govBalance).to.be.bignumber.equal(prevGovBalance);

                            const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                            expect(protectionPoolBalance).to.be.bignumber.equal(new BN(0));

                            const protectionBaseBalance = await getBalance(
                                baseToken,
                                baseTokenAddress,
                                liquidityProtection.address
                            );
                            expect(protectionBaseBalance).to.be.bignumber.equal(new BN(0));

                            const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                            expect(protectionNetworkBalance).to.be.bignumber.equal(new BN(0));
                        });

                        it('verifies that the caller can remove a portion of a protection', async () => {
                            const reserveAmount = new BN(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );
                            let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];
                            let prevProtection = await liquidityProtectionStore.protectedLiquidity.call(protectionId);
                            prevProtection = getProtection(prevProtection);

                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );
                            const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            const prevBalance = await getBalance(baseToken, baseTokenAddress, owner);
                            const prevGovBalance = await govToken.balanceOf(owner);

                            const portion = new BN(800000);
                            let transactionCost = new BN(0);
                            if (prevProtection.reserveAddress === networkToken.address) {
                                const res = await govToken.approve(
                                    liquidityProtection.address,
                                    prevProtection.reserveAmount.mul(portion).div(PPM_RESOLUTION)
                                );

                                transactionCost = transactionCost.add(await getTransactionCost(res));
                            }
                            const response = await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            if (isETHReserve) {
                                transactionCost = transactionCost.add(await getTransactionCost(response));
                            }
                            const res = await liquidityProtection.removeLiquidity(protectionId, portion);
                            protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            expect(protectionIds.length).to.eql(1);

                            let protection = await liquidityProtectionStore.protectedLiquidity.call(protectionId);
                            protection = getProtection(protection);

                            expect(protection.poolAmount).to.be.bignumber.equal(
                                prevProtection.poolAmount.div(new BN(5))
                            );
                            expect(protection.reserveAmount).to.be.bignumber.equal(
                                prevProtection.reserveAmount.div(new BN(5))
                            );

                            if (isETHReserve) {
                                transactionCost = transactionCost.add(await getTransactionCost(res));
                            }

                            // verify balances
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.be.bignumber.equal(
                                prevSystemBalance.sub(prevProtection.poolAmount.sub(protection.poolAmount))
                            );

                            const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            // double since system balance was also liquidated
                            const delta = prevProtection.poolAmount.sub(protection.poolAmount).mul(new BN(2));
                            expect(walletBalance).to.be.bignumber.equal(prevWalletBalance.sub(delta));

                            const balance = await getBalance(baseToken, baseTokenAddress, owner);
                            expect(balance).to.be.bignumber.equal(prevBalance.add(new BN(800)).sub(transactionCost));

                            const govBalance = await govToken.balanceOf.call(owner);
                            expect(govBalance).to.be.bignumber.equal(prevGovBalance);

                            const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                            expect(protectionPoolBalance).to.be.bignumber.equal(new BN(0));

                            const protectionBaseBalance = await getBalance(
                                baseToken,
                                baseTokenAddress,
                                liquidityProtection.address
                            );
                            expect(protectionBaseBalance).to.be.bignumber.equal(new BN(0));

                            const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                            expect(protectionNetworkBalance).to.be.bignumber.equal(new BN(0));
                        });

                        it('verifies that removing the entire protection updates the removal checkpoint', async () => {
                            const reserveAmount = new BN(100000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );

                            await setTime(now.add(duration.days(3)));

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            expect(await checkpointStore.checkpoint.call(owner)).to.be.bignumber.equal(new BN(0));

                            const portion = new BN(PPM_RESOLUTION);
                            await liquidityProtection.removeLiquidity(protectionId, portion);

                            expect(await checkpointStore.checkpoint.call(owner)).to.be.bignumber.equal(now);
                        });

                        it('verifies that removing a portion of a protection updates the removal checkpoint', async () => {
                            const reserveAmount = new BN(100000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            expect(await checkpointStore.checkpoint.call(owner)).to.be.bignumber.equal(new BN(0));

                            const portion = new BN(500000);
                            for (let i = 1; i < 5; i++) {
                                await setTime(now.add(duration.days(3)));

                                await liquidityProtection.removeLiquidity(protectionId, portion);

                                expect(await checkpointStore.checkpoint.call(owner)).to.be.bignumber.equal(now);
                            }
                        });

                        it('should revert when attempting to remove zero portion of the liquidity', async () => {
                            const reserveAmount = new BN(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );
                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expectRevert(
                                liquidityProtection.removeLiquidity(protectionId, 0),
                                'ERR_INVALID_PORTION'
                            );
                        });

                        it('should revert when attempting to remove more than 100% of the liquidity', async () => {
                            const reserveAmount = new BN(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );
                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expectRevert(
                                liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION.add(new BN(1))),
                                'ERR_INVALID_PORTION'
                            );
                        });

                        it('should revert when attempting to remove while the average rate is invalid', async () => {
                            const reserveAmount = new BN(1000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );
                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            await increaseRate(baseTokenAddress);
                            await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expectRevert(
                                liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION),
                                'ERR_INVALID_RATE'
                            );
                        });

                        it('should revert when attempting to remove liquidity that does not exist', async () => {
                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expectRevert(
                                liquidityProtection.removeLiquidity('1234', PPM_RESOLUTION),
                                'ERR_ACCESS_DENIED'
                            );
                        });

                        it('should revert when attempting to remove liquidity that belongs to another account', async () => {
                            const reserveAmount = new BN(5000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expectRevert(
                                liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION, {
                                    from: accounts[1]
                                }),
                                'ERR_ACCESS_DENIED'
                            );
                        });

                        it('should revert when attempting to remove liquidity from a non whitelisted pool', async () => {
                            const reserveAmount = new BN(5000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                            const protectionId = protectionIds[0];

                            await liquidityProtectionSettings.removePoolFromWhitelist(poolToken.address);

                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expectRevert(
                                liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION),
                                'ERR_POOL_NOT_WHITELISTED'
                            );
                        });
                    });
                }

                describe('network token', () => {
                    it('verifies that the caller can remove entire protection', async () => {
                        let reserveAmount = new BN(5000);
                        await baseToken.transfer(accounts[1], 5000);
                        await addProtectedLiquidity(
                            poolToken.address,
                            baseToken,
                            baseTokenAddress,
                            reserveAmount,
                            false,
                            accounts[1]
                        );

                        reserveAmount = new BN(1000);
                        await addProtectedLiquidity(
                            poolToken.address,
                            networkToken,
                            networkToken.address,
                            reserveAmount
                        );
                        let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                        const protectionId = protectionIds[0];
                        let protection = await liquidityProtectionStore.protectedLiquidity.call(protectionId);
                        protection = getProtection(protection);

                        const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        const prevBalance = await getBalance(networkToken, networkToken.address, owner);
                        const prevGovBalance = await govToken.balanceOf(owner);

                        await govToken.approve(liquidityProtection.address, protection.reserveAmount);
                        await liquidityProtection.setTime(now.add(duration.seconds(1)));
                        await liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION);
                        protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                        expect(protectionIds.length).to.eql(0);

                        // verify balances
                        const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        expect(systemBalance).to.be.bignumber.equal(prevSystemBalance.add(protection.poolAmount));

                        const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        expect(walletBalance).to.be.bignumber.equal(prevWalletBalance);

                        const balance = await getBalance(networkToken, networkToken.address, owner);
                        expectAlmostEqual(balance, prevBalance.add(reserveAmount));

                        const govBalance = await govToken.balanceOf.call(owner);
                        expect(govBalance).to.be.bignumber.equal(prevGovBalance.sub(reserveAmount));

                        const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                        expect(protectionPoolBalance).to.be.bignumber.equal(new BN(0));

                        const protectionBaseBalance = await getBalance(
                            baseToken,
                            baseTokenAddress,
                            liquidityProtection.address
                        );
                        expect(protectionBaseBalance).to.be.bignumber.equal(new BN(0));

                        const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                        expect(protectionNetworkBalance).to.be.bignumber.equal(new BN(0));
                    });

                    it('verifies that the caller can remove a portion of a protection', async () => {
                        let reserveAmount = new BN(5000);
                        await baseToken.transfer(accounts[1], 5000);
                        await addProtectedLiquidity(
                            poolToken.address,
                            baseToken,
                            baseTokenAddress,
                            reserveAmount,
                            false,
                            accounts[1]
                        );

                        reserveAmount = new BN(1000);
                        await addProtectedLiquidity(
                            poolToken.address,
                            networkToken,
                            networkToken.address,
                            reserveAmount
                        );
                        let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                        const protectionId = protectionIds[0];
                        let prevProtection = await liquidityProtectionStore.protectedLiquidity.call(protectionId);
                        prevProtection = getProtection(prevProtection);

                        const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        const prevBalance = await getBalance(networkToken, networkToken.address, owner);
                        const prevGovBalance = await govToken.balanceOf(owner);

                        const portion = new BN(800000);
                        await govToken.approve(
                            liquidityProtection.address,
                            prevProtection.reserveAmount.mul(portion).div(PPM_RESOLUTION)
                        );
                        await liquidityProtection.setTime(now.add(duration.seconds(1)));
                        await liquidityProtection.removeLiquidity(protectionId, portion);
                        protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner);
                        expect(protectionIds.length).to.eql(1);

                        let protection = await liquidityProtectionStore.protectedLiquidity.call(protectionId);
                        protection = getProtection(protection);

                        expect(protection.poolAmount).to.be.bignumber.equal(prevProtection.poolAmount.div(new BN(5)));
                        expect(protection.reserveAmount).to.be.bignumber.equal(
                            prevProtection.reserveAmount.div(new BN(5))
                        );

                        // verify balances
                        const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        expect(systemBalance).to.be.bignumber.equal(
                            prevSystemBalance.add(prevProtection.poolAmount.sub(protection.poolAmount))
                        );

                        const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        expect(walletBalance).to.be.bignumber.equal(prevWalletBalance);

                        const balance = await getBalance(networkToken, networkToken.address, owner);
                        expectAlmostEqual(balance, prevBalance.add(new BN(800)));

                        const govBalance = await govToken.balanceOf.call(owner);
                        expect(govBalance).to.be.bignumber.equal(prevGovBalance.sub(new BN(800)));

                        const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                        expect(protectionPoolBalance).to.be.bignumber.equal(new BN(0));

                        const protectionBaseBalance = await getBalance(
                            baseToken,
                            baseTokenAddress,
                            liquidityProtection.address
                        );
                        expect(protectionBaseBalance).to.be.bignumber.equal(new BN(0));

                        const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                        expect(protectionNetworkBalance).to.be.bignumber.equal(new BN(0));
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
                        for (let withFee = 0; withFee < 2; withFee++) {
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
                                        const reserveAmount = new BN(5000);
                                        let reserveToken;
                                        let reserveAddress;
                                        let otherReserveAddress;
                                        let timestamp;

                                        beforeEach(async () => {
                                            await addProtectedLiquidity(
                                                poolToken.address,
                                                baseToken,
                                                baseTokenAddress,
                                                reserveAmount
                                            );

                                            reserveToken = baseToken;
                                            reserveAddress = baseTokenAddress;
                                            otherReserveAddress = networkToken.address;

                                            if (reserve !== 0) {
                                                // adding more liquidity so that the system has enough pool tokens
                                                await addProtectedLiquidity(
                                                    poolToken.address,
                                                    baseToken,
                                                    baseTokenAddress,
                                                    new BN(20000)
                                                );
                                                await addProtectedLiquidity(
                                                    poolToken.address,
                                                    networkToken,
                                                    networkToken.address,
                                                    reserveAmount
                                                );

                                                [reserveToken, reserveAddress, otherReserveAddress] = [
                                                    networkToken,
                                                    otherReserveAddress,
                                                    reserveAddress
                                                ];
                                            }

                                            if (withFee) {
                                                await generateFee();
                                            }

                                            if (rateChange === 1) {
                                                await increaseRate(reserveAddress);
                                            } else if (rateChange === 2) {
                                                await increaseRate(otherReserveAddress);
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
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];

                                                const amount = (
                                                    await liquidityProtection.removeLiquidityReturn(
                                                        protectionId,
                                                        PPM_RESOLUTION,
                                                        timestamp
                                                    )
                                                )[0];

                                                expect(amount).to.be.bignumber.lt(reserveAmount);
                                            });

                                            // eslint-disable-next-line max-len
                                            it('verifies that removeLiquidity returns an amount that is smaller than the initial amount', async () => {
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                const prevBalance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner
                                                );
                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                                const balance = await getBalance(reserveToken, reserveAddress, owner);

                                                let lockedBalance = await getLockedBalance(owner);
                                                if (reserveAddress === baseTokenAddress) {
                                                    const rate = await getRate(networkToken.address);
                                                    lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                }

                                                expect(balance.sub(prevBalance).add(lockedBalance)).to.be.bignumber.lt(
                                                    reserveAmount
                                                );
                                            });
                                        } else if (withFee) {
                                            // eslint-disable-next-line max-len
                                            it('verifies that removeLiquidityReturn returns an amount that is larger than the initial amount', async () => {
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];

                                                const amount = (
                                                    await liquidityProtection.removeLiquidityReturn(
                                                        protectionId,
                                                        PPM_RESOLUTION,
                                                        timestamp
                                                    )
                                                )[0];

                                                expect(amount).to.be.bignumber.gt(reserveAmount);
                                            });

                                            it('verifies that removeLiquidity returns an amount that is larger than the initial amount', async () => {
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                const prevBalance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner
                                                );
                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                                const balance = await getBalance(reserveToken, reserveAddress, owner);

                                                let lockedBalance = await getLockedBalance(owner);
                                                if (reserveAddress === baseTokenAddress) {
                                                    const rate = await getRate(networkToken.address);
                                                    lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                }

                                                expect(balance.sub(prevBalance).add(lockedBalance)).to.be.bignumber.gt(
                                                    reserveAmount
                                                );
                                            });
                                        } else {
                                            // eslint-disable-next-line max-len
                                            it('verifies that removeLiquidityReturn returns an amount that is almost equal to the initial amount', async () => {
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
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
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                const prevBalance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner
                                                );
                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                                const balance = await getBalance(reserveToken, reserveAddress, owner);

                                                let lockedBalance = await getLockedBalance(owner);
                                                if (reserveAddress === baseTokenAddress) {
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
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);

                                                const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(
                                                    owner
                                                );
                                                expect(lockedBalanceCount).to.be.bignumber.equal(new BN(1));

                                                const lockedBalance = await getLockedBalance(owner);
                                                expect(lockedBalance).to.be.bignumber.gt(new BN(0));
                                            });
                                        } else {
                                            it('verifies that removeLiquidity does not lock network tokens for the caller', async () => {
                                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity.call(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);

                                                const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(
                                                    owner
                                                );
                                                expect(lockedBalanceCount).to.be.bignumber.equal(new BN(0));

                                                const lockedBalance = await getLockedBalance(owner);
                                                expect(lockedBalance).to.be.bignumber.equal(new BN(0));
                                            });
                                        }
                                    }
                                );
                            }
                        }
                    }
                }
            });

            describe('notifications', () => {
                let eventsSubscriber;

                beforeEach(async () => {
                    eventsSubscriber = await LiquidityProtectionEventsSubscriber.new();
                });

                // test both addLiquidity and addLiquidityFor
                for (const recipient of [owner, accounts[3]]) {
                    context(recipient === owner ? 'for self' : 'for another account', async () => {
                        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                            describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                beforeEach(async () => {
                                    await initPool(isETHReserve);
                                });

                                context('without an events notifier', () => {
                                    it('should not publish adding liquidity events', async () => {
                                        const reserveAmount = new BN(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );

                                        expect(await eventsSubscriber.adding.call()).to.be.false();
                                        expect(await eventsSubscriber.id.call()).to.be.bignumber.equal(new BN(0));
                                        expect(await eventsSubscriber.provider.call()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAnchor.call()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.reserveToken.call()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAmount.call()).to.be.bignumber.equal(
                                            new BN(0)
                                        );
                                        expect(await eventsSubscriber.reserveAmount.call()).to.be.bignumber.equal(
                                            new BN(0)
                                        );
                                    });

                                    it('should not publish removing liquidity events', async () => {
                                        const reserveAmount = new BN(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );
                                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds.call(
                                            recipient
                                        );
                                        const id = protectionIds[0];

                                        await setTime(now.add(new BN(1)));
                                        await liquidityProtection.removeLiquidity(id, PPM_RESOLUTION, {
                                            from: recipient
                                        });

                                        expect(await eventsSubscriber.adding.call()).to.be.false();
                                        expect(await eventsSubscriber.id.call()).to.be.bignumber.equal(new BN(0));
                                        expect(await eventsSubscriber.provider.call()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAnchor.call()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.reserveToken.call()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAmount.call()).to.be.bignumber.equal(
                                            new BN(0)
                                        );
                                        expect(await eventsSubscriber.reserveAmount.call()).to.be.bignumber.equal(
                                            new BN(0)
                                        );
                                    });
                                });

                                context('with an events notifier', () => {
                                    beforeEach(async () => {
                                        await liquidityProtectionSettings.addSubscriber(eventsSubscriber.address, {
                                            from: owner
                                        });
                                    });

                                    it('should publish adding liquidity events', async () => {
                                        const totalSupply = await poolToken.totalSupply.call();
                                        const reserveBalance = await converter.reserveBalance.call(baseTokenAddress);
                                        const rate = poolTokenRate(totalSupply, reserveBalance);

                                        const reserveAmount = new BN(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );

                                        expect(await eventsSubscriber.adding.call()).to.be.true();
                                        expect(await eventsSubscriber.id.call()).to.be.bignumber.equal(new BN(0));
                                        expect(await eventsSubscriber.provider.call()).to.eql(recipient);
                                        expect(await eventsSubscriber.poolAnchor.call()).to.eql(poolToken.address);
                                        expect(await eventsSubscriber.reserveToken.call()).to.eql(baseTokenAddress);
                                        expect(await eventsSubscriber.poolAmount.call()).to.be.bignumber.equal(
                                            reserveAmount.mul(rate.d).div(rate.n)
                                        );
                                        expect(await eventsSubscriber.reserveAmount.call()).to.be.bignumber.equal(
                                            reserveAmount
                                        );
                                    });

                                    it('should publish removing liquidity events', async () => {
                                        const totalSupply = await poolToken.totalSupply.call();
                                        const reserveBalance = await converter.reserveBalance.call(baseTokenAddress);
                                        const rate = poolTokenRate(totalSupply, reserveBalance);

                                        const reserveAmount = new BN(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient
                                        );
                                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds.call(
                                            recipient
                                        );
                                        const id = protectionIds[0];

                                        await setTime(now.add(new BN(1)));

                                        await liquidityProtection.removeLiquidity(id, PPM_RESOLUTION, {
                                            from: recipient
                                        });

                                        expect(await eventsSubscriber.adding.call()).to.be.false();
                                        expect(await eventsSubscriber.id.call()).to.be.bignumber.equal(id);
                                        expect(await eventsSubscriber.provider.call()).to.eql(recipient);
                                        expect(await eventsSubscriber.poolAnchor.call()).to.eql(poolToken.address);
                                        expect(await eventsSubscriber.reserveToken.call()).to.eql(baseTokenAddress);
                                        expect(await eventsSubscriber.poolAmount.call()).to.be.bignumber.equal(
                                            reserveAmount.mul(rate.d).div(rate.n)
                                        );
                                        expect(await eventsSubscriber.reserveAmount.call()).to.be.bignumber.equal(
                                            reserveAmount
                                        );
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });
    }
});
