const { expect } = require('chai');

const { BigNumber } = require('ethers');

const { ETH_RESERVE_ADDRESS, registry, roles, ZERO_ADDRESS, duration, latest } = require('./helpers/Constants');
const Decimal = require('decimal.js');

const { ROLE_OWNER, ROLE_GOVERNOR, ROLE_MINTER } = roles;

const ContractRegistry = ethers.getContractFactory('ContractRegistry');
const BancorFormula = ethers.getContractFactory('BancorFormula');
const BancorNetwork = ethers.getContractFactory('BancorNetwork');
const DSToken = ethers.getContractFactory('DSToken');
const ConverterRegistry = ethers.getContractFactory('TestConverterRegistry');
const ConverterRegistryData = ethers.getContractFactory('ConverterRegistryData');
const ConverterFactory = ethers.getContractFactory('ConverterFactory');
const LiquidityPoolV1ConverterFactory = ethers.getContractFactory('TestLiquidityPoolV1ConverterFactory');
const LiquidityPoolV1Converter = ethers.getContractFactory('TestLiquidityPoolV1Converter');
const StandardPoolConverterFactory = ethers.getContractFactory('TestStandardPoolConverterFactory');
const StandardPoolConverter = ethers.getContractFactory('TestStandardPoolConverter');
const LiquidityProtectionSettings = ethers.getContractFactory('LiquidityProtectionSettings');
const LiquidityProtectionStore = ethers.getContractFactory('LiquidityProtectionStore');
const LiquidityProtectionStats = ethers.getContractFactory('LiquidityProtectionStats');
const LiquidityProtectionSystemStore = ethers.getContractFactory('LiquidityProtectionSystemStore');
const TokenHolder = ethers.getContractFactory('TokenHolder');
const LiquidityProtectionEventsSubscriber = ethers.getContractFactory('TestLiquidityProtectionEventsSubscriber');
const TokenGovernance = ethers.getContractFactory('TestTokenGovernance');
const CheckpointStore = ethers.getContractFactory('TestCheckpointStore');
const LiquidityProtection = ethers.getContractFactory('TestLiquidityProtection');

const PPM_RESOLUTION = BigNumber.from(1000000);
const RESERVE1_AMOUNT = BigNumber.from(1000000);
const RESERVE2_AMOUNT = BigNumber.from(2500000);
const TOTAL_SUPPLY = BigNumber.from(10).pow(BigNumber.from(24));

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

let accounts;
let owner;
let governor;

describe('LiquidityProtection', () => {
    before(async () => {
        accounts = await ethers.getSigners();
        owner = accounts[0];
        governor = accounts[1];
    });

    for (const converterType of [1, 3]) {
        describe(`${converterType === 1 ? 'LiquidityPoolV1Converter' : 'StandardPoolConverter'}`, () => {
            const initPool = async (isETH = false, whitelist = true, standard = true) => {
                if (isETH) {
                    baseTokenAddress = ETH_RESERVE_ADDRESS;
                } else {
                    // create a pool with ERC20 as the base token
                    baseToken = await (await DSToken).deploy('RSV1', 'RSV1', 18);
                    await baseToken.issue(owner.address, TOTAL_SUPPLY);
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
                const anchorCount = await converterRegistry.getAnchorCount();
                const poolTokenAddress = await converterRegistry.getAnchor(anchorCount - 1);
                poolToken = await (await DSToken).attach(poolTokenAddress);
                const converterAddress = await poolToken.owner();
                if (converterType === 1) {
                    converter = await (await LiquidityPoolV1Converter).attach(converterAddress);
                } else {
                    converter = await (await StandardPoolConverter).attach(converterAddress);
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

                await converter['addLiquidity(address[],uint256[],uint256)'](
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

            before(async () => {
                contractRegistry = await (await ContractRegistry).deploy();
                converterRegistry = await (await ConverterRegistry).deploy(contractRegistry.address);
                converterRegistryData = await (await ConverterRegistryData).deploy(contractRegistry.address);
                bancorNetwork = await (await BancorNetwork).deploy(contractRegistry.address);

                const liquidityPoolV1ConverterFactory = await (await LiquidityPoolV1ConverterFactory).deploy();
                const standardPoolConverterFactory = await (await StandardPoolConverterFactory).deploy();
                const converterFactory = await (await ConverterFactory).deploy();
                await converterFactory.registerTypedConverterFactory(liquidityPoolV1ConverterFactory.address);
                await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

                const bancorFormula = await (await BancorFormula).deploy();
                await bancorFormula.init();

                await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
                await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
                await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

                await converterRegistry.enableTypeChanging(false);
            });

            beforeEach(async () => {
                networkToken = await (await DSToken).deploy('BNT', 'BNT', 18);
                await networkToken.issue(owner.address, TOTAL_SUPPLY);
                networkTokenGovernance = await (await TokenGovernance).deploy(networkToken.address);
                await networkTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await networkToken.transferOwnership(networkTokenGovernance.address);
                await networkTokenGovernance.acceptTokenOwnership();

                govToken = await (await DSToken).deploy('vBNT', 'vBNT', 18);
                govTokenGovernance = await (await TokenGovernance).deploy(govToken.address);
                await govTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await govToken.transferOwnership(govTokenGovernance.address);
                await govTokenGovernance.acceptTokenOwnership();

                // initialize liquidity protection
                checkpointStore = await (await CheckpointStore).deploy();
                liquidityProtectionSettings = await (await LiquidityProtectionSettings).deploy(
                    networkToken.address,
                    contractRegistry.address
                );
                await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(BigNumber.from(100));
                await liquidityProtectionSettings.setMinNetworkCompensation(BigNumber.from(3));

                liquidityProtectionStore = await (await LiquidityProtectionStore).deploy();
                liquidityProtectionStats = await (await LiquidityProtectionStats).deploy();
                liquidityProtectionSystemStore = await (await LiquidityProtectionSystemStore).deploy();
                liquidityProtectionWallet = await (await TokenHolder).deploy();
                liquidityProtection = await (await LiquidityProtection).deploy([
                    liquidityProtectionSettings.address,
                    liquidityProtectionStore.address,
                    liquidityProtectionStats.address,
                    liquidityProtectionSystemStore.address,
                    liquidityProtectionWallet.address,
                    networkTokenGovernance.address,
                    govTokenGovernance.address,
                    checkpointStore.address
                ]);

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

            it('verifies the liquidity protection contract after initialization', async () => {
                const settings = await liquidityProtection.settings();
                expect(settings).to.eql(liquidityProtectionSettings.address);

                const store = await liquidityProtection.store();
                expect(store).to.eql(liquidityProtectionStore.address);

                const stats = await liquidityProtection.stats();
                expect(stats).to.eql(liquidityProtectionStats.address);

                const systemStore = await liquidityProtection.systemStore();
                expect(systemStore).to.eql(liquidityProtectionSystemStore.address);

                const wallet = await liquidityProtection.wallet();
                expect(wallet).to.eql(liquidityProtectionWallet.address);

                const networkTknGovernance = await liquidityProtection.networkTokenGovernance();
                expect(networkTknGovernance).to.eql(networkTokenGovernance.address);

                const networkTkn = await liquidityProtection.networkToken();
                expect(networkTkn).to.eql(networkToken.address);

                const govTknGovernance = await liquidityProtection.govTokenGovernance();
                expect(govTknGovernance).to.eql(govTokenGovernance.address);

                const govTkn = await liquidityProtection.govToken();
                expect(govTkn).to.eql(govToken.address);

                const lastRemoveCheckpointStore = await liquidityProtection.lastRemoveCheckpointStore();
                expect(lastRemoveCheckpointStore).to.eql(checkpointStore.address);
            });

            it('verifies that the owner can transfer the store ownership', async () => {
                await liquidityProtection.transferStoreOwnership(governor.address);
                liquidityProtectionStore.connect(governor).acceptOwnership();
            });

            it('should revert when a non owner attempts to transfer the store ownership', async () => {
                await expect(
                    liquidityProtection.connect(governor).transferStoreOwnership(accounts[2].address)
                ).to.be.revertedWith('ERR_ACCESS_DENIED');
            });

            it('verifies that the owner can transfer the wallet ownership', async () => {
                await liquidityProtection.transferWalletOwnership(governor.address);
                liquidityProtectionWallet.connect(governor).acceptOwnership();
            });

            it('should revert when a non owner attempts to transfer the wallet ownership', async () => {
                await expect(
                    liquidityProtection.connect(governor).transferWalletOwnership(accounts[2].address)
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
                await expect(liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION)).to.be.revertedWith(
                    'ERR_TOO_EARLY'
                );
                protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                expect(protectionIds.length).to.eql(1);

                const newBalance = await baseToken.balanceOf(owner.address);
                expect(newBalance).to.be.equal(balance.sub(amount));
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
                expect(protectionIds.length).to.eql(1);

                const newBalance = await baseToken.balanceOf(owner.address);
                expect(newBalance).to.be.equal(balance.sub(amount));
            });

            for (const { baseBalance, networkBalance } of POOL_AVAILABLE_SPACE_TEST_ADDITIONAL_BALANCES) {
                it(`pool available space with additional balances of ${baseBalance} and ${networkBalance}`, async () => {
                    await baseToken.approve(converter.address, baseBalance);
                    await networkToken.approve(converter.address, networkBalance);
                    await converter['addLiquidity(address[],uint256[],uint256)'](
                        [baseToken.address, networkToken.address],
                        [baseBalance, networkBalance],
                        1
                    );

                    await baseToken.approve(liquidityProtection.address, TOTAL_SUPPLY);
                    await networkToken.approve(liquidityProtection.address, TOTAL_SUPPLY);

                    const baseTokenAvailableSpace = await liquidityProtection.baseTokenAvailableSpace(
                        poolToken.address
                    );
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

                    const networkTokenAvailableSpace = await liquidityProtection.networkTokenAvailableSpace(
                        poolToken.address
                    );
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
                // test both addLiquidity and addLiquidityFor
                let recipient;
                const checks = [0, 3];
                for (const recipientTmp of checks) {
                    context(recipientTmp === 0 ? 'for self' : 'for another account', async () => {
                        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                            describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                beforeEach(async () => {
                                    await initPool(isETHReserve);
                                    recipient = accounts[recipientTmp];
                                });

                                it('verifies that the caller can add liquidity', async () => {
                                    const totalSupply = await poolToken.totalSupply();
                                    const reserveBalance = await converter.reserveBalance(baseTokenAddress);
                                    const rate = poolTokenRate(totalSupply, reserveBalance);

                                    const reserveAmount = BigNumber.from(1000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        isETHReserve,
                                        owner,
                                        recipient.address
                                    );

                                    // verify protection details
                                    const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                        recipient.address
                                    );
                                    expect(protectionIds.length).to.eql(1);

                                    const expectedPoolAmount = reserveAmount.mul(rate.d).div(rate.n);
                                    const reserve1Balance = await converter.reserveBalance(baseTokenAddress);
                                    const reserve2Balance = await converter.reserveBalance(networkToken.address);

                                    let protection = await liquidityProtectionStore.protectedLiquidity(
                                        protectionIds[0]
                                    );
                                    protection = getProtection(protection);
                                    expect(protection.poolToken).to.eql(poolToken.address);
                                    expect(protection.reserveToken).to.eql(baseTokenAddress);
                                    expect(protection.poolAmount).to.be.equal(expectedPoolAmount);
                                    expect(protection.reserveAmount).to.be.equal(reserveAmount);
                                    expect(protection.reserveRateN).to.be.equal(reserve2Balance);
                                    expect(protection.reserveRateD).to.be.equal(reserve1Balance);
                                    expect(protection.timestamp).to.be.equal(BigNumber.from(now));

                                    // verify balances
                                    const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                        poolToken.address
                                    );
                                    expect(systemBalance).to.be.equal(expectedPoolAmount);

                                    const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                                    expect(walletBalance).to.be.equal(expectedPoolAmount.mul(BigNumber.from(2)));

                                    const govBalance = await govToken.balanceOf(recipient.address);
                                    expect(govBalance).to.be.equal(BigNumber.from(0));

                                    const protectionPoolBalance = await poolToken.balanceOf(
                                        liquidityProtection.address
                                    );
                                    expect(protectionPoolBalance).to.be.equal(BigNumber.from(0));

                                    const protectionBaseBalance = await getBalance(
                                        baseToken,
                                        baseTokenAddress,
                                        liquidityProtection.address
                                    );
                                    expect(protectionBaseBalance).to.be.equal(BigNumber.from(0));

                                    const protectionNetworkBalance = await networkToken.balanceOf(
                                        liquidityProtection.address
                                    );
                                    expect(protectionNetworkBalance).to.be.equal(BigNumber.from(0));
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
                                            recipient.address
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
                                                recipient.address
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
                                            recipient.address
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
                                            recipient.address
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
                                            recipient.address,
                                            value
                                        )
                                    ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
                                });

                                it('should revert when attempting to add liquidity when the pool has less liquidity than the minimum required', async () => {
                                    let reserveAmount = BigNumber.from(10000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        isETHReserve,
                                        owner,
                                        recipient.address
                                    );

                                    await liquidityProtectionSettings.setNetworkTokenMintingLimit(
                                        poolToken.address,
                                        500000
                                    );
                                    await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(100000000);
                                    reserveAmount = BigNumber.from(2000);

                                    await expect(
                                        addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient.address
                                        )
                                    ).to.be.revertedWith('ERR_NOT_ENOUGH_LIQUIDITY');
                                });

                                it('should revert when attempting to add liquidity which will increase the system network token balance above the pool limit', async () => {
                                    let reserveAmount = BigNumber.from(10000);
                                    await addProtectedLiquidity(
                                        poolToken.address,
                                        baseToken,
                                        baseTokenAddress,
                                        reserveAmount,
                                        isETHReserve,
                                        owner,
                                        recipient.address
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
                                            recipient.address
                                        )
                                    ).to.be.revertedWith('ERR_MAX_AMOUNT_REACHED');
                                });
                            });
                        }

                        describe('network token', () => {
                            it('verifies that the caller can add liquidity', async () => {
                                let reserveAmount = BigNumber.from(5000);
                                await baseToken.transfer(governor.address, 5000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    false,
                                    governor,
                                    governor.address
                                );

                                const totalSupply = await poolToken.totalSupply();
                                const reserveBalance = await converter.reserveBalance(networkToken.address);
                                const rate = poolTokenRate(totalSupply, reserveBalance);

                                const prevOwnerBalance = await networkToken.balanceOf(owner.address);
                                const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );
                                const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);

                                reserveAmount = BigNumber.from(1000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    networkToken,
                                    networkToken.address,
                                    reserveAmount,
                                    false,
                                    owner,
                                    recipient.address
                                );

                                // verify protection details
                                const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                    recipient.address
                                );
                                expect(protectionIds.length).to.eql(1);

                                const expectedPoolAmount = reserveAmount.mul(rate.d).div(rate.n);
                                const reserve1Balance = await converter.reserveBalance(networkToken.address);
                                const reserve2Balance = await converter.reserveBalance(baseTokenAddress);

                                let protection = await liquidityProtectionStore.protectedLiquidity(protectionIds[0]);
                                protection = getProtection(protection);
                                expect(protection.poolToken).to.eql(poolToken.address);
                                expect(protection.reserveToken).to.eql(networkToken.address);
                                expect(protection.poolAmount).to.be.equal(expectedPoolAmount);
                                expect(protection.reserveAmount).to.be.equal(reserveAmount);
                                expect(protection.reserveRateN).to.be.equal(reserve2Balance);
                                expect(protection.reserveRateD).to.be.equal(reserve1Balance);
                                expect(protection.timestamp).to.be.equal(BigNumber.from(now));

                                // verify balances
                                const balance = await networkToken.balanceOf(owner.address);
                                expect(balance).to.be.equal(prevOwnerBalance.sub(reserveAmount));

                                const systemBalance = await liquidityProtectionSystemStore.systemBalance(
                                    poolToken.address
                                );
                                expect(systemBalance).to.be.equal(prevSystemBalance.sub(expectedPoolAmount));

                                const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                                expect(walletBalance).to.be.equal(prevWalletBalance);

                                const govBalance = await govToken.balanceOf(recipient.address);
                                expect(govBalance).to.be.equal(reserveAmount);

                                const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                                expect(protectionPoolBalance).to.be.equal(BigNumber.from(0));

                                const protectionBaseBalance = await getBalance(
                                    baseToken,
                                    baseTokenAddress,
                                    liquidityProtection.address
                                );
                                expect(protectionBaseBalance).to.be.equal(BigNumber.from(0));

                                const protectionNetworkBalance = await networkToken.balanceOf(
                                    liquidityProtection.address
                                );
                                expect(protectionNetworkBalance).to.be.equal(BigNumber.from(0));
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
                                        recipient.address
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
                                            recipient.address
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
                                        recipient.address
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
                                        recipient.address,
                                        reserveAmount
                                    )
                                ).to.be.revertedWith('ERR_ETH_AMOUNT_MISMATCH');
                            });

                            it('should revert when attempting to add more liquidity than the system currently owns', async () => {
                                let reserveAmount = BigNumber.from(5000);
                                await baseToken.transfer(governor.address, 5000);
                                await addProtectedLiquidity(
                                    poolToken.address,
                                    baseToken,
                                    baseTokenAddress,
                                    reserveAmount,
                                    false,
                                    governor
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
                                        recipient.address
                                    )
                                ).to.be.revertedWith('SafeMath: subtraction overflow');
                            });
                        });
                    });
                }
            });

            describe('removeLiquidityReturn', () => {
                it('verifies that removeLiquidityReturn returns the correct amount for removing entire protection', async () => {
                    const reserveAmount = BigNumber.from(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                    const protectionId = protectionIds[0];
                    let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                    protection = getProtection(protection);

                    const amount = (
                        await liquidityProtection.removeLiquidityReturn(protectionIds[0], PPM_RESOLUTION, now)
                    )[0];

                    expect(amount).to.be.equal(reserveAmount);
                });

                it('verifies that removeLiquidityReturn returns the correct amount for removing a portion of a protection', async () => {
                    const reserveAmount = BigNumber.from(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                    const protectionId = protectionIds[0];
                    let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                    protection = getProtection(protection);

                    const amount = (await liquidityProtection.removeLiquidityReturn(protectionIds[0], 800000, now))[0];

                    expect(amount).to.be.equal(BigNumber.from(800));
                });

                it('verifies that removeLiquidityReturn can be called even if the average rate is invalid', async () => {
                    const reserveAmount = BigNumber.from(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);

                    await increaseRate(baseTokenAddress);
                    await liquidityProtectionSettings.setAverageRateMaxDeviation(1);
                    await liquidityProtection.removeLiquidityReturn(protectionIds[0], PPM_RESOLUTION, now);
                });

                it('should revert when calling removeLiquidityReturn with zero portion of the liquidity', async () => {
                    await expect(liquidityProtection.removeLiquidityReturn('1234', 0, now)).to.be.revertedWith(
                        'ERR_INVALID_PORTION'
                    );
                });

                it('should revert when calling removeLiquidityReturn with remove more than 100% of the liquidity', async () => {
                    await expect(
                        liquidityProtection.removeLiquidityReturn('1234', PPM_RESOLUTION.add(BigNumber.from(1)), now)
                    ).to.be.revertedWith('ERR_INVALID_PORTION');
                });

                it('should revert when calling removeLiquidityReturn with a date earlier than the protection deposit', async () => {
                    const reserveAmount = BigNumber.from(1000);
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, reserveAmount);
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);

                    await expect(
                        liquidityProtection.removeLiquidityReturn(
                            protectionIds[0],
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

            describe('claim balance', () => {
                beforeEach(async () => {
                    await addProtectedLiquidity(poolToken.address, baseToken, baseTokenAddress, BigNumber.from(20000));
                    await addProtectedLiquidity(
                        poolToken.address,
                        networkToken,
                        networkToken.address,
                        BigNumber.from(2000)
                    );
                    let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
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
                    expect(balance).to.be.equal(prevBalance.add(lockedBalance));

                    const totalLockedBalance = await getLockedBalance(owner.address);
                    expect(totalLockedBalance).to.be.equal(prevTotalLockedBalance.sub(lockedBalance));
                });

                it('verifies that locked balance owner can claim multiple locked tokens if sufficient time has passed', async () => {
                    const timestamp = await getTimestamp(PROTECTION_FULL_PROTECTION);
                    await setTime(timestamp);

                    const prevBalance = await networkToken.balanceOf(owner.address);
                    const prevTotalLockedBalance = await getLockedBalance(owner.address);

                    await liquidityProtection.claimBalance(0, 2);

                    const balance = await networkToken.balanceOf(owner.address);
                    expect(balance).to.be.equal(prevBalance.add(prevTotalLockedBalance));

                    const totalLockedBalance = await getLockedBalance(owner.address);
                    expect(totalLockedBalance).to.be.equal(BigNumber.from(0));

                    const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(owner.address);
                    expect(lockedBalanceCount).to.be.equal(BigNumber.from(0));
                });

                it('verifies that attempting to claim tokens that are still locked does not change any balance', async () => {
                    const prevBalance = await networkToken.balanceOf(owner.address);
                    const prevTotalLockedBalance = await getLockedBalance(owner.address);

                    await liquidityProtection.claimBalance(0, 2);

                    const balance = await networkToken.balanceOf(owner.address);
                    expect(balance).to.be.equal(prevBalance);

                    const totalLockedBalance = await getLockedBalance(owner.address);
                    expect(totalLockedBalance).to.be.equal(prevTotalLockedBalance);
                });

                it('should revert when locked balance owner attempts claim tokens with invalid indices', async () => {
                    await expect(liquidityProtection.claimBalance(2, 3)).to.be.revertedWith('ERR_INVALID_INDICES');
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

                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );
                            const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            const prevBalance = await getBalance(baseToken, baseTokenAddress, owner.address);
                            const prevGovBalance = await govToken.balanceOf(owner.address);

                            let transactionCost = BigNumber.from(0);
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
                            protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            expect(protectionIds.length).to.eql(0);

                            if (isETHReserve) {
                                transactionCost = transactionCost.add(await getTransactionCost(res));
                            }

                            // verify balances
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.be.equal(prevSystemBalance.sub(protection.poolAmount));

                            const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            // double since system balance was also liquidated
                            const delta = protection.poolAmount.mul(BigNumber.from(2));
                            expect(walletBalance).to.be.equal(prevWalletBalance.sub(delta));

                            const balance = await getBalance(baseToken, baseTokenAddress, owner.address);
                            expect(balance).to.be.equal(prevBalance.add(reserveAmount).sub(transactionCost));

                            const govBalance = await govToken.balanceOf(owner.address);
                            expect(govBalance).to.be.equal(prevGovBalance);

                            const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                            expect(protectionPoolBalance).to.be.equal(BigNumber.from(0));

                            const protectionBaseBalance = await getBalance(
                                baseToken,
                                baseTokenAddress,
                                liquidityProtection.address
                            );
                            expect(protectionBaseBalance).to.be.equal(BigNumber.from(0));

                            const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                            expect(protectionNetworkBalance).to.be.equal(BigNumber.from(0));
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

                            const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(
                                poolToken.address
                            );
                            const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            const prevBalance = await getBalance(baseToken, baseTokenAddress, owner.address);
                            const prevGovBalance = await govToken.balanceOf(owner.address);

                            const portion = BigNumber.from(800000);
                            let transactionCost = BigNumber.from(0);
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
                            protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            expect(protectionIds.length).to.eql(1);

                            let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                            protection = getProtection(protection);

                            expect(protection.poolAmount).to.be.equal(prevProtection.poolAmount.div(BigNumber.from(5)));
                            expect(protection.reserveAmount).to.be.equal(
                                prevProtection.reserveAmount.div(BigNumber.from(5))
                            );

                            if (isETHReserve) {
                                transactionCost = transactionCost.add(await getTransactionCost(res));
                            }

                            // verify balances
                            const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                            expect(systemBalance).to.be.equal(
                                prevSystemBalance.sub(prevProtection.poolAmount.sub(protection.poolAmount))
                            );

                            const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                            // double since system balance was also liquidated
                            const delta = prevProtection.poolAmount.sub(protection.poolAmount).mul(BigNumber.from(2));
                            expect(walletBalance).to.be.equal(prevWalletBalance.sub(delta));

                            const balance = await getBalance(baseToken, baseTokenAddress, owner.address);
                            expect(balance).to.be.equal(prevBalance.add(BigNumber.from(800)).sub(transactionCost));

                            const govBalance = await govToken.balanceOf(owner.address);
                            expect(govBalance).to.be.equal(prevGovBalance);

                            const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                            expect(protectionPoolBalance).to.be.equal(BigNumber.from(0));

                            const protectionBaseBalance = await getBalance(
                                baseToken,
                                baseTokenAddress,
                                liquidityProtection.address
                            );
                            expect(protectionBaseBalance).to.be.equal(BigNumber.from(0));

                            const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                            expect(protectionNetworkBalance).to.be.equal(BigNumber.from(0));
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

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            const protectionId = protectionIds[0];

                            expect(await checkpointStore.checkpoint(owner.address)).to.be.equal(BigNumber.from(0));

                            const portion = BigNumber.from(PPM_RESOLUTION);
                            await liquidityProtection.removeLiquidity(protectionId, portion);

                            expect(await checkpointStore.checkpoint(owner.address)).to.be.equal(now);
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

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            const protectionId = protectionIds[0];

                            expect(await checkpointStore.checkpoint(owner.address)).to.be.equal(BigNumber.from(0));

                            const portion = BigNumber.from(500000);
                            for (let i = 1; i < 5; i++) {
                                await setTime(now.add(duration.days(3)));

                                await liquidityProtection.removeLiquidity(protectionId, portion);

                                expect(await checkpointStore.checkpoint(owner.address)).to.be.equal(now);
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
                            let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
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
                            let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            const protectionId = protectionIds[0];

                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expect(
                                liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION.add(BigNumber.from(1)))
                            ).to.be.revertedWith('ERR_INVALID_PORTION');
                        });

                        it('should revert when attempting to remove while the average rate is invalid', async () => {
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
                            let reserveAmount = BigNumber.from(5000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );
                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                            const protectionId = protectionIds[0];

                            await liquidityProtection.setTime(now.add(duration.seconds(1)));
                            await expect(
                                liquidityProtection.connect(governor).removeLiquidity(protectionId, PPM_RESOLUTION)
                            ).to.be.revertedWith('ERR_ACCESS_DENIED');
                        });

                        it('should revert when attempting to remove liquidity from a non whitelisted pool', async () => {
                            let reserveAmount = BigNumber.from(5000);
                            await addProtectedLiquidity(
                                poolToken.address,
                                baseToken,
                                baseTokenAddress,
                                reserveAmount,
                                isETHReserve
                            );

                            const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
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
                        await baseToken.transfer(governor.address, 5000);
                        await addProtectedLiquidity(
                            poolToken.address,
                            baseToken,
                            baseTokenAddress,
                            reserveAmount,
                            false,
                            governor
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

                        const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        const prevWalletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        const prevBalance = await getBalance(networkToken, networkToken.address, owner.address);
                        const prevGovBalance = await govToken.balanceOf(owner.address);

                        await govToken.approve(liquidityProtection.address, protection.reserveAmount);
                        await liquidityProtection.setTime(now.add(duration.seconds(1)));
                        await liquidityProtection.removeLiquidity(protectionIds[0], PPM_RESOLUTION);
                        protectionIds = await liquidityProtectionStore.protectedLiquidityIds(owner.address);
                        expect(protectionIds.length).to.eql(0);

                        // verify balances
                        const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        expect(systemBalance).to.be.equal(prevSystemBalance.add(protection.poolAmount));

                        const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        expect(walletBalance).to.be.equal(prevWalletBalance);

                        const balance = await getBalance(networkToken, networkToken.address, owner.address);
                        expectAlmostEqual(balance, prevBalance.add(reserveAmount));

                        const govBalance = await govToken.balanceOf(owner.address);
                        expect(govBalance).to.be.equal(prevGovBalance.sub(reserveAmount));

                        const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                        expect(protectionPoolBalance).to.be.equal(BigNumber.from(0));

                        const protectionBaseBalance = await getBalance(
                            baseToken,
                            baseTokenAddress,
                            liquidityProtection.address
                        );
                        expect(protectionBaseBalance).to.be.equal(BigNumber.from(0));

                        const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                        expect(protectionNetworkBalance).to.be.equal(BigNumber.from(0));
                    });

                    it('verifies that the caller can remove a portion of a protection', async () => {
                        let reserveAmount = BigNumber.from(5000);
                        await baseToken.transfer(governor.address, 5000);
                        await addProtectedLiquidity(
                            poolToken.address,
                            baseToken,
                            baseTokenAddress,
                            reserveAmount,
                            false,
                            governor
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

                        const prevSystemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
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
                        expect(protectionIds.length).to.eql(1);

                        let protection = await liquidityProtectionStore.protectedLiquidity(protectionId);
                        protection = getProtection(protection);

                        expect(protection.poolAmount).to.be.equal(prevProtection.poolAmount.div(BigNumber.from(5)));
                        expect(protection.reserveAmount).to.be.equal(
                            prevProtection.reserveAmount.div(BigNumber.from(5))
                        );

                        // verify balances
                        const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                        expect(systemBalance).to.be.equal(
                            prevSystemBalance.add(prevProtection.poolAmount.sub(protection.poolAmount))
                        );

                        const walletBalance = await poolToken.balanceOf(liquidityProtectionWallet.address);
                        expect(walletBalance).to.be.equal(prevWalletBalance);

                        const balance = await getBalance(networkToken, networkToken.address, owner.address);
                        expectAlmostEqual(balance, prevBalance.add(BigNumber.from(800)));

                        const govBalance = await govToken.balanceOf(owner.address);
                        expect(govBalance).to.be.equal(prevGovBalance.sub(BigNumber.from(800)));

                        const protectionPoolBalance = await poolToken.balanceOf(liquidityProtection.address);
                        expect(protectionPoolBalance).to.be.equal(BigNumber.from(0));

                        const protectionBaseBalance = await getBalance(
                            baseToken,
                            baseTokenAddress,
                            liquidityProtection.address
                        );
                        expect(protectionBaseBalance).to.be.equal(BigNumber.from(0));

                        const protectionNetworkBalance = await networkToken.balanceOf(liquidityProtection.address);
                        expect(protectionNetworkBalance).to.be.equal(BigNumber.from(0));
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
                                    `(${reserve == 0 ? 'base token' : 'network token'}) with ${
                                        protectionText[protection]
                                    } and ${rateChangeText[rateChange]} ${withFee ? 'with fee' : 'without fee'}`,
                                    () => {
                                        let reserveAmount = BigNumber.from(5000);
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

                                            if (reserve != 0) {
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

                                                [reserveToken, reserveAddress, otherReserveAddress] = [
                                                    networkToken,
                                                    otherReserveAddress,
                                                    reserveAddress
                                                ];
                                            }

                                            if (withFee) {
                                                await generateFee();
                                            }

                                            if (rateChange == 1) {
                                                await increaseRate(reserveAddress);
                                            } else if (rateChange == 2) {
                                                await increaseRate(otherReserveAddress);
                                            }

                                            timestamp = await getTimestamp(protection);
                                            await setTime(timestamp);
                                        });

                                        const isLoss =
                                            (protection == PROTECTION_NO_PROTECTION ||
                                                protection == PROTECTION_PARTIAL_PROTECTION) &&
                                            rateChange != 0;
                                        const shouldLock = reserve == 1 || rateChange == 1; // || (rateChange == 0 && withFee);

                                        if (isLoss) {
                                            it('verifies that removeLiquidityReturn returns an amount that is smaller than the initial amount', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
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

                                            it('verifies that removeLiquidity returns an amount that is smaller than the initial amount', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner.address
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                const prevBalance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner.address
                                                );
                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                                const balance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner.address
                                                );

                                                let lockedBalance = await getLockedBalance(owner.address);
                                                if (reserveAddress == baseTokenAddress) {
                                                    const rate = await getRate(networkToken.address);
                                                    lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                }

                                                expect(balance.sub(prevBalance).add(lockedBalance)).to.be.lt(
                                                    reserveAmount
                                                );
                                            });
                                        } else if (withFee) {
                                            it('verifies that removeLiquidityReturn returns an amount that is larger than the initial amount', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
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

                                            it('verifies that removeLiquidity returns an amount that is larger than the initial amount', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner.address
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                const prevBalance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner.address
                                                );
                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                                const balance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner.address
                                                );

                                                let lockedBalance = await getLockedBalance(owner.address);
                                                if (reserveAddress == baseTokenAddress) {
                                                    const rate = await getRate(networkToken.address);
                                                    lockedBalance = lockedBalance.mul(rate.n).div(rate.d);
                                                }

                                                expect(balance.sub(prevBalance).add(lockedBalance)).to.be.gt(
                                                    reserveAmount
                                                );
                                            });
                                        } else {
                                            it('verifies that removeLiquidityReturn returns an amount that is almost equal to the initial amount', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
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

                                            it('verifies that removeLiquidity returns an amount that is almost equal to the initial amount', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                                    owner.address
                                                );
                                                const protectionId = protectionIds[protectionIds.length - 1];
                                                let protection = await liquidityProtectionStore.protectedLiquidity(
                                                    protectionId
                                                );
                                                protection = getProtection(protection);

                                                const prevBalance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner.address
                                                );
                                                await govToken.approve(
                                                    liquidityProtection.address,
                                                    protection.reserveAmount
                                                );
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);
                                                const balance = await getBalance(
                                                    reserveToken,
                                                    reserveAddress,
                                                    owner.address
                                                );

                                                let lockedBalance = await getLockedBalance(owner.address);
                                                if (reserveAddress == baseTokenAddress) {
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
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
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
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);

                                                const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(
                                                    owner.address
                                                );
                                                expect(lockedBalanceCount).to.be.equal(BigNumber.from(1));

                                                const lockedBalance = await getLockedBalance(owner.address);
                                                expect(lockedBalance).to.be.gt(BigNumber.from(0));
                                            });
                                        } else {
                                            it('verifies that removeLiquidity does not lock network tokens for the caller', async () => {
                                                let protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
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
                                                await liquidityProtection.setTime(timestamp.add(duration.seconds(1)));
                                                await liquidityProtection.removeLiquidity(protectionId, PPM_RESOLUTION);

                                                const lockedBalanceCount = await liquidityProtectionStore.lockedBalanceCount(
                                                    owner.address
                                                );
                                                expect(lockedBalanceCount).to.be.equal(BigNumber.from(0));

                                                const lockedBalance = await getLockedBalance(owner.address);
                                                expect(lockedBalance).to.be.equal(BigNumber.from(0));
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
                    eventsSubscriber = await (await LiquidityProtectionEventsSubscriber).deploy();
                });

                // test both addLiquidity and addLiquidityFor
                let recipient;
                const checks = [0, 3];
                for (const recipientTmp of checks) {
                    context(recipientTmp === 0 ? 'for self' : 'for another account', async () => {
                        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
                            describe(`base token (${isETHReserve ? 'ETH' : 'ERC20'})`, () => {
                                beforeEach(async () => {
                                    await initPool(isETHReserve);
                                    recipient = accounts[recipientTmp];
                                });

                                context('without an events notifier', () => {
                                    it('should not publish adding liquidity events', async () => {
                                        const reserveAmount = BigNumber.from(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient.address
                                        );

                                        expect(await eventsSubscriber.adding()).to.be.false;
                                        expect(await eventsSubscriber.id()).to.be.equal(BigNumber.from(0));
                                        expect(await eventsSubscriber.callStatic.provider()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAnchor()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.reserveToken()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAmount()).to.be.equal(BigNumber.from(0));
                                        expect(await eventsSubscriber.reserveAmount()).to.be.equal(BigNumber.from(0));
                                    });

                                    it('should not publish removing liquidity events', async () => {
                                        const reserveAmount = BigNumber.from(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient.address
                                        );
                                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                            recipient.address
                                        );
                                        const id = protectionIds[0];

                                        await setTime(now.add(BigNumber.from(1)));
                                        await liquidityProtection
                                            .connect(recipient)
                                            .removeLiquidity(id, PPM_RESOLUTION);

                                        expect(await eventsSubscriber.adding()).to.be.false;
                                        expect(await eventsSubscriber.id()).to.be.equal(BigNumber.from(0));
                                        expect(await eventsSubscriber.callStatic.provider()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAnchor()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.reserveToken()).to.eql(ZERO_ADDRESS);
                                        expect(await eventsSubscriber.poolAmount()).to.be.equal(BigNumber.from(0));
                                        expect(await eventsSubscriber.reserveAmount()).to.be.equal(BigNumber.from(0));
                                    });
                                });

                                context('with an events notifier', () => {
                                    beforeEach(async () => {
                                        await liquidityProtectionSettings
                                            .connect(owner)
                                            .addSubscriber(eventsSubscriber.address);
                                    });

                                    it('should publish adding liquidity events', async () => {
                                        const totalSupply = await poolToken.totalSupply();
                                        const reserveBalance = await converter.reserveBalance(baseTokenAddress);
                                        const rate = poolTokenRate(totalSupply, reserveBalance);

                                        const reserveAmount = BigNumber.from(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient.address
                                        );

                                        expect(await eventsSubscriber.adding()).to.be.true;
                                        expect(await eventsSubscriber.id()).to.be.equal(BigNumber.from(0));
                                        expect(await eventsSubscriber.callStatic.provider()).to.eql(recipient.address);
                                        expect(await eventsSubscriber.poolAnchor()).to.eql(poolToken.address);
                                        expect(await eventsSubscriber.reserveToken()).to.eql(baseTokenAddress);
                                        expect(await eventsSubscriber.poolAmount()).to.be.equal(
                                            reserveAmount.mul(rate.d).div(rate.n)
                                        );
                                        expect(await eventsSubscriber.reserveAmount()).to.be.equal(reserveAmount);
                                    });

                                    it('should publish removing liquidity events', async () => {
                                        const totalSupply = await poolToken.totalSupply();
                                        const reserveBalance = await converter.reserveBalance(baseTokenAddress);
                                        const rate = poolTokenRate(totalSupply, reserveBalance);

                                        const reserveAmount = BigNumber.from(1000);
                                        await addProtectedLiquidity(
                                            poolToken.address,
                                            baseToken,
                                            baseTokenAddress,
                                            reserveAmount,
                                            isETHReserve,
                                            owner,
                                            recipient.address
                                        );
                                        const protectionIds = await liquidityProtectionStore.protectedLiquidityIds(
                                            recipient.address
                                        );
                                        const id = protectionIds[0];

                                        await setTime(now.add(BigNumber.from(1)));

                                        await liquidityProtection
                                            .connect(recipient)
                                            .removeLiquidity(id, PPM_RESOLUTION);

                                        expect(await eventsSubscriber.adding()).to.be.false;
                                        expect(await eventsSubscriber.id()).to.be.equal(id);
                                        expect(await eventsSubscriber.callStatic.provider()).to.eql(recipient.address);
                                        expect(await eventsSubscriber.poolAnchor()).to.eql(poolToken.address);
                                        expect(await eventsSubscriber.reserveToken()).to.eql(baseTokenAddress);
                                        expect(await eventsSubscriber.poolAmount()).to.be.equal(
                                            reserveAmount.mul(rate.d).div(rate.n)
                                        );
                                        expect(await eventsSubscriber.reserveAmount()).to.be.equal(reserveAmount);
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

///////////////////////
// Utility functions //
///////////////////////

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
        return liquidityProtection.connect(from).addLiquidityFor(recipient, poolTokenAddress, tokenAddress, amount, {
            value: value
        });
    }

    return liquidityProtection.connect(from).addLiquidity(poolTokenAddress, tokenAddress, amount, { value: value });
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
    return { n: reserveBalance.mul(BigNumber.from('2')), d: poolSupply };
};

const getBalance = async (token, address, account) => {
    if (address === ETH_RESERVE_ADDRESS) {
        return ethers.provider.getBalance(account);
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
        expect(error.lte(maxError)).to.be.true;
    }
};

const convert = async (path, amount, minReturn) => {
    let token;
    if (path[0] == baseTokenAddress) {
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
    const prevBalance = await networkToken.balanceOf(owner.address);

    let amount = RESERVE1_AMOUNT.div(BigNumber.from(2));
    await convert([baseTokenAddress, poolToken.address, networkToken.address], amount, 1);

    const balance = await networkToken.balanceOf(owner.address);

    amount = balance.sub(prevBalance);
    await convert([networkToken.address, poolToken.address, baseTokenAddress], amount, 1);

    await converter.setConversionFee(0);
};

const getRate = async (reserveAddress) => {
    const reserve1Balance = await converter.reserveBalance(baseTokenAddress);
    const reserve2Balance = await converter.reserveBalance(networkToken.address);
    if (reserveAddress == baseTokenAddress) {
        return { n: reserve2Balance, d: reserve1Balance };
    }

    return { n: reserve1Balance, d: reserve2Balance };
};

const increaseRate = async (reserveAddress) => {
    let sourceAddress;
    if (reserveAddress == baseTokenAddress) {
        sourceAddress = networkToken.address;
    } else {
        sourceAddress = baseTokenAddress;
    }

    let path = [sourceAddress, poolToken.address, reserveAddress];
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
