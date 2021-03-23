const { expect } = require('chai');
const { registry, roles } = require('./helpers/Constants');
const { BigNumber } = require('ethers');

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
const NetworkSettings = ethers.getContractFactory('NetworkSettings');

const INITIAL_AMOUNT = 1000000;

function decimalToInteger(value, decimals) {
    const parts = [...value.split('.'), ''];
    return parts[0] + parts[1].padEnd(decimals, '0');
}

function percentageToPPM(value) {
    return decimalToInteger(value.replace('%', ''), 4);
}

const FULL_PPM = percentageToPPM('100%');
const HALF_PPM = percentageToPPM('50%');

let bancorNetwork;
let liquidityProtectionSettings;
let liquidityProtectionStore;
let liquidityProtectionStats;
let liquidityProtectionSystemStore;
let liquidityProtectionWallet;
let liquidityProtection;
let reserveToken1;
let reserveToken2;
let poolToken;
let converter;
let time;

let owner;
let governor;

describe('LiquidityProtectionAverageRate', () => {
    for (const converterType of [1, 3]) {
        describe(`${converterType === 1 ? 'LiquidityPoolV1Converter' : 'StandardPoolConverter'}`, () => {
            const convert = async (sourceToken, targetToken, amount) => {
                await sourceToken.approve(bancorNetwork.address, amount);
                const path = [sourceToken.address, poolToken.address, targetToken.address];
                await bancorNetwork.convertByPath2(path, amount, 1, ethers.constants.AddressZero);
            };

            before(async () => {
                accounts = await ethers.getSigners();

                owner = accounts[0];
                governor = accounts[1];

                const contractRegistry = await (await ContractRegistry).deploy();
                const converterRegistry = await (await ConverterRegistry).deploy(contractRegistry.address);
                const converterRegistryData = await (await ConverterRegistryData).deploy(contractRegistry.address);

                bancorNetwork = await (await BancorNetwork).deploy(contractRegistry.address);

                const networkToken = await (await DSToken).deploy('BNT', 'BNT', 18);
                const networkTokenGovernance = await (await TokenGovernance).deploy(networkToken.address);
                await networkTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await networkToken.transferOwnership(networkTokenGovernance.address);
                await networkTokenGovernance.acceptTokenOwnership();

                const govToken = await (await DSToken).deploy('vBNT', 'vBNT', 18);
                const govTokenGovernance = await (await TokenGovernance).deploy(govToken.address);
                await govTokenGovernance.grantRole(ROLE_GOVERNOR, governor.address);
                await govToken.transferOwnership(govTokenGovernance.address);
                await govTokenGovernance.acceptTokenOwnership();

                liquidityProtectionSettings = await (await LiquidityProtectionSettings).deploy(
                    networkToken.address,
                    contractRegistry.address
                );
                await liquidityProtectionSettings.setMinNetworkCompensation(BigNumber.from(3));
                const checkpointStore = await (await CheckpointStore).deploy();

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
                await liquidityProtectionStore.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptStoreOwnership();
                await liquidityProtectionWallet.transferOwnership(liquidityProtection.address);
                await liquidityProtection.acceptWalletOwnership();
                await checkpointStore.connect(owner).grantRole(ROLE_OWNER, liquidityProtection.address);
                await networkTokenGovernance.connect(governor).grantRole(ROLE_MINTER, liquidityProtection.address);
                await govTokenGovernance.connect(governor).grantRole(ROLE_MINTER, liquidityProtection.address);

                const liquidityPoolV1ConverterFactory = await (await LiquidityPoolV1ConverterFactory).deploy();
                const standardPoolConverterFactory = await (await StandardPoolConverterFactory).deploy();
                const converterFactory = await (await ConverterFactory).deploy();
                await converterFactory.registerTypedConverterFactory(liquidityPoolV1ConverterFactory.address);
                await converterFactory.registerTypedConverterFactory(standardPoolConverterFactory.address);

                const bancorFormula = await (await BancorFormula).deploy();
                await bancorFormula.init();

                const networkSettings = await (await NetworkSettings).deploy(owner.address, 0);

                await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
                await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
                await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);
                await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);
                await contractRegistry.registerAddress(registry.NETWORK_SETTINGS, networkSettings.address);

                await converterRegistry.enableTypeChanging(false);

                reserveToken1 = await (await DSToken).deploy('RT1', 'RT1', 18);
                reserveToken2 = await (await DSToken).deploy('RT2', 'RT2', 18);
                await reserveToken1.issue(owner.address, BigNumber.from('1'.padEnd(30, '0')));
                await reserveToken2.issue(owner.address, BigNumber.from('1'.padEnd(30, '0')));

                await converterRegistry.newConverter(
                    converterType,
                    'PT',
                    'PT',
                    18,
                    FULL_PPM,
                    [reserveToken1.address, reserveToken2.address],
                    [HALF_PPM, HALF_PPM]
                );
                poolToken = await (await DSToken).attach(await converterRegistry.getAnchor(0));
                if (converterType === 1) {
                    converter = (await LiquidityPoolV1Converter).attach(await poolToken.owner());
                } else {
                    converter = (await StandardPoolConverter).attach(await poolToken.owner());
                }

                await converter.acceptOwnership();
                time = await converter.currentTime();
            });

            for (let minutesElapsed = 1; minutesElapsed <= 10; minutesElapsed += 1) {
                for (let convertPortion = 1; convertPortion <= 10; convertPortion += 1) {
                    for (let maxDeviation = 1; maxDeviation <= 10; maxDeviation += 1) {
                        it(`minutesElapsed = ${minutesElapsed}, convertPortion = ${convertPortion}%, maxDeviation = ${maxDeviation}%`, async () => {
                            await liquidityProtectionSettings.setAverageRateMaxDeviation(
                                percentageToPPM(`${maxDeviation}%`)
                            );
                            await reserveToken1.approve(converter.address, INITIAL_AMOUNT);
                            await reserveToken2.approve(converter.address, INITIAL_AMOUNT);

                            if (converterType === 1) {
                                await converter.addLiquidity(
                                    [reserveToken1.address, reserveToken2.address],
                                    [INITIAL_AMOUNT, INITIAL_AMOUNT],
                                    1
                                );
                            } else {
                                await converter['addLiquidity(address[],uint256[],uint256)'](
                                    [reserveToken1.address, reserveToken2.address],
                                    [INITIAL_AMOUNT, INITIAL_AMOUNT],
                                    1
                                );
                            }
                            await convert(reserveToken1, reserveToken2, (INITIAL_AMOUNT * convertPortion) / 100);
                            time = time.add(BigNumber.from(minutesElapsed * 60));
                            await converter.setTime(time);
                            const averageRate = await converter.recentAverageRate(reserveToken1.address);
                            const actualRate = await Promise.all(
                                [reserveToken2, reserveToken1].map((reserveToken) =>
                                    reserveToken.balanceOf(converter.address)
                                )
                            );
                            const min = Decimal(actualRate[0].toString())
                                .div(actualRate[1].toString())
                                .mul(100 - maxDeviation)
                                .div(100);
                            const max = Decimal(actualRate[0].toString())
                                .div(actualRate[1].toString())
                                .mul(100)
                                .div(100 - maxDeviation);
                            const mid = Decimal(averageRate[0].toString()).div(averageRate[1].toString());
                            if (min.lte(mid) && mid.lte(max)) {
                                const reserveTokenRate = await liquidityProtection.averageRateTest(
                                    poolToken.address,
                                    reserveToken1.address
                                );
                                expect(reserveTokenRate[0]).to.be.equal(averageRate[0]);
                                expect(reserveTokenRate[1]).to.be.equal(averageRate[1]);
                            } else {
                                await expect(
                                    liquidityProtection.averageRateTest(poolToken.address, reserveToken1.address)
                                ).to.be.revertedWith('ERR_INVALID_RATE');
                            }
                            if (converterType === 1) {
                                await converter.removeLiquidity(
                                    await poolToken.balanceOf(owner.address),
                                    [reserveToken1.address, reserveToken2.address],
                                    [1, 1]
                                );
                            } else {
                                await converter['removeLiquidity(uint256,address[],uint256[])'](
                                    await poolToken.balanceOf(owner.address),
                                    [reserveToken1.address, reserveToken2.address],
                                    [1, 1]
                                );
                            }
                        });
                    }
                }
            }
        });
    }
});
