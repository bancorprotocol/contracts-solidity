import { expect } from 'chai';
import { BigNumber } from 'ethers';

const ConverterHelper = require('./helpers/Converter');

const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS, registry } = require('./helpers/Constants');

const Contracts = require('./helpers/Contracts');

const CONVERSION_FEE = BigNumber.from(1000);
const MAX_CONVERSION_FEE = BigNumber.from(30000);
const RESERVE1_BALANCE = BigNumber.from(5000);
const RESERVE2_BALANCE = BigNumber.from(8000);
const TOKEN_TOTAL_SUPPLY = BigNumber.from(20000);

const LEGACY_VERSIONS = [9, 10, 11, 23, 45];

let contractRegistry;
let converterFactory;
let deployer;
let reserveToken1;
let reserveToken2;

describe('ConverterUpgrader', () => {
    const initWith2Reserves = async (type, deployer, version, activate) => {
        const anchor = await Contracts.DSToken.deploy('Token1', 'TKN1', 0);
        const converter = await ConverterHelper.new(
            type,
            anchor.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE,
            reserveToken1.address,
            500000,
            version
        );
        const upgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        if (version && version < 45) {
            await converter.addConnector(reserveToken2.address, 500000, false);
        } else {
            await converter.addReserve(reserveToken2.address, 500000);
        }

        await converter.setConversionFee(CONVERSION_FEE);
        await anchor.issue(deployer.address, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }
        return [upgrader, converter];
    };

    const initType1With2Reserves = async (deployer, version, activate) => {
        return await initWith2Reserves(1, deployer, version, activate);
    };

    const initType3With2Reserves = async (deployer, version, activate) => {
        return await initWith2Reserves(3, deployer, version, activate);
    };

    const initWithETHReserve = async (type, deployer, version, activate) => {
        if (version) {
            throw new Error(`Converter version ${version} does not support ETH-reserve`);
        }
        const anchor = await Contracts.DSToken.deploy('Token1', 'TKN1', 0);
        const converter = await ConverterHelper.new(
            type,
            anchor.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE,
            reserveToken1.address,
            500000
        );

        const upgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        await converter.addReserve(NATIVE_TOKEN_ADDRESS, 500000);
        await converter.setConversionFee(CONVERSION_FEE);
        await anchor.issue(deployer.address, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await deployer.sendTransaction({ to: converter.address, value: RESERVE2_BALANCE });

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initType1WithETHReserve = async (deployer, version, activate) => {
        return await initWithETHReserve(1, deployer, version, activate);
    };

    const initType3WithETHReserve = async (deployer, version, activate) => {
        return await initWithETHReserve(3, deployer, version, activate);
    };

    const upgradeConverter = async (upgrader, converter, options = {}) => {
        let res;
        // For versions 11 or higher, we just call upgrade on the converter.
        if (converter.upgrade) {
            res = await converter.connect(deployer).upgrade({ ...options });
        } else {
            // For previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
            // then accept ownership of the new and old converter. The end results should be the same.
            await converter.transferOwnership(upgrader.address);
            res = await upgrader.connect(deployer).upgradeOld(converter.address, ethers.utils.formatBytes32String(''), {
                ...options
            });
            await converter.acceptOwnership();
        }

        const events = await upgrader.queryFilter('ConverterUpgrade', res.blockNumber, res.blockNumber);

        expect(events.length).to.be.at.most(1);

        return ConverterHelper.at(events[0].args._newConverter);
    };

    const getConverterState = async (converter) => {
        const token = await converter.token();
        const anchor = await Contracts.DSToken.attach(token);
        const state = {
            owner: await converter.owner(),
            token,
            tokenOwner: await anchor.owner(),
            newOwner: await converter.newOwner(),
            conversionFee: await converter.conversionFee(),
            maxConversionFee: await converter.maxConversionFee(),
            reserveTokenCount: await converter.connectorTokenCount(),
            reserveTokens: []
        };

        for (let i = 0; i < state.reserveTokenCount; i++) {
            const token = await converter.connectorTokens(i);
            state.reserveTokens[i] = {
                token,
                balance: await converter.getConnectorBalance(token)
            };
        }

        return state;
    };

    before(async () => {
        accounts = await ethers.getSigners();

        deployer = accounts[0];

        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await Contracts.ContractRegistry.deploy();

        const bancorFormula = await Contracts.BancorFormula.deploy();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        converterFactory = await Contracts.ConverterFactory.deploy();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        await converterFactory.registerTypedConverterFactory(
            (await Contracts.LiquidityPoolV1ConverterFactory.deploy()).address
        );
        await converterFactory.registerTypedConverterFactory(
            (await Contracts.StandardPoolConverterFactory.deploy()).address
        );
    });

    beforeEach(async () => {
        reserveToken1 = await Contracts.TestStandardToken.deploy('ERC Token 1', 'ERC1', 18, RESERVE1_BALANCE);
        reserveToken2 = await Contracts.TestStandardToken.deploy('ERC Token 2', 'ERC2', 18, RESERVE2_BALANCE);
    });

    const initFuncs = [
        initType1With2Reserves,
        initType3With2Reserves,
        initType1WithETHReserve,
        initType3WithETHReserve
    ];

    const f = (a, b) => [].concat(...a.map((d) => b.map((e) => [].concat(d, e))));
    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
    const product = cartesian(initFuncs, [...LEGACY_VERSIONS, null], [false, true]);
    const combinations = product.filter(
        ([init, version]) =>
            !(init === initType1WithETHReserve && version) && !(init === initType3WithETHReserve && version)
    );

    for (const [init, version, activate] of combinations) {
        describe(`${init.name}(version = ${version || 'latest'}, activate = ${activate}):`, () => {
            it('should upgrade successfully', async () => {
                let reserveTokens;

                switch (init) {
                    case initType1With2Reserves:
                    case initType3With2Reserves:
                        reserveTokens = [reserveToken1.address, reserveToken2.address];
                        break;
                    case initType1WithETHReserve:
                    case initType3WithETHReserve:
                        reserveTokens = [reserveToken1.address, NATIVE_TOKEN_ADDRESS];
                        break;
                }

                // Initial reserve balances are synced when the converter is being activated or during transfer to
                // the ERC20 reserve, for older converters.
                const olderConverter = version && version < 28;

                const reserveBalances = [
                    activate || olderConverter ? RESERVE1_BALANCE : BigNumber.from(0),
                    activate || olderConverter ? RESERVE2_BALANCE : BigNumber.from(0)
                ];

                // Token balances are always migrated during an upgrade, regardless of the reported reserve balance by
                // the original converter.
                const upgradedReserveBalances = [
                    activate ? RESERVE1_BALANCE : BigNumber.from(0),
                    activate ? RESERVE2_BALANCE : BigNumber.from(0)
                ];

                const [upgrader, oldConverter] = await init(deployer, version, activate);
                const oldConverterInitialState = await getConverterState(oldConverter);
                expect(oldConverterInitialState.owner).to.be.eql(deployer.address);
                expect(oldConverterInitialState.newOwner).to.be.eql(ZERO_ADDRESS);
                expect(oldConverterInitialState.tokenOwner).to.be.eql(
                    activate ? oldConverter.address : deployer.address
                );
                expect(oldConverterInitialState.conversionFee).to.be.equal(CONVERSION_FEE);
                expect(oldConverterInitialState.maxConversionFee).to.be.equal(MAX_CONVERSION_FEE);

                for (let i = 0; i < oldConverterInitialState.reserveTokenCount; ++i) {
                    expect(oldConverterInitialState.reserveTokens[i].token).to.be.eql(reserveTokens[i]);
                    expect(oldConverterInitialState.reserveTokens[i].balance).to.be.equal(reserveBalances[i]);
                }

                const newConverter = await upgradeConverter(upgrader, oldConverter);

                const oldConverterCurrentState = await getConverterState(oldConverter);
                expect(oldConverterCurrentState.owner).to.be.eql(deployer.address);
                expect(oldConverterCurrentState.newOwner).to.be.eql(ZERO_ADDRESS);
                expect(oldConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(oldConverterCurrentState.tokenOwner).to.be.eql(
                    activate ? newConverter.address : deployer.address
                );
                expect(oldConverterCurrentState.conversionFee).to.be.equal(CONVERSION_FEE);
                expect(oldConverterCurrentState.maxConversionFee).to.be.equal(MAX_CONVERSION_FEE);
                expect(oldConverterCurrentState.reserveTokenCount).to.be.equal(
                    oldConverterInitialState.reserveTokenCount
                );

                for (let i = 0; i < oldConverterCurrentState.reserveTokenCount; ++i) {
                    expect(oldConverterCurrentState.reserveTokens[i].token).to.be.eql(
                        oldConverterInitialState.reserveTokens[i].token
                    );
                    expect(oldConverterCurrentState.reserveTokens[i].balance).to.be.equal(BigNumber.from(0));
                }

                const newConverterCurrentState = await getConverterState(newConverter);
                expect(newConverterCurrentState.owner).to.be.eql(upgrader.address);
                expect(newConverterCurrentState.newOwner).to.be.eql(deployer.address);
                expect(newConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(newConverterCurrentState.tokenOwner).to.be.eql(
                    activate ? newConverter.address : deployer.address
                );
                expect(newConverterCurrentState.conversionFee).to.be.equal(CONVERSION_FEE);
                expect(newConverterCurrentState.maxConversionFee).to.be.equal(MAX_CONVERSION_FEE);
                expect(newConverterCurrentState.reserveTokenCount).to.be.equal(
                    oldConverterInitialState.reserveTokenCount
                );

                for (let i = 0; i < newConverterCurrentState.reserveTokenCount; ++i) {
                    expect(newConverterCurrentState.reserveTokens[i].balance).to.be.equal(upgradedReserveBalances[i]);
                    expect(newConverterCurrentState.reserveTokens[i].token).to.be.eql(reserveTokens[i]);
                }
            });

            it('should fail if the transaction did not receive enough gas', async () => {
                const lowGas = 2000000;
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expect(upgradeConverter(upgrader, oldConverter, { gas: lowGas })).to.be.reverted;
            });

            it('should fail if the upgrader did not receive ownership', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expect(upgrader.upgradeOld(oldConverter.address, ethers.utils.formatBytes32String(''))).to.be
                    .reverted;
            });
        });
    }
});
