const { ethers } = require('hardhat');
const { expect } = require('chai');
const { BigNumber } = require('ethers');

const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS, registry } = require('../helpers/Constants');

const ConverterHelper = require('../helpers/ConverterHelper');

const Contracts = require('../../components/Contracts').default;

const CONVERSION_FEE = BigNumber.from(1000);
const MAX_CONVERSION_FEE = BigNumber.from(30000);
const RESERVE1_BALANCE = BigNumber.from(5000);
const RESERVE2_BALANCE = BigNumber.from(8000);
const TOKEN_TOTAL_SUPPLY = BigNumber.from(20000);

const LEGACY_VERSIONS = [9, 10, 11, 23, 45];

const LEGACY_CONVERTER_TYPE = 1;
const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_CONVERTER_WEIGHT = 500_000;

let contractRegistry;
let converterFactory;
let reserveToken1;
let reserveToken2;
let deployer;
let accounts;

describe('ConverterUpgrader', () => {
    const initWith2Reserves = async (type, deployer, version, activate) => {
        const anchor = await Contracts.DSToken.deploy('Token1', 'TKN1', 0);
        const converter = await ConverterHelper.new(
            type,
            version,
            anchor.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE,
            reserveToken1.address,
            STANDARD_CONVERTER_WEIGHT
        );
        const upgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        if (version && version < 45) {
            await converter.addConnector(reserveToken2.address, STANDARD_CONVERTER_WEIGHT, false);
        } else {
            await converter.addReserve(reserveToken2.address, STANDARD_CONVERTER_WEIGHT);
        }

        await converter.setConversionFee(CONVERSION_FEE);
        await anchor.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initLegacyConverterWith2Reserves = async (deployer, version, activate) => {
        return await initWith2Reserves(LEGACY_CONVERTER_TYPE, deployer, version, activate);
    };

    const initStandardConverterWith2Reserves = async (deployer, version, activate) => {
        return await initWith2Reserves(STANDARD_CONVERTER_TYPE, deployer, version, activate);
    };

    const initWithETHReserve = async (type, deployer, version, activate) => {
        if (version && version < 45) {
            throw new Error(`Converter version ${version} does not support ETH-reserve`);
        }

        const anchor = await Contracts.DSToken.deploy('Token1', 'TKN1', 0);
        const converter = await ConverterHelper.new(
            type,
            version,
            anchor.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE,
            reserveToken1.address,
            STANDARD_CONVERTER_WEIGHT
        );
        const upgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        await converter.addReserve(NATIVE_TOKEN_ADDRESS, STANDARD_CONVERTER_WEIGHT);
        await converter.setConversionFee(CONVERSION_FEE);
        await anchor.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await (await ethers.getSigner(deployer)).sendTransaction({ to: converter.address, value: RESERVE2_BALANCE });

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initLegacyConverterWithETHReserve = async (deployer, version, activate) => {
        return await initWithETHReserve(LEGACY_CONVERTER_TYPE, deployer, version, activate);
    };

    const initStandardConverterWithETHReserve = async (deployer, version, activate) => {
        return await initWithETHReserve(STANDARD_CONVERTER_TYPE, deployer, version, activate);
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

        return ConverterHelper.at(events[0].args.newConverter);
    };

    const getConverterState = async (converter) => {
        const token = await converter.token();
        const anchor = await Contracts.DSToken.attach(token);

        const state = {
            type: await converter.converterType(),
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

        converterFactory = await Contracts.ConverterFactory.deploy();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        await converterFactory.registerTypedConverterFactory(
            (
                await Contracts.StandardPoolConverterFactory.deploy()
            ).address
        );
    });

    beforeEach(async () => {
        reserveToken1 = await Contracts.TestStandardToken.deploy('ERC Token 1', 'ERC1', RESERVE1_BALANCE);
        reserveToken2 = await Contracts.TestStandardToken.deploy('ERC Token 2', 'ERC2', RESERVE2_BALANCE);
    });

    const initFuncs = [
        initLegacyConverterWith2Reserves,
        initStandardConverterWith2Reserves,
        initLegacyConverterWithETHReserve,
        initStandardConverterWithETHReserve
    ];

    const f = (a, b) => [].concat(...a.map((d) => b.map((e) => [].concat(d, e))));
    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
    const product = cartesian(initFuncs, [...LEGACY_VERSIONS, null], [false, true]);

    const combinations = product.filter(([init, version]) => {
        if (
            // Test type 1 with an ETH reserve only on version 45
            (init === initLegacyConverterWithETHReserve && version !== 45) ||
            // Test type 1 only with legacy versions
            (init === initLegacyConverterWith2Reserves && !version) ||
            // Test type 3 with an ETH reserve only with the latest version
            (init === initStandardConverterWithETHReserve && version)
        ) {
            return false;
        }

        return true;
    });

    for (const [init, version, activate] of combinations) {
        describe(`${init.name}(version = ${version || 'latest'}, activate = ${activate}):`, () => {
            it('should upgrade successfully', async () => {
                let reserveTokens;

                switch (init) {
                    case initLegacyConverterWith2Reserves:
                    case initStandardConverterWith2Reserves:
                        reserveTokens = [reserveToken1.address, reserveToken2.address];
                        break;
                    case initLegacyConverterWithETHReserve:
                    case initStandardConverterWithETHReserve:
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

                const [upgrader, oldConverter] = await init(deployer.address, version, activate);

                const oldConverterInitialState = await getConverterState(oldConverter);
                expect(oldConverterInitialState.owner).to.equal(deployer.address);
                expect(oldConverterInitialState.newOwner).to.equal(ZERO_ADDRESS);
                expect(oldConverterInitialState.tokenOwner).to.equal(
                    activate ? oldConverter.address : deployer.address
                );
                expect(oldConverterInitialState.conversionFee).to.equal(CONVERSION_FEE);
                expect(oldConverterInitialState.maxConversionFee).to.equal(MAX_CONVERSION_FEE);

                for (let i = 0; i < oldConverterInitialState.reserveTokenCount; ++i) {
                    expect(oldConverterInitialState.reserveTokens[i].token).to.equal(reserveTokens[i]);
                    expect(oldConverterInitialState.reserveTokens[i].balance).to.equal(reserveBalances[i]);
                }

                const newConverter = await upgradeConverter(upgrader, oldConverter);
                const oldConverterCurrentState = await getConverterState(oldConverter);

                expect(oldConverterCurrentState.type).to.equal(oldConverterInitialState.type);
                expect(oldConverterCurrentState.owner).to.equal(deployer.address);
                expect(oldConverterCurrentState.newOwner).to.equal(ZERO_ADDRESS);
                expect(oldConverterCurrentState.token).to.equal(oldConverterInitialState.token);
                expect(oldConverterCurrentState.tokenOwner).to.equal(
                    activate ? newConverter.address : deployer.address
                );
                expect(oldConverterCurrentState.conversionFee).to.equal(CONVERSION_FEE);
                expect(oldConverterCurrentState.maxConversionFee).to.equal(MAX_CONVERSION_FEE);
                expect(oldConverterCurrentState.reserveTokenCount).to.equal(oldConverterInitialState.reserveTokenCount);

                for (let i = 0; i < oldConverterCurrentState.reserveTokenCount; ++i) {
                    expect(oldConverterCurrentState.reserveTokens[i].token).to.equal(
                        oldConverterInitialState.reserveTokens[i].token
                    );
                    expect(oldConverterCurrentState.reserveTokens[i].balance).to.equal(BigNumber.from(0));
                }

                const newConverterCurrentState = await getConverterState(newConverter);
                expect(newConverterCurrentState.type).to.equal(BigNumber.from(STANDARD_CONVERTER_TYPE));
                expect(newConverterCurrentState.owner).to.equal(upgrader.address);
                expect(newConverterCurrentState.newOwner).to.equal(deployer.address);
                expect(newConverterCurrentState.token).to.equal(oldConverterInitialState.token);
                expect(newConverterCurrentState.tokenOwner).to.equal(
                    activate ? newConverter.address : deployer.address
                );
                expect(newConverterCurrentState.conversionFee).to.equal(CONVERSION_FEE);
                expect(newConverterCurrentState.maxConversionFee).to.equal(MAX_CONVERSION_FEE);
                expect(newConverterCurrentState.reserveTokenCount).to.equal(oldConverterInitialState.reserveTokenCount);

                for (let i = 0; i < newConverterCurrentState.reserveTokenCount; ++i) {
                    expect(newConverterCurrentState.reserveTokens[i].balance).to.equal(upgradedReserveBalances[i]);
                    expect(newConverterCurrentState.reserveTokens[i].token).to.equal(reserveTokens[i]);
                }
            });

            it('should fail if the transaction did not receive enough gas', async () => {
                const lowGas = 2000000;
                const [upgrader, oldConverter] = await init(deployer.address, version, activate);
                await expect(upgradeConverter(upgrader, oldConverter, { gas: lowGas })).to.be.reverted;
            });

            it('should fail if the upgrader did not receive ownership', async () => {
                const [upgrader, oldConverter] = await init(deployer.address, version, activate);
                await expect(upgrader.upgradeOld(oldConverter.address, ethers.utils.formatBytes32String(''))).to.be
                    .reverted;
            });
        });
    }
});
