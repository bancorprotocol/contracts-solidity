/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const fs = require('fs');

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');
const BancorNetwork = artifacts.require('BancorNetwork');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const SmartToken = artifacts.require('SmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ERC20Token = artifacts.require('ERC20Token');
const TestNonStandardToken = artifacts.require('TestNonStandardToken');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterUpgrader = artifacts.require('ConverterUpgrader');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');
const weight10Percent = 100000;

let bancorNetwork;
let factory;
let anchor;
let anchorAddress;
let contractRegistry;
let reserveToken;
let reserveToken2;
let upgrader;


async function createConverter(type, anchorAddress, registryAddress = contractRegistry.address, maxConversionFee = 0) {
    if (type == 0)
        return await LiquidTokenConverter.new(anchorAddress, registryAddress, maxConversionFee);
    else if (type == 1)
        return await LiquidityPoolV1Converter.new(anchorAddress, registryAddress, maxConversionFee);
}

async function initConverter(type, accounts, activate, isETHReserve, maxConversionFee = 0) {
    anchor = await SmartToken.new('Token1', 'TKN1', 2);
    anchorAddress = anchor.address;

    let converter = await createConverter(type, anchorAddress, contractRegistry.address, maxConversionFee);
    if (type == 0) {
        await converter.addReserve(getReserve1Address(isETHReserve), 250000);
    }
    else if (type == 1) {
        await converter.addReserve(getReserve1Address(isETHReserve), 250000);
        await converter.addReserve(reserveToken2.address, 150000);
        await reserveToken2.transfer(converter.address, 8000);
    }

    await anchor.issue(accounts[0], 20000);
    if (isETHReserve)
        await converter.send(5000);
    else
        await reserveToken.transfer(converter.address, 5000);

    if (activate) {
        await anchor.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

function getReserve1Address(isETH) {
    if (isETH)
        return ETH_RESERVE_ADDRESS;

    return reserveToken.address;
}

async function getBalance(token, address, account) {
    if (address == ETH_RESERVE_ADDRESS)
        return await web3.eth.getBalance(account);

    return await token.balanceOf.call(account);
}

async function approve(token, from, to, amount) {
    await token.approve(to, 0, { from });
    return await token.approve(to, amount, { from });
}

async function convert(path, amount, minReturn, options) {
    return bancorNetwork.convertByPath(path, amount, minReturn, utils.zeroAddress, utils.zeroAddress, 0, options);
}

contract('Converter:', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        let bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

        factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
        await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address, utils.zeroAddress);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);

        anchor = await SmartToken.new('Token1', 'TKN1', 2); 
        anchorAddress = anchor.address;

        reserveToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 0, 2000000000);
    });

    for (let type = 0; type < 2; type++) {
        it('verifies that sending ether to the converter succeeds if it has ETH reserve', async () => {
            let converter = await initConverter(type, accounts, true, true);
            await converter.send(100);
        });

        it('should throw when sending ether to the converter fails if it has no ETH reserve', async () => {
            let converter = await initConverter(type, accounts, true, false);
            await utils.catchRevert(converter.send(100));
        });

        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
            describe(`${type == 0 ? 'LiquidTokenConverter' : 'LiquidityPoolV1Converter'}${isETHReserve == 0 ? '' : ' (with ETH reserve)'}:`, () => {
                it('verifies the converter data after construction', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    let anchor = await converter.anchor.call();
                    assert.equal(anchor, anchorAddress);
                    let registry = await converter.registry.call();
                    assert.equal(registry, contractRegistry.address);
                    let maxConversionFee = await converter.maxConversionFee.call();
                    assert.equal(maxConversionFee, 0);
                });

                it('should throw when attempting to construct a converter with no anchor', async () => {
                    await utils.catchRevert(createConverter(type, utils.zeroAddress));
                });

                it('should throw when attempting to construct a converter with no contract registry', async () => {
                    await utils.catchRevert(createConverter(type, anchorAddress, utils.zeroAddress));
                });

                it('should throw when attempting to construct a converter with invalid conversion fee', async () => {
                    await utils.catchRevert(createConverter(type, anchorAddress, contractRegistry.address, 1000001));
                });

                it('verifies that the owner can withdraw other tokens from the anchor', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    let ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
                    const prevBalance = await ercToken.balanceOf.call(accounts[0]);
                    await ercToken.transfer(anchor.address, 100);
                    await converter.withdrawFromAnchor(ercToken.address, accounts[0], 100);
                    const balance = await ercToken.balanceOf.call(accounts[0]);
                    assert.equal(prevBalance.toNumber(), balance.toNumber());
                });
            
                it('should throw when the owner attempts to withdraw other tokens from the anchor while the converter is not active', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    let ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
                    await ercToken.transfer(anchor.address, 100);
            
                    await utils.catchRevert(converter.withdrawFromAnchor(ercToken.address, accounts[0], 100));
                });
            
                it('should throw when a non owner attempts to withdraw other tokens from the anchor', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    let ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
                    await ercToken.transfer(anchor.address, 100);
            
                    await utils.catchRevert(converter.withdrawFromAnchor(ercToken.address, accounts[0], 100, { from: accounts[1] }));
                });

                it('verifies the owner can update the conversion whitelist contract address', async () => {
                    let converter = await createConverter(type, anchorAddress);
                    let prevWhitelist = await converter.conversionWhitelist.call();
                    await converter.setConversionWhitelist(accounts[3]);
                    let newWhitelist = await converter.conversionWhitelist.call();
                    assert.notEqual(prevWhitelist, newWhitelist);
                });

                it('should throw when a non owner attempts update the conversion whitelist contract address', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.setConversionWhitelist(accounts[3], { from: accounts[1] }));
                });

                it('verifies the owner can remove the conversion whitelist contract address', async () => {
                    let converter = await createConverter(type, anchorAddress);
                    await converter.setConversionWhitelist(accounts[3]);
                    let whitelist = await converter.conversionWhitelist.call();
                    assert.equal(whitelist, accounts[3]);
                    await converter.setConversionWhitelist(utils.zeroAddress);
                    whitelist = await converter.conversionWhitelist.call();
                    assert.equal(whitelist, utils.zeroAddress);
                });

                it('should throw when the owner attempts update the conversion whitelist contract address with the converter address', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.setConversionWhitelist(converter.address));
                });

                it('verifies the owner can update the fee', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);
                    await converter.setConversionFee(30000);
                    let conversionFee = await converter.conversionFee.call();
                    assert.equal(conversionFee, 30000);
                });

                it('should throw when attempting to update the fee to an invalid value', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);

                    await utils.catchRevert(converter.setConversionFee(200001));
                });

                it('should throw when a non owner attempts to update the fee', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);

                    await utils.catchRevert(converter.setConversionFee(30000, { from: accounts[1] }));
                });

                it('verifies that an event is fired when the owner updates the fee', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);
                    let watcher = converter.ConversionFeeUpdate();
                    await converter.setConversionFee(30000);
                    let events = await watcher.get();
                    assert.equal(events[0].args._prevFee.valueOf(), 0);
                    assert.equal(events[0].args._newFee.valueOf(), 30000);
                });

                it('verifies that an event is fired when the owner updates the fee multiple times', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);
                    let watcher = converter.ConversionFeeUpdate();
                    let events;
                    for (let i = 1; i <= 10; ++i) {
                        await converter.setConversionFee(10000 * i);
                        events = await watcher.get();
                        assert.equal(events[0].args._prevFee.valueOf(), 10000 * (i - 1));
                        assert.equal(events[0].args._newFee.valueOf(), 10000 * i);
                    }
                });

                it('should not fire an event when attempting to update the fee to an invalid value', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);
                    let watcher = converter.ConversionFeeUpdate();

                    await utils.catchRevert(converter.setConversionFee(200001));
                    let events = await watcher.get();
                    assert.equal(events.length, 0);
                });

                it('should not fire an event when a non owner attempts to update the fee', async () => {
                    let converter = await createConverter(type, anchorAddress, contractRegistry.address, 200000);
                    let watcher = converter.ConversionFeeUpdate();

                    await utils.catchRevert(converter.setConversionFee(30000, { from: accounts[1] }));
                    let events = await watcher.get();
                    assert.equal(events.length, 0);
                });

                it('should throw when a non owner attempts to add a reserve', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.addReserve(getReserve1Address(isETHReserve), weight10Percent, { from: accounts[1] }));
                });

                it('should throw when attempting to add a reserve with invalid address', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.addReserve(utils.zeroAddress, weight10Percent));
                });

                it('should throw when attempting to add a reserve with weight = 0', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.addReserve(getReserve1Address(isETHReserve), 0));
                });

                it('should throw when attempting to add a reserve with weight greater than 100%', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.addReserve(getReserve1Address(isETHReserve), 1000001));
                });

                it('should throw when attempting to add the anchor as a reserve', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.addReserve(anchorAddress, weight10Percent));
                });

                it('should throw when attempting to add the converter as a reserve', async () => {
                    let converter = await createConverter(type, anchorAddress);

                    await utils.catchRevert(converter.addReserve(converter.address, weight10Percent));
                });

                it('verifies that the correct reserve weight is returned', async () => {
                    let converter = await createConverter(type, anchorAddress);
                    await converter.addReserve(getReserve1Address(isETHReserve), weight10Percent);
                    let reserveWeight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                    assert.equal(reserveWeight, weight10Percent);
                });

                it('should throw when attempting to retrieve the balance for a reserve that does not exist', async () => {
                    let converter = await createConverter(type, anchorAddress);
                    await converter.addReserve(getReserve1Address(isETHReserve), weight10Percent);

                    await utils.catchRevert(converter.reserveBalance.call(reserveToken2.address));
                });

                it('verifies that the converter can accept the anchor ownership', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    await anchor.transferOwnership(converter.address);
                    await converter.acceptAnchorOwnership();
                });

                it('verifies that the owner can transfer the anchor ownership if the owner is the upgrader contract', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, accounts[0]);

                    await converter.transferAnchorOwnership(accounts[1]);

                    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
                    let anchorAddress = await converter.anchor.call();
                    let contract = await web3.eth.contract(JSON.parse(fs.readFileSync(__dirname + '/../build/SmartToken.abi')));
                    let token = await contract.at(anchorAddress);
                    let newOwner = await token.newOwner.call();
                    assert.equal(newOwner, accounts[1]);
                });

                it('should throw when the owner attempts to transfer the anchor ownership', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    await utils.catchRevert(converter.transferAnchorOwnership(accounts[1]));
                });

                it('should throw when a non owner attempts to transfer the anchor ownership', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    await utils.catchRevert(converter.transferAnchorOwnership(accounts[1], { from: accounts[2] }));
                });

                it('should throw when a the upgrader contract attempts to transfer the anchor ownership while the upgrader is not the owner', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, accounts[2]);

                    await utils.catchRevert(converter.transferAnchorOwnership(accounts[1], { from: accounts[2] }));
                    await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_UPGRADER, upgrader.address);
                });

                it('verifies that isActive returns true when the converter is active', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    let isActive = await converter.isActive.call();
                    assert.equal(isActive, true);
                });

                it('verifies that isActive returns false when the converter is inactive', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    let isActive = await converter.isActive.call();
                    assert.equal(isActive, false);
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is not active', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    let token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
                    await token.transfer(converter.address, 100);
                    let balance = await token.balanceOf.call(converter.address);
                    assert.equal(balance, 100);

                    await converter.withdrawTokens(token.address, accounts[1], 50);
                    balance = await token.balanceOf.call(accounts[1]);
                    assert.equal(balance, 50);
                });

                it('verifies that the owner can withdraw a reserve token from the converter while the converter is not active', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    let prevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), accounts[1]);
                    let converterBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), converter.address);
                    if (isETHReserve)
                        await converter.withdrawETH(accounts[1]);
                    else
                        await converter.withdrawTokens(getReserve1Address(isETHReserve), accounts[1], converterBalance);
                    let balance = await await getBalance(reserveToken, getReserve1Address(isETHReserve), accounts[1]);
                    assert(balance.equals(prevBalance.plus(converterBalance)));
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is active', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    let token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
                    await token.transfer(converter.address, 100);

                    let prevBalance = await token.balanceOf.call(accounts[1]);
                    await converter.withdrawTokens(token.address, accounts[1], 50);
                    balance = await token.balanceOf.call(accounts[1]);
                    assert(balance.equals(prevBalance.plus(50)));
                });
            
                it('should throw when the owner attempts to withdraw a reserve token while the converter is active', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    if (isETHReserve)
                        await utils.catchRevert(converter.withdrawETH(accounts[1]));
                    else
                        await utils.catchRevert(converter.withdrawTokens(getReserve1Address(isETHReserve), accounts[1], 50));
                });

                it('should throw when a non owner attempts to withdraw a non reserve token while the converter is not active', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    let token = await ERC20Token.new('ERC Token 3', 'ERC3', 0, 100000);
                    await token.transfer(converter.address, 100);
                    let balance = await token.balanceOf.call(converter.address);
                    assert.equal(balance, 100);

                    await utils.catchRevert(converter.withdrawTokens(token.address, accounts[1], 50, { from: accounts[2] }));
                });

                it('should throw when a non owner attempts to withdraw a reserve token while the converter is not active', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    if (isETHReserve)
                        await utils.catchRevert(converter.withdrawETH(accounts[1], { from: accounts[2] }));
                    else
                        await utils.catchRevert(converter.withdrawTokens(getReserve1Address(isETHReserve), accounts[1], 50, { from: accounts[2] }));
                });

                it('should throw when a non owner attempts to withdraw a reserve token while the converter is active', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    if (isETHReserve)
                        await utils.catchRevert(converter.withdrawETH(accounts[1], { from: accounts[2] }));
                    else
                        await utils.catchRevert(converter.withdrawTokens(getReserve1Address(isETHReserve), accounts[1], 50, { from: accounts[2] }));
                });

                it('verifies that the owner can upgrade the converter while the converter is active', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter is not active', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter using the legacy upgrade function', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    await converter.transferOwnership(upgrader.address);
                    await upgrader.upgradeOld(converter.address, web3.fromUtf8("0.9"));
                });

                it('should throw when a non owner attempts to upgrade the converter', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);

                    await utils.catchRevert(converter.upgrade({ from: accounts[1] }));
                });

                it('should throw when attempting to get the rate with an invalid source token adress', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
            
                    await utils.catchRevert(converter.rateAndFee.call(utils.zeroAddress, getReserve1Address(isETHReserve), 500));
                });
            
                it('should throw when attempting to get the rate with an invalid target token address', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
            
                    await utils.catchRevert(converter.rateAndFee.call(getReserve1Address(isETHReserve), utils.zeroAddress, 500));
                });
            
                it('should throw when attempting to get the rate with identical source/target addresses', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
            
                    await utils.catchRevert(converter.rateAndFee.call(getReserve1Address(isETHReserve), getReserve1Address(isETHReserve), 500));
                });

                it('should throw when attempting to convert with an invalid source token adress', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    await utils.catchRevert(convert([utils.zeroAddress, anchorAddress, getReserve1Address(isETHReserve)], 500, 1));
                });

                it('should throw when attempting to convert with an invalid target token address', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                    await utils.catchRevert(convert([getReserve1Address(isETHReserve), anchorAddress, utils.zeroAddress], 500, 1));
                });

                it('should throw when attempting to convert with identical source/target addresses', async () => {
                    let converter = await initConverter(type, accounts, true, isETHReserve);
                    await approve(reserveToken, accounts[0], bancorNetwork.address, 500);

                    await utils.catchRevert(convert([getReserve1Address(isETHReserve), anchorAddress, getReserve1Address(isETHReserve)], 500, 1));
                });

                // TODO: move the registry client tests to a dedicated file and use a simpler client (no need for a converter)
                it('should throw when attempting to register the registry to the zero address', async () => {
                    await utils.catchRevert(contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, utils.zeroAddress));
                });

                it('should throw when attempting to update the registry when it points to the zero address', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    await utils.catchRevert(converter.updateRegistry());
                    assert.equal(await converter.registry.call(), contractRegistry.address);
                    assert.equal(await converter.prevRegistry.call(), contractRegistry.address);
                });

                it('should throw when attempting to update the registry when it points to the current registry', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
                    await utils.catchRevert(converter.updateRegistry());
                    assert.equal(await converter.registry.call(), contractRegistry.address);
                    assert.equal(await converter.prevRegistry.call(), contractRegistry.address);
                });

                it('should throw when attempting to update the registry when it points to a new registry which points to the zero address', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);

                    let newRegistry = await ContractRegistry.new();
                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
                    await utils.catchRevert(converter.updateRegistry());
                    assert.equal(await converter.registry.call(), contractRegistry.address);
                    assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

                    // set the original registry back
                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
                });

                it('should allow anyone to update the registry address', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    let newRegistry = await ContractRegistry.new();

                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
                    await newRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
                    await converter.updateRegistry({ from: accounts[1] });

                    assert.equal(await converter.registry.call(), newRegistry.address);
                    assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

                    // set the original registry back
                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
                });

                it('should allow the owner to restore the previous registry and disable updates', async () => {
                    let converter = await initConverter(type, accounts, false, isETHReserve);
                    let newRegistry = await ContractRegistry.new();

                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
                    await newRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, newRegistry.address);
                    await converter.updateRegistry({ from: accounts[1] });

                    await converter.restoreRegistry({ from: accounts[0] });

                    assert.equal(await converter.registry.call(), contractRegistry.address);
                    assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

                    await converter.restrictRegistryUpdate(true, { from: accounts[0] });
                    await utils.catchRevert(converter.updateRegistry({ from: accounts[1] }));

                    await converter.updateRegistry({ from: accounts[0] });
                    assert.equal(await converter.registry.call(), newRegistry.address);
                    assert.equal(await converter.prevRegistry.call(), contractRegistry.address);

                    // re register address
                    await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_REGISTRY, contractRegistry.address);
                });
            });
        };
    };
});