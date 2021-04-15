const { defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const ConverterHelper = require('./helpers/ConverterHelper');

const { NATIVE_TOKEN_ADDRESS, registry } = require('./helpers/Constants');

const { ZERO_ADDRESS } = constants;

const TestStandardToken = contract.fromArtifact('TestStandardToken');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterUpgrader = contract.fromArtifact('ConverterUpgrader');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('LiquidityPoolV1ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const DSToken = contract.fromArtifact('DSToken');

const CONVERSION_FEE = new BN(1000);
const MAX_CONVERSION_FEE = new BN(30000);
const RESERVE1_BALANCE = new BN(5000);
const RESERVE2_BALANCE = new BN(8000);
const TOKEN_TOTAL_SUPPLY = new BN(20000);

const LEGACY_VERSIONS = [9, 10, 11, 23, 45];

const LEGACY_CONVERTER_TYPE = 1;
const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_CONVERTER_WEIGHT = 500_000;

describe('ConverterUpgrader', () => {
    const initWith2Reserves = async (type, deployer, version, activate) => {
        const anchor = await DSToken.new('Token1', 'TKN1', 0);
        const converter = await ConverterHelper.new(
            type,
            version,
            anchor.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE,
            reserveToken1.address,
            STANDARD_CONVERTER_WEIGHT
        );
        const upgrader = await ConverterUpgrader.new(contractRegistry.address);

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

        const anchor = await DSToken.new('Token1', 'TKN1', 0);
        const converter = await ConverterHelper.new(
            type,
            version,
            anchor.address,
            contractRegistry.address,
            MAX_CONVERSION_FEE,
            reserveToken1.address,
            STANDARD_CONVERTER_WEIGHT
        );
        const upgrader = await ConverterUpgrader.new(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
        await converter.addReserve(NATIVE_TOKEN_ADDRESS, STANDARD_CONVERTER_WEIGHT);
        await converter.setConversionFee(CONVERSION_FEE);
        await anchor.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await converter.send(RESERVE2_BALANCE, { from: deployer });

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
            res = await converter.upgrade({ from: deployer, ...options });
        } else {
            // For previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
            // then accept ownership of the new and old converter. The end results should be the same.
            await converter.transferOwnership(upgrader.address);
            res = await upgrader.upgradeOld(converter.address, web3.utils.asciiToHex(''), {
                from: deployer,
                ...options
            });
            await converter.acceptOwnership();
        }

        const logs = res.logs.filter((log) => log.event === 'ConverterUpgrade');
        expect(logs.length).to.be.at.most(1);

        if (logs.length === 1) {
            return ConverterHelper.at(logs[0].args._newConverter);
        }

        const events = await upgrader.getPastEvents('ConverterUpgrade', {
            fromBlock: res.receipt.blockNumber,
            toBlock: res.receipt.blockNumber
        });

        return ConverterHelper.at(events[0].args._newConverter);
    };

    const getConverterState = async (converter) => {
        const token = await converter.token.call();
        const anchor = await DSToken.at(token);

        const state = {
            type: new BN(await converter.converterType.call()),
            owner: await converter.owner.call(),
            token,
            tokenOwner: await anchor.owner.call(),
            newOwner: await converter.newOwner.call(),
            conversionFee: await converter.conversionFee.call(),
            maxConversionFee: await converter.maxConversionFee.call(),
            reserveTokenCount: await converter.connectorTokenCount.call(),
            reserveTokens: []
        };

        for (let i = 0; i < state.reserveTokenCount.toNumber(); i++) {
            const token = await converter.connectorTokens.call(i);
            state.reserveTokens[i] = {
                token,
                balance: await converter.getConnectorBalance.call(token)
            };
        }

        return state;
    };

    let contractRegistry;
    let converterFactory;
    const deployer = defaultSender;
    let reserveToken1;
    let reserveToken2;

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        converterFactory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);

        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await StandardPoolConverterFactory.new()).address);
    });

    beforeEach(async () => {
        reserveToken1 = await TestStandardToken.new('ERC Token 1', 'ERC1', 18, RESERVE1_BALANCE);
        reserveToken2 = await TestStandardToken.new('ERC Token 2', 'ERC2', 18, RESERVE2_BALANCE);
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
    const combinations = product.filter(
        ([init, version]) =>
            // Test type 1 with an ETH reserve only on version 45
            !(init === initLegacyConverterWithETHReserve && version !== 45) &&
            // Test type 1 only with legacy versions
            !(init === initLegacyConverterWith2Reserves && !version) &&
            // Test type 3 with an ETH reserve only with the latest version
            !(init === initStandardConverterWithETHReserve && version)
    );

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
                    activate || olderConverter ? RESERVE1_BALANCE : new BN(0),
                    activate || olderConverter ? RESERVE2_BALANCE : new BN(0)
                ];

                // Token balances are always migrated during an upgrade, regardless of the reported reserve balance by
                // the original converter.
                const upgradedReserveBalances = [
                    activate ? RESERVE1_BALANCE : new BN(0),
                    activate ? RESERVE2_BALANCE : new BN(0)
                ];

                const [upgrader, oldConverter] = await init(deployer, version, activate);

                const oldConverterInitialState = await getConverterState(oldConverter);
                expect(oldConverterInitialState.owner).to.be.eql(deployer);
                expect(oldConverterInitialState.newOwner).to.be.eql(ZERO_ADDRESS);
                expect(oldConverterInitialState.tokenOwner).to.be.eql(activate ? oldConverter.address : deployer);
                expect(oldConverterInitialState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(oldConverterInitialState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);

                for (let i = 0; i < oldConverterInitialState.reserveTokenCount.toNumber(); ++i) {
                    expect(oldConverterInitialState.reserveTokens[i].token).to.be.eql(reserveTokens[i]);
                    expect(oldConverterInitialState.reserveTokens[i].balance).to.be.bignumber.equal(reserveBalances[i]);
                }

                const newConverter = await upgradeConverter(upgrader, oldConverter);

                const oldConverterCurrentState = await getConverterState(oldConverter);

                expect(oldConverterCurrentState.type).to.be.bignumber.equal(oldConverterInitialState.type);
                expect(oldConverterCurrentState.owner).to.be.eql(deployer);
                expect(oldConverterCurrentState.newOwner).to.be.eql(ZERO_ADDRESS);
                expect(oldConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(oldConverterCurrentState.tokenOwner).to.be.eql(activate ? newConverter.address : deployer);
                expect(oldConverterCurrentState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(oldConverterCurrentState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(oldConverterCurrentState.reserveTokenCount).to.be.bignumber.equal(
                    oldConverterInitialState.reserveTokenCount
                );

                for (let i = 0; i < oldConverterCurrentState.reserveTokenCount.toNumber(); ++i) {
                    expect(oldConverterCurrentState.reserveTokens[i].token).to.be.eql(
                        oldConverterInitialState.reserveTokens[i].token
                    );
                    expect(oldConverterCurrentState.reserveTokens[i].balance).to.be.bignumber.equal(new BN(0));
                }

                const newConverterCurrentState = await getConverterState(newConverter);
                expect(newConverterCurrentState.type).to.be.bignumber.equal(new BN(STANDARD_CONVERTER_TYPE));
                expect(newConverterCurrentState.owner).to.be.eql(upgrader.address);
                expect(newConverterCurrentState.newOwner).to.be.eql(deployer);
                expect(newConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(newConverterCurrentState.tokenOwner).to.be.eql(activate ? newConverter.address : deployer);
                expect(newConverterCurrentState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(newConverterCurrentState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(newConverterCurrentState.reserveTokenCount).to.be.bignumber.equal(
                    oldConverterInitialState.reserveTokenCount
                );

                for (let i = 0; i < newConverterCurrentState.reserveTokenCount.toNumber(); ++i) {
                    expect(newConverterCurrentState.reserveTokens[i].balance).to.be.bignumber.equal(
                        upgradedReserveBalances[i]
                    );
                    expect(newConverterCurrentState.reserveTokens[i].token).to.be.eql(reserveTokens[i]);
                }
            });

            it('should fail if the transaction did not receive enough gas', async () => {
                const lowGas = 2000000;
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expectRevert.unspecified(upgradeConverter(upgrader, oldConverter, { gas: lowGas }));
            });

            it('should fail if the upgrader did not receive ownership', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expectRevert.unspecified(upgrader.upgradeOld(oldConverter.address, web3.utils.asciiToHex('')));
            });
        });
    }
});
