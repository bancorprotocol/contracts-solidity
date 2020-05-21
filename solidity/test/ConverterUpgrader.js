/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const Converter = require('./helpers/Converter');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const SmartToken = artifacts.require('SmartToken');
const EtherToken = artifacts.require('EtherToken');
const ERC20Token = artifacts.require('ERC20Token');
const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterFactory = artifacts.require('ConverterFactory');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

const CONVERSION_FEE     = '1000';
const MAX_CONVERSION_FEE = '30000';
const RESERVE1_BALANCE = '5000';
const RESERVE2_BALANCE = '8000';
const TOKEN_TOTAL_SUPPLY = '20000';

const versions = [9, 10, 11, 23];

let contractRegistry;
let converterFactory;

async function initWith1Reserve(deployer, version, active) {
    const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
    const reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
    const converter = await Converter.new(0, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE, reserveToken1.address, 500000, version);
    const upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);

    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

    await converter.setConversionFee(CONVERSION_FEE);
    await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
    await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);

    if (active) {
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return [upgrader, converter];
}

async function initWith2Reserves(deployer, version, active) {
    const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
    const reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
    const reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, RESERVE2_BALANCE);
    const converter = await Converter.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE, reserveToken1.address, 500000, version);
    const upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);

    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
    if (version)
        await converter.addConnector(reserveToken2.address, 500000, false);
    else
        await converter.addReserve(reserveToken2.address, 500000);
        
    await converter.setConversionFee(CONVERSION_FEE);
    await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
    await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
    await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

    if (active) {
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return [upgrader, converter];
}

async function initWithoutReserves(deployer, version, active) {
    const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
    const converter = await Converter.new(0, smartToken.address, contractRegistry.address, 0, utils.zeroAddress, 0, version);
    const upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);

    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

    if (active) {
        throw new Error("converter with no reserves cannot be active");
    }

    return [upgrader, converter];
}

async function initWithEtherReserve(deployer, version, active) {
    const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
    const reserveToken1 = await EtherToken.new('Ether Token', 'ETH');
    const reserveToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, RESERVE2_BALANCE);
    const converter = await Converter.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE, reserveToken1.address, 500000, version);
    const upgrader = await ConverterUpgrader.new(contractRegistry.address, reserveToken1.address);

    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
    if (version)
        await converter.addConnector(reserveToken2.address, 500000, false);
    else
        await converter.addReserve(reserveToken2.address, 500000);
        
    await converter.setConversionFee(CONVERSION_FEE);
    await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
    await reserveToken1.deposit({value: RESERVE1_BALANCE});
    await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
    await reserveToken2.transfer(converter.address, RESERVE2_BALANCE);

    if (active) {
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return [upgrader, converter];
}

async function initWithETHReserve(deployer, version, active) {
    if (version) {
        throw new Error(`converter version ${version} does not support ETH-reserve`);
    }

    const smartToken = await SmartToken.new('Smart Token', 'TKN1', 0);
    const reserveToken1 = await ERC20Token.new('ERC Token 1', 'ERC1', 0, RESERVE1_BALANCE);
    const converter = await Converter.new(1, smartToken.address, contractRegistry.address, MAX_CONVERSION_FEE, reserveToken1.address, 500000);
    const upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);

    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
    await converter.addReserve(ETH_RESERVE_ADDRESS, 500000);
    await converter.setConversionFee(CONVERSION_FEE);
    await smartToken.issue(deployer, TOKEN_TOTAL_SUPPLY);
    await reserveToken1.transfer(converter.address, RESERVE1_BALANCE);
    await web3.eth.sendTransaction({from: deployer, to: converter.address, value: RESERVE2_BALANCE});

    if (active) {
        await smartToken.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return [upgrader, converter];
}

async function upgradeConverter(upgrader, converter, version, options = {}) {
    let response;

    // for version 11 or higher, we just call upgrade on the converter
    if (converter.upgrade) {
        response = await converter.upgrade(options);
    }
    else {
        // for previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
        // then accept ownership of the new and old converter. The end results should be the same.
        await converter.transferOwnership(upgrader.address);
        response = await upgrader.upgradeOld(converter.address, web3.fromAscii(''), options);
        await converter.acceptOwnership();
    }

    const logs = response.logs.filter(log => log.event == 'ConverterUpgrade');
    assert.isAtMost(logs.length, 1);
    if (logs.length == 1)
        return Converter.at(logs[0].args._newConverter);

    const newConverterAddress = await new Promise((resolve, reject) => {
        upgrader.ConverterUpgrade({fromBlock: response.receipt.blockNumber, toBlock: response.receipt.blockNumber}).get((error, logs) => {
            assert.equal(error, null);
            assert.equal(logs.length, 1);
            resolve(logs[0].args._newConverter);
        });
    });

    return Converter.at(newConverterAddress);
}

async function getConverterState(converter) {
    const state = {};
    state.owner = await converter.owner();
    state.token = await converter.token();
    state.newOwner = await converter.newOwner();
    state.conversionFee = await converter.conversionFee();
    state.maxConversionFee = await converter.maxConversionFee();
    state.tokenOwner = await SmartToken.at(state.token).owner();
    state.reserveTokenCount = await converter.connectorTokenCount();
    for (let i = 0; i < state.reserveTokenCount; i++) {
        state[`reserveToken${1}`] = await converter.connectorTokens(i);
        state[`reserveToken${2}Balance`] = await converter.getConnectorBalance(state[`reserveToken${1}`]);
    }
    return state;
}

async function assertEqual(actual, expected) {
    for (const key in Object.keys(actual)) {
        if (expected.hasOwnProperty(key))
            assert.equal(actual[key], expected[key]);
    }
}

contract('ConverterUpgrader', accounts => {
    const deployer = accounts[0];

    before(async () => {
        contractRegistry = await ContractRegistry.new();
        converterFactory = await ConverterFactory.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, converterFactory.address);
        await converterFactory.registerTypedFactory((await LiquidTokenConverterFactory.new()).address);
        await converterFactory.registerTypedFactory((await LiquidityPoolV1ConverterFactory.new()).address);
    });

    const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
    const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
    const product = cartesian([initWithoutReserves, initWith1Reserve, initWith2Reserves, initWithEtherReserve, initWithETHReserve], [...versions, null], [false, true]);
    const combinations = product.filter(([init, version, active]) => !(init == initWithoutReserves && active) && !(init == initWithETHReserve && version));

    for (const [init, version, active] of combinations) {
        describe(`${init.name}(version = ${version ? version : 'latest'}, active = ${active}):`, () => {
            it('upgrade should complete successfully', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, active);
                const oldConverterInitialState = await getConverterState(oldConverter);
                const newConverter = await upgradeConverter(upgrader, oldConverter, version);
                const oldConverterCurrentState = await getConverterState(oldConverter);
                const newConverterCurrentState = await getConverterState(newConverter);
                assertEqual(oldConverterInitialState, {
                    owner: deployer,
                    newOwner: utils.zeroAddress,
                    tokenOwner: oldConverter.address,
                    conversionFee: CONVERSION_FEE,
                    maxConversionFee: MAX_CONVERSION_FEE,
                    reserveTokenCount: '2',
                    reserveToken1Balance: RESERVE1_BALANCE,
                    reserveToken2Balance: RESERVE2_BALANCE,
                });
                assertEqual(oldConverterCurrentState, {
                    owner: deployer,
                    newOwner: utils.zeroAddress,
                    token: oldConverterInitialState.token,
                    tokenOwner: newConverter.address,
                    conversionFee: CONVERSION_FEE,
                    maxConversionFee: MAX_CONVERSION_FEE,
                    reserveTokenCount: '2',
                    reserveToken1: oldConverterInitialState.reserveToken1,
                    reserveToken2: oldConverterInitialState.reserveToken2,
                    reserveToken1Balance: '0',
                    reserveToken2Balance: '0',
                });
                assertEqual(newConverterCurrentState, {
                    owner: upgrader.address,
                    newOwner: deployer,
                    token: oldConverterInitialState.token,
                    tokenOwner: newConverter.address,
                    conversionFee: CONVERSION_FEE,
                    maxConversionFee: MAX_CONVERSION_FEE,
                    reserveTokenCount: '2',
                    reserveToken1: oldConverterInitialState.reserveToken1,
                    reserveToken2: oldConverterInitialState.reserveToken2,
                    reserveToken1Balance: RESERVE1_BALANCE,
                    reserveToken2Balance: RESERVE2_BALANCE,
                });
            });
            it('upgrade should fail if the transaction did not receive enough gas', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, active);
                const oldConverterInitialState = await getConverterState(oldConverter);
                await utils.catchRevert(upgradeConverter(upgrader, oldConverter, version, {gas: 2000000}));
                const oldConverterCurrentState = await getConverterState(oldConverter);
                assertEqual(oldConverterInitialState, oldConverterCurrentState);
            });
            it('upgrade should fail if the upgrader did not receive ownership', async () => {
                const [upgrader, oldConverter] = await init(deployer, version, active);
                const oldConverterInitialState = await getConverterState(oldConverter);
                await utils.catchRevert(upgrader.upgradeOld(oldConverter.address, web3.fromAscii('')));
                const oldConverterCurrentState = await getConverterState(oldConverter);
                assertEqual(oldConverterInitialState, oldConverterCurrentState);
            });
        });
    }
});
