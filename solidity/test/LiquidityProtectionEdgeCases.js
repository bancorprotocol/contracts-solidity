const { expect } = require('chai');

const { BigNumber } = require('ethers');

const { registry, roles, MAX_UINT256, ZERO_ADDRESS } = require('./helpers/Constants');
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
const TokenGovernance = ethers.getContractFactory('TestTokenGovernance');
const CheckpointStore = ethers.getContractFactory('TestCheckpointStore');
const LiquidityProtection = ethers.getContractFactory('TestLiquidityProtection');

const f = (a, b) => [].concat(...a.map((d) => b.map((e) => [].concat(d, e))));
const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);

function decimalToInteger(value, decimals) {
    const parts = [...value.split('.'), ''];
    return parts[0] + parts[1].padEnd(decimals, '0');
}

function percentageToPPM(value) {
    return decimalToInteger(value.replace('%', ''), 4);
}

function condOrAlmostEqual(cond, actual, expected, maxError) {
    if (!cond) {
        const error = Decimal(actual.toString()).div(expected.toString()).sub(1).abs();
        if (error.gt(maxError)) {
            return `error = ${error.toFixed(maxError.length)}`;
        }
    }
    return '';
}

const CONFIGURATIONS = [
    { increaseRate: false, generateFee: false },
    { increaseRate: false, generateFee: true },
    { increaseRate: true, generateFee: false }
];

const NUM_OF_DAYS = [30, 100];
const DECIMAL_COMBINATIONS = cartesian([12, 24], [12, 24], [15, 21], [15, 21]);

const FULL_PPM = percentageToPPM('100%');
const HALF_PPM = percentageToPPM('50%');
const FEE_PPM = percentageToPPM('1%');

let contractRegistry;
let converterRegistry;
let bancorNetwork;
let baseToken;
let networkToken;
let govToken;
let checkpointStore;
let poolToken;
let converter;
let liquidityProtectionSettings;
let liquidityProtectionStore;
let liquidityProtectionStats;
let liquidityProtectionSystemStore;
let liquidityProtectionWallet;
let liquidityProtection;

let owner;

describe('LiquidityProtectionEdgeCases', () => {
    for (const converterType of [1, 3]) {
        describe(`${converterType === 1 ? 'LiquidityPoolV1Converter' : 'StandardPoolConverter'}`, () => {
            const addProtectedLiquidity = async (token, amount) => {
                await token.approve(liquidityProtection.address, amount);
                await liquidityProtection.addLiquidity(poolToken.address, token.address, amount);
            };

            const convert = async (sourceToken, targetToken, amount) => {
                await sourceToken.approve(bancorNetwork.address, amount);
                const path = [sourceToken.address, poolToken.address, targetToken.address];
                await bancorNetwork.convertByPath2(path, amount, 1, ZERO_ADDRESS);
            };

            const increaseRate = async (sourceToken, targetToken) => {
                const sourceBalance = await converter.reserveBalance(sourceToken.address);
                await convert(sourceToken, targetToken, sourceBalance.div(BigNumber.from(100)));
            };

            const generateFee = async (conversionFee, sourceToken, targetToken) => {
                await converter.setConversionFee(conversionFee);
                const prevBalance = await targetToken.balanceOf(owner.address);
                const sourceBalance = await converter.reserveBalance(sourceToken.address);
                await convert(sourceToken, targetToken, sourceBalance.div(BigNumber.from(100)));
                const currBalance = await targetToken.balanceOf(owner.address);
                await convert(targetToken, sourceToken, currBalance.sub(prevBalance));
                await converter.setConversionFee(0);
            };

            const getNetworkTokenMaxAmount = async () => {
                const totalSupply = await poolToken.totalSupply();
                const reserveBalance = await converter.reserveBalance(networkToken.address);
                const systemBalance = await liquidityProtectionSystemStore.systemBalance(poolToken.address);
                return systemBalance.mul(reserveBalance).div(totalSupply);
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

                contractRegistry = await (await ContractRegistry).deploy();
                converterRegistry = await (await ConverterRegistry).deploy(contractRegistry.address);
                bancorNetwork = await (await BancorNetwork).deploy(contractRegistry.address);

                const converterRegistryData = await (await ConverterRegistryData).deploy(contractRegistry.address);

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
                baseToken = await (await DSToken).deploy('TKN', 'TKN', 18);
                await baseToken.issue(owner.address, BigNumber.from('1'.padEnd(40, '0')));

                networkToken = await (await DSToken).deploy('BNT', 'BNT', 18);
                await networkToken.issue(owner.address, BigNumber.from('1'.padEnd(40, '0')));
                const networkTokenGovernance = await (await TokenGovernance).deploy(networkToken.address);
                await networkTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await networkToken.transferOwnership(networkTokenGovernance.address);
                await networkTokenGovernance.acceptTokenOwnership();

                govToken = await (await DSToken).deploy('vBNT', 'vBNT', 18);
                const govTokenGovernance = await (await TokenGovernance).deploy(govToken.address);
                await govTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await govToken.transferOwnership(govTokenGovernance.address);
                await govTokenGovernance.acceptTokenOwnership();

                await converterRegistry.newConverter(
                    converterType,
                    'PT',
                    'PT',
                    18,
                    FULL_PPM,
                    [baseToken.address, networkToken.address],
                    [HALF_PPM, HALF_PPM]
                );
                const anchorCount = await converterRegistry.getAnchorCount();
                const poolTokenAddress = await converterRegistry.getAnchor(anchorCount.sub(BigNumber.from(1)));
                poolToken = await (await DSToken).attach(poolTokenAddress);
                const converterAddress = await poolToken.owner();
                if (converterType === 1) {
                    converter = await (await LiquidityPoolV1Converter).attach(converterAddress);
                } else {
                    converter = await (await StandardPoolConverter).attach(converterAddress);
                }
                await converter.acceptOwnership();

                checkpointStore = await (await CheckpointStore).deploy();

                liquidityProtectionSettings = await (await LiquidityProtectionSettings).deploy(
                    networkToken.address,
                    contractRegistry.address
                );
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

                await liquidityProtectionStats.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await liquidityProtectionSystemStore.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await checkpointStore.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await liquidityProtectionStore.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptStoreOwnership();
                await liquidityProtectionWallet.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptWalletOwnership();
                await networkTokenGovernance.connect(governor).grantRole(ROLE_MINTER, liquidityProtection.address);
                await govTokenGovernance.connect(governor).grantRole(ROLE_MINTER, liquidityProtection.address);

                await setTime(BigNumber.from(1));

                await liquidityProtectionSettings.addPoolToWhitelist(poolToken.address);
                await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(0);
                await liquidityProtectionSettings.setNetworkTokenMintingLimit(poolToken.address, MAX_UINT256);
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
                                    { 1: '0.0', 3: '0.00000004' }[converterType]
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

                        it(`base token, increaseRate = ${config.increaseRate}, generateFee = ${config.generateFee}, numOfDays = ${numOfDays}, decimals = ${decimals}`, async () => {
                            await baseToken.approve(converter.address, amounts[0]);
                            await networkToken.approve(converter.address, amounts[1]);
                            await converter['addLiquidity(address[],uint256[],uint256)'](
                                [baseToken.address, networkToken.address],
                                [amounts[0], amounts[1]],
                                1
                            );

                            await addProtectedLiquidity(baseToken, amounts[2]);
                            const networkTokenMaxAmount = await getNetworkTokenMaxAmount();
                            if (amounts[3].gt(networkTokenMaxAmount)) amounts[3] = networkTokenMaxAmount;
                            await addProtectedLiquidity(networkToken, amounts[3]);

                            if (config.increaseRate) {
                                await increaseRate(networkToken, baseToken);
                            }

                            if (config.generateFee) {
                                await generateFee(FEE_PPM, baseToken, networkToken);
                            }

                            await setTime(timestamp);
                            const actual = await liquidityProtection.removeLiquidityReturn(0, FULL_PPM, timestamp);
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
                                    { 1: '0.0', 3: '0.00000004' }[converterType]
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

                        it(`network token, increaseRate = ${config.increaseRate}, generateFee = ${config.generateFee}, numOfDays = ${numOfDays}, decimals = ${decimals}`, async () => {
                            await baseToken.approve(converter.address, amounts[0]);
                            await networkToken.approve(converter.address, amounts[1]);
                            await converter['addLiquidity(address[],uint256[],uint256)'](
                                [baseToken.address, networkToken.address],
                                [amounts[0], amounts[1]],
                                1
                            );

                            await addProtectedLiquidity(baseToken, amounts[2]);
                            const networkTokenMaxAmount = await getNetworkTokenMaxAmount();
                            if (amounts[3].gt(networkTokenMaxAmount)) amounts[3] = networkTokenMaxAmount;
                            await addProtectedLiquidity(networkToken, amounts[3]);

                            if (config.increaseRate) {
                                await increaseRate(baseToken, networkToken);
                            }

                            if (config.generateFee) {
                                await generateFee(FEE_PPM, networkToken, baseToken);
                            }

                            await setTime(timestamp);
                            const actual = await liquidityProtection.removeLiquidityReturn(1, FULL_PPM, timestamp);
                            const error = test(actual[0], amounts[3]);
                            expect(error).to.be.empty;
                        });
                    }
                }
            }
        });
    }
});
