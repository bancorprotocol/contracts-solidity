const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { BN, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { registry, roles } = require('./helpers/Constants');
const Decimal = require('decimal.js');

const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const { ROLE_OWNER, ROLE_MINTED_TOKENS_ADMIN, ROLE_GOVERNOR, ROLE_MINTER } = roles;

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
const TokenGovernance = contract.fromArtifact('TestTokenGovernance');
const CheckpointStore = contract.fromArtifact('TestCheckpointStore');
const LiquidityProtection = contract.fromArtifact('TestLiquidityProtection');

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
                await bancorNetwork.convertByPath(path, amount, 1, ZERO_ADDRESS, ZERO_ADDRESS, 0);
            };

            const increaseRate = async (sourceToken, targetToken) => {
                const sourceBalance = await converter.reserveBalance(sourceToken.address);
                await convert(sourceToken, targetToken, sourceBalance.div(new BN(100)));
            };

            const generateFee = async (conversionFee, sourceToken, targetToken) => {
                await converter.setConversionFee(conversionFee);
                const prevBalance = await targetToken.balanceOf(owner);
                const sourceBalance = await converter.reserveBalance(sourceToken.address);
                await convert(sourceToken, targetToken, sourceBalance.div(new BN(100)));
                const currBalance = await targetToken.balanceOf(owner);
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

            const owner = defaultSender;

            before(async () => {
                contractRegistry = await ContractRegistry.new();
                converterRegistry = await ConverterRegistry.new(contractRegistry.address);
                bancorNetwork = await BancorNetwork.new(contractRegistry.address);

                const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

                const liquidityPoolV1ConverterFactory = await LiquidityPoolV1ConverterFactory.new();
                const standardPoolConverterFactory = await StandardPoolConverterFactory.new();
                const converterFactory = await ConverterFactory.new();
                await converterFactory.registerTypedConverterFactory(liquidityPoolV1ConverterFactory.address);
                await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

                const bancorFormula = await BancorFormula.new();
                await bancorFormula.init();

                await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
                await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
                await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

                await converterRegistry.enableTypeChanging(false);
            });

            beforeEach(async () => {
                const governor = accounts[1];

                baseToken = await DSToken.new('TKN', 'TKN', 18);
                await baseToken.issue(owner, new BN('1'.padEnd(40, '0')));

                networkToken = await DSToken.new('BNT', 'BNT', 18);
                await networkToken.issue(owner, new BN('1'.padEnd(40, '0')));
                const networkTokenGovernance = await TokenGovernance.new(networkToken.address);
                await networkTokenGovernance.grantRole(ROLE_GOVERNOR, governor);
                await networkToken.transferOwnership(networkTokenGovernance.address);
                await networkTokenGovernance.acceptTokenOwnership();

                govToken = await DSToken.new('vBNT', 'vBNT', 18);
                const govTokenGovernance = await TokenGovernance.new(govToken.address);
                await govTokenGovernance.grantRole(ROLE_GOVERNOR, governor);
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
                const poolTokenAddress = await converterRegistry.getAnchor(anchorCount.sub(new BN(1)));
                poolToken = await DSToken.at(poolTokenAddress);
                const converterAddress = await poolToken.owner();
                if (converterType === 1) {
                    converter = await LiquidityPoolV1Converter.at(converterAddress);
                } else {
                    converter = await StandardPoolConverter.at(converterAddress);
                }
                await converter.acceptOwnership();

                checkpointStore = await CheckpointStore.new({ from: owner });

                liquidityProtectionSettings = await LiquidityProtectionSettings.new(
                    networkToken.address,
                    contractRegistry.address
                );
                await liquidityProtectionSettings.setMinNetworkCompensation(new BN(3));

                liquidityProtectionStore = await LiquidityProtectionStore.new();
                liquidityProtectionStats = await LiquidityProtectionStats.new();
                liquidityProtectionSystemStore = await LiquidityProtectionSystemStore.new();
                liquidityProtectionWallet = await TokenHolder.new();
                liquidityProtection = await LiquidityProtection.new([
                    liquidityProtectionSettings.address,
                    liquidityProtectionStore.address,
                    liquidityProtectionStats.address,
                    liquidityProtectionSystemStore.address,
                    liquidityProtectionWallet.address,
                    networkTokenGovernance.address,
                    govTokenGovernance.address,
                    checkpointStore.address
                ]);

                await liquidityProtectionSettings.grantRole(ROLE_MINTED_TOKENS_ADMIN, liquidityProtection.address, {
                    from: owner
                });
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

                await setTime(new BN(1));

                await liquidityProtectionSettings.addPoolToWhitelist(poolToken.address);
                await liquidityProtectionSettings.setMinNetworkTokenLiquidityForMinting(0);
                await liquidityProtectionSettings.setNetworkTokenMintingLimit(poolToken.address, MAX_UINT256);
            });

            for (const config of CONFIGURATIONS) {
                for (const numOfDays of NUM_OF_DAYS) {
                    const timestamp = numOfDays * 24 * 60 * 60 + 1;
                    for (const decimals of DECIMAL_COMBINATIONS) {
                        const amounts = decimals.map((n) => new BN(10).pow(new BN(n)));

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
                            await converter.addLiquidity(
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
                            expect(error).to.be.empty(error);
                        });
                    }
                }
            }

            for (const config of CONFIGURATIONS) {
                for (const numOfDays of NUM_OF_DAYS) {
                    const timestamp = numOfDays * 24 * 60 * 60 + 1;
                    for (const decimals of DECIMAL_COMBINATIONS) {
                        const amounts = decimals.map((n) => new BN(10).pow(new BN(n)));

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
                            await converter.addLiquidity(
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
                            expect(error).to.be.empty(error);
                        });
                    }
                }
            }
        });
    }
});
