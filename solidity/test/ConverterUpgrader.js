const { expect } = require('chai');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');

const ConverterHelper = require('./helpers/Converter');
const { ETH_RESERVE_ADDRESS } = require('./helpers/Constants');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const SmartToken = artifacts.require('SmartToken');
const EtherToken = artifacts.require('EtherToken');
const ERC20Token = artifacts.require('ERC20Token');
const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterFactory = artifacts.require('ConverterFactory');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

const CONVERSION_FEE = new BN(1000);
const MAX_CONVERSION_FEE = new BN(30000);
const RESERVE1_BALANCE = new BN(5000);
const RESERVE2_BALANCE = new BN(8000);
const TOKEN_TOTAL_SUPPLY = new BN(20000);

const versions = [9, 10, 11, 23];

contract('ConverterUpgrader', accounts => {
    const initWith1Reserve = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
        const converter = await ConverterHelper.new(0, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, constants.ZERO_ADDRESS);

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initWith2Reserves = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
        const reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, RESERVE2_BALANCE);
        const converter = await ConverterHelper.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, constants.ZERO_ADDRESS);

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
        if (version) {
            await converter.addConnector(reserveToken2.address, 500000, false);
        } else {
            await converter.addReserve(reserveToken2.address, 500000);
        }

        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    };

    const initWithoutReserves = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const converter = await ConverterHelper.new(0, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            constants.ZERO_ADDRESS, 0, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, constants.ZERO_ADDRESS);

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

        await converter.setConversionFee(CONVERSION_FEE);

        if (activate) {
            throw new Error('Converter with no reserves cannot be activated');
        }

        return [upgrader, converter];
    };

    const initWithEtherReserve = async (deployer, version, activate) => {
        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const reserveToken1 = await EtherToken.new('Ether Token', 'ETH');
        const reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, RESERVE2_BALANCE);
        const converter = await ConverterHelper.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000, version);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, reserveToken1.address);

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
        if (version) {
            await converter.addConnector(reserveToken2.address, 500000, false);
        } else {
            await converter.addReserve(reserveToken2.address, 500000);
        }

        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.deposit({value: RESERVE1_BALANCE});
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    }

    const initWithETHReserve = async (deployer, version, activate) => {
        if (version) {
            throw new Error(`Converter version ${version} does not support ETH-reserve`);
        }

        const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
        const reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
        const converter = await ConverterHelper.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE,
            reserveToken1.address, 500000);
        const upgrader = await ConverterUpgrader.new(contractRegistry.address, constants.ZERO_ADDRESS);

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
        await converter.addReserve(ETH_RESERVE_ADDRESS, 500000);
        await converter.setConversionFee(CONVERSION_FEE);
        await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
        await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
        await converter.send(RESERVE2_BALANCE, {from: deployer});

        if (activate) {
            await smartToken.transferOwnership(converter.address);
            await converter.acceptTokenOwnership();
        }

        return [upgrader, converter];
    }

    const upgradeConverter = async (upgrader, converter, options = {}) => {
        let res;

        // For versions 11 or higher, we just call upgrade on the converter.
        if (converter.upgrade) {
            res = await converter.upgrade({from: accounts[0], ...options});
        } else {
            // For previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
            // then accept ownership of the new and old converter. The end results should be the same.
            await converter.transferOwnership(upgrader.address);
            res = await upgrader.upgradeOld(converter.address, web3.utils.asciiToHex(''), options);
            await converter.acceptOwnership();
        }

        const logs = res.logs.filter(log => log.event == 'ConverterUpgrade');
        expect(logs.length).to.be.at.most(1);

        if (logs.length === 1) {
            return ConverterHelper.at(logs[0].args._newConverter);
        }

        const newConverterAddress = await new Promise((resolve, reject) => {
            upgrader.ConverterUpgrade({fromBlock: res.receipt.blockNumber, toBlock: res.receipt.blockNumber}, (error, event) => {
                expect(error).to.be.null();
                resolve(event.args._newConverter);
            });
        });

        return ConverterHelper.at(newConverterAddress);
    };

    const getConverterState = async (converter) => {
        const token = await converter.token.call();
        const smartToken = await SmartToken.at(token);
        const state = {
            owner: await converter.owner.call(),
            token,
            tokenOwner: await smartToken.owner.call(),
            newOwner: await converter.newOwner.call(),
            conversionFee: await converter.conversionFee.call(),
            maxConversionFee: await converter.maxConversionFee.call(),
            reserveTokenCount: await converter.connectorTokenCount.call(),
            reserveTokens: [],
        };

        for (let i = 0; i < state.reserveTokenCount; i++) {
            const token = await converter.connectorTokens.call(i);
            state.reserveTokens[i] = {
                token,
                balance: await converter.getConnectorBalance.call(token)
            };
        }

        return state;
    }

    let contractRegistry;
    let converterFactory;
    const deployer = accounts[0];

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();
        converterFactory = await ConverterFactory.new();

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, converterFactory.address);
        await converterFactory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
    });

    const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
    const product = cartesian([initWithoutReserves, initWith1Reserve, initWith2Reserves, initWithEtherReserve, initWithETHReserve], [...versions, null], [false, true]);
    const combinations = product.filter(([init, version, active]) => !(init == initWithoutReserves && active) && !(init == initWithETHReserve && version));
    const reserveBalances = [RESERVE1_BALANCE, RESERVE2_BALANCE];

    for (const [init, version, activate] of combinations) {
        const init = initWith1Reserve;
        const version = 23;
        const activate = true;

        describe(`${init.name}(version = ${version ? version : 'latest'}, active = ${activate}):`, () => {
            it('should upgrade successfully', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, activate);

                const oldConverterInitialState = await getConverterState(oldConverter);
                expect(oldConverterInitialState.owner).to.be.eql(deployer);
                expect(oldConverterInitialState.newOwner).to.be.eql(constants.ZERO_ADDRESS);
                expect(oldConverterInitialState.tokenOwner).to.be.eql(activate ? oldConverter.address : deployer);
                expect(oldConverterInitialState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(oldConverterInitialState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);

                for (let i = 0; i < oldConverterInitialState.reserveTokenCount.toNumber(); ++i) {
                    expect(oldConverterInitialState.reserveTokens[i].balance).to.be.bignumber.equal(reserveBalances[i]);
                }

                const newConverter = await upgradeConverter(upgrader, oldConverter);

                const oldConverterCurrentState = await getConverterState(oldConverter);
                expect(oldConverterCurrentState.owner).to.be.eql(deployer);
                expect(oldConverterCurrentState.newOwner).to.be.eql(constants.ZERO_ADDRESS);
                expect(oldConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(oldConverterCurrentState.tokenOwner).to.be.eql(activate ? newConverter.address : deployer);
                expect(oldConverterCurrentState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(oldConverterCurrentState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(oldConverterCurrentState.reserveTokenCount).to.be.bignumber.equal(oldConverterInitialState.reserveTokenCount);

                for (let i = 0; i < oldConverterCurrentState.reserveTokenCount.toNumber(); ++i) {
                    expect(oldConverterCurrentState.reserveTokens[i].token).to.be.eql(oldConverterInitialState.reserveTokens[i].token);
                    expect(oldConverterCurrentState.reserveTokens[i].balance).to.be.bignumber.equal(new BN(0));
                }

                const newConverterCurrentState = await getConverterState(newConverter);
                expect(newConverterCurrentState.owner).to.be.eql(upgrader.address);
                expect(newConverterCurrentState.newOwner).to.be.eql(deployer);
                expect(newConverterCurrentState.token).to.be.eql(oldConverterInitialState.token);
                expect(newConverterCurrentState.tokenOwner).to.be.eql(activate ? newConverter.address : deployer);
                expect(newConverterCurrentState.conversionFee).to.be.bignumber.equal(CONVERSION_FEE);
                expect(newConverterCurrentState.maxConversionFee).to.be.bignumber.equal(MAX_CONVERSION_FEE);
                expect(newConverterCurrentState.reserveTokenCount).to.be.bignumber.equal(oldConverterInitialState.reserveTokenCount);

                for (let i = 0; i < newConverterCurrentState.reserveTokenCount.toNumber(); ++i) {
                    expect(newConverterCurrentState.reserveTokens[i].balance).to.be.bignumber.equal(activate ? oldConverterInitialState.reserveTokens[i].balance : new BN(0));
                    expect(newConverterCurrentState.reserveTokens[i].token).to.be.eql(oldConverterInitialState.reserveTokens[i].token);
                }
            });

            it('should fail if the transaction did not receive enough gas', async () => {
                const lowGas = 2000000;
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expectRevert.unspecified(upgradeConverter(upgrader, oldConverter, {gas: lowGas}));
            });

            it('should fail if the upgrader did not receive ownership', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, activate);
                await expectRevert.unspecified(upgrader.upgradeOld(oldConverter.address, web3.utils.asciiToHex('')));
            });
        });
    }
});
