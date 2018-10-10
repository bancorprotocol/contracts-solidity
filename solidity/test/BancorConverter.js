/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const fs = require('fs');
const path = require('path');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const BancorConverterFactory = artifacts.require('BancorConverterFactory.sol');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader.sol');
const utils = require('./helpers/Utils');

const weight10Percent = 100000;
const gasPrice = 22000000000;
const gasPriceBadHigh = 22000000001;

let token;
let tokenAddress;
let contractRegistry;
let contractIds;
let contractFeatures;
let connectorToken;
let connectorToken2;
let connectorToken3;
let upgrader;

const contractsPath = path.resolve(__dirname, '../contracts/build');
let abi;
abi = fs.readFileSync(path.resolve(contractsPath, 'SmartToken.abi'), 'utf-8');
let SmartTokenAbi = JSON.parse(abi);

// used by purchase/sale tests
async function initConverter(accounts, activate, maxConversionFee = 0) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    let converter = await BancorConverter.new(
        tokenAddress,
        contractRegistry.address,
        maxConversionFee,
        connectorToken.address,
        250000
    );
    let converterAddress = converter.address;
    await converter.addConnector(connectorToken2.address, 150000, false);

    await token.issue(accounts[0], 20000);
    await connectorToken.transfer(converterAddress, 5000);
    await connectorToken2.transfer(converterAddress, 8000);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

function verifyConnector(connector, isSet, isEnabled, weight, isVirtualBalanceEnabled, virtualBalance) {
    assert.equal(connector[0], virtualBalance);
    assert.equal(connector[1], weight);
    assert.equal(connector[2], isVirtualBalanceEnabled);
    assert.equal(connector[3], isEnabled);
    assert.equal(connector[4], isSet);
}

function getConversionAmount(transaction, logIndex = 0) {
    return transaction.logs[logIndex].args._return.toNumber();
}

contract('BancorConverter', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();
        contractIds = await ContractIds.new();

        contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await BancorFormula.new();
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        let bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[3]);

        let factory = await BancorConverterFactory.new();
        let bancorConverterFactoryId = await contractIds.BANCOR_CONVERTER_FACTORY.call();
        await contractRegistry.registerAddress(bancorConverterFactoryId, factory.address);

        upgrader = await BancorConverterUpgrader.new(contractRegistry.address);
        let bancorConverterUpgraderId = await contractIds.BANCOR_CONVERTER_UPGRADER.call();
        await contractRegistry.registerAddress(bancorConverterUpgraderId, upgrader.address);

        let token = await SmartToken.new('Token1', 'TKN1', 2); 
        tokenAddress = token.address;
        
        connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 1000000000);
        connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 2000000000);
        connectorToken3 = await TestERC20Token.new('ERC Token 3', 'ERC2', 1500000000);
    });

    it('verifies the converter data after construction', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let token = await converter.token.call();
        assert.equal(token, tokenAddress);
        let registry = await converter.registry.call();
        assert.equal(registry, contractRegistry.address);

        let featureWhitelist = await converter.CONVERTER_CONVERSION_WHITELIST.call();
        let isSupported = await contractFeatures.isSupported.call(converter.address, featureWhitelist);
        assert(isSupported);

        let maxConversionFee = await converter.maxConversionFee.call();
        assert.equal(maxConversionFee, 0);
        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);
    });

    it('should throw when attempting to construct a converter with no token', async () => {
        try {
            await BancorConverter.new('0x0', contractRegistry.address, 0, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a converter with no contract registry', async () => {
        try {
            await BancorConverter.new(tokenAddress, '0x0', 0, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a converter with invalid max fee', async () => {
        try {
            await BancorConverter.new(tokenAddress, contractRegistry.address, 1000000000, '0x0', 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the first connector when provided at construction time', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, connectorToken.address, 200000);
        let connectorTokenAddress = await converter.connectorTokens.call(0);
        assert.equal(connectorTokenAddress, connectorToken.address);
        let connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, true, 200000, false, 0);
    });

    it('should throw when attempting to construct a converter with a connector with invalid weight', async () => {
        try {
            await BancorConverter.new(tokenAddress, contractRegistry.address, 0, connectorToken.address, 1000001);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the connector token count before / after adding a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let connectorTokenCount = await converter.connectorTokenCount.call();
        assert.equal(connectorTokenCount, 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        connectorTokenCount = await converter.connectorTokenCount.call();
        assert.equal(connectorTokenCount, 1);
    });

    it('verifies the owner can update the conversion whitelist contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let prevWhitelist = await converter.conversionWhitelist.call();
        await converter.setConversionWhitelist(accounts[3]);
        let newWhitelist = await converter.conversionWhitelist.call();
        assert.notEqual(prevWhitelist, newWhitelist);
    });

    it('should throw when a non owner attempts update the conversion whitelist contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.setConversionWhitelist(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can remove the conversion whitelist contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.setConversionWhitelist(accounts[3]);
        let whitelist = await converter.conversionWhitelist.call();
        assert.equal(whitelist, accounts[3]);
        await converter.setConversionWhitelist(utils.zeroAddress);
        whitelist = await converter.conversionWhitelist.call();
        assert.equal(whitelist, utils.zeroAddress);
    });

    it('should throw when the owner attempts update the conversion whitelist contract address with the converter address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.setConversionWhitelist(converter.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the owner can update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        await converter.setConversionFee(30000);
        let conversionFee = await converter.conversionFee.call();
        assert.equal(conversionFee, 30000);
    });

    it('verifies the manager can update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        await converter.transferManagement(accounts[4]);
        await converter.acceptManagement({ from: accounts[4] });

        await converter.setConversionFee(30000, { from: accounts[4] });
        let conversionFee = await converter.conversionFee.call();
        assert.equal(conversionFee, 30000);
    });

    it('should throw when attempting to update the fee to an invalid value', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);

        try {
            await converter.setConversionFee(200001);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner and non manager attempts to update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);

        try {
            await converter.setConversionFee(30000, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getFinalAmount returns the correct amount', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        await converter.setConversionFee(10000);
        let finalAmount = await converter.getFinalAmount.call(500000, 1);
        assert.equal(finalAmount, 495000);
        finalAmount = await converter.getFinalAmount.call(500000, 2);
        assert.equal(finalAmount, 490050);
    });

    it('verifies that an event is fired when an owner/manager disables conversions', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        let watcher = converter.conversionsEnabledUpdate();
        await converter.disableConversions(true);
        let events = await watcher.get();
        assert.equal(events[0].args._conversionsEnabled.valueOf(), false);
    });

    it('verifies that the conversionsEnabled event doesn\'t fire when passing identical value to conversionEnabled', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        let watcher = converter.conversionsEnabledUpdate();
        await converter.disableConversions(false);
        let events = await watcher.get();
        assert.equal(events.length, 0);
    });

    it('verifies that an event is fired when the owner updates the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        let watcher = converter.ConversionFeeUpdate();
        await converter.setConversionFee(30000);
        let events = await watcher.get();
        assert.equal(events[0].args._prevFee.valueOf(), 0);
        assert.equal(events[0].args._newFee.valueOf(), 30000);
    });

    it('verifies that an event is fired when the owner updates the fee multiple times', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
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
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        let watcher = converter.ConversionFeeUpdate();

        try {
            await converter.setConversionFee(200001);
            assert(false, "didn't throw");
        }
        catch (error) {
            let events = await watcher.get();
            assert.equal(events.length, 0);
            return utils.ensureException(error);
        }
    });

    it('should not fire an event when a non owner attempts to update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        let watcher = converter.ConversionFeeUpdate();

        try {
            await converter.setConversionFee(30000, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            let events = await watcher.get();
            assert.equal(events.length, 0);
            return utils.ensureException(error);
        }
    });

    it('verifies that 2 connectors are added correctly', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        let connector = await converter.connectors.call(connectorToken.address);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
        await converter.addConnector(connectorToken2.address, 200000, false);
        connector = await converter.connectors.call(connectorToken2.address);
        verifyConnector(connector, true, true, 200000, false, 0);
    });

    it('should throw when a non owner attempts to add a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(connectorToken.address, weight10Percent, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector when the converter is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let converter = await BancorConverter.new(token.address, contractRegistry.address, 0, '0x0', 0);
        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        try {
            await converter.addConnector(connectorToken.address, weight10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector with invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector('0x0', weight10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector with weight = 0', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(connectorToken.address, 0, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector with weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(connectorToken.address, 1000001, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the token as a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(tokenAddress, weight10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add the converter as a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(converter.address, weight10Percent, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector that already exists', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.addConnector(connectorToken.address, 200000, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add multiple connectors with total weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, 500000, false);

        try {
            await converter.addConnector(connectorToken2.address, 500001, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can update a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        let connector = await converter.connectors.call(connectorToken.address);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
        await converter.updateConnector(connectorToken.address, 200000, true, 50);
        connector = await converter.connectors.call(connectorToken.address);
        verifyConnector(connector, true, true, 200000, true, 50);
    });

    it('should throw when a non owner attempts to update a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.updateConnector(connectorToken.address, 200000, false, 0, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.updateConnector(connectorToken2.address, 200000, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector with weight = 0', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.updateConnector(connectorToken.address, 0, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector with weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.updateConnector(connectorToken.address, 1000001, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector that will result in total weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, 500000, false);
        await converter.addConnector(connectorToken2.address, 400000, false);

        try {
            await converter.updateConnector(connectorToken2.address, 500001, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can disable / re-enable conversions', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);

        await converter.disableConversions(true);
        conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, false);

        await converter.disableConversions(false);
        conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);
    });

    it('verifies that the manager can disable / re-enable conversions', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.transferManagement(accounts[4]);
        await converter.acceptManagement({ from: accounts[4] });

        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);

        await converter.disableConversions(true, { from: accounts[4] });
        conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, false);

        await converter.disableConversions(false, { from: accounts[4] });
        conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, true);
    });

    it('should throw when a non owner attempts to disable conversions', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.disableConversions(true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can disable / re-enable connector purchases', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        let connector = await converter.connectors.call(connectorToken.address);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
        await converter.disableConnectorPurchases(connectorToken.address, true);
        connector = await converter.connectors.call(connectorToken.address);
        verifyConnector(connector, true, false, weight10Percent, false, 0);
        await converter.disableConnectorPurchases(connectorToken.address, false);
        connector = await converter.connectors.call(connectorToken.address);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
    });

    it('should throw when a non owner attempts to disable connector purchases', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.disableConnectorPurchases(connectorToken.address, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to disable connector purchases for a connector that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.disableConnectorPurchases(connectorToken2.address, true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the correct connector balance is returned regardless of whether virtual balance is set or not', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        let connectorBalance;
        connectorBalance = await converter.getConnectorBalance.call(connectorToken.address);
        assert.equal(connectorBalance, 0);
        await connectorToken.transfer(converter.address, 1000);
        connectorBalance = await converter.getConnectorBalance.call(connectorToken.address);
        assert.equal(connectorBalance, 1000);
        await converter.updateConnector(connectorToken.address, 200000, true, 5000);
        connectorBalance = await converter.getConnectorBalance.call(connectorToken.address);
        assert.equal(connectorBalance, 5000);
        await converter.updateConnector(connectorToken.address, 200000, false, 5000);
        connectorBalance = await converter.getConnectorBalance.call(connectorToken.address);
        assert.equal(connectorBalance, 1000);
    });

    it('should throw when attempting to retrieve the balance for a connector that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorToken.address, weight10Percent, false);

        try {
            await converter.getConnectorBalance.call(connectorToken2.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can transfer the token ownership if the owner is the upgrader contract', async () => {
        let converter = await initConverter(accounts, true);

        let bancorConverterUpgraderId = await contractIds.BANCOR_CONVERTER_UPGRADER.call();
        await contractRegistry.registerAddress(bancorConverterUpgraderId, accounts[0]);

        await converter.transferTokenOwnership(accounts[1]);

        await contractRegistry.registerAddress(bancorConverterUpgraderId, upgrader.address);
        let tokenAddress = await converter.token.call();
        let contract = await web3.eth.contract(SmartTokenAbi);
        let token = await contract.at(tokenAddress);
        let newOwner = await token.newOwner.call();
        assert.equal(newOwner, accounts[1]);
    });

    it('should throw when the owner attempts to transfer the token ownership', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.transferTokenOwnership(accounts[1]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to transfer the token ownership', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.transferTokenOwnership(accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a the upgrader contract attempts to transfer the token ownership while the upgrader is not the owner', async () => {
        let converter = await initConverter(accounts, true);
        let bancorConverterUpgraderId = await contractIds.BANCOR_CONVERTER_UPGRADER.call();
        await contractRegistry.registerAddress(bancorConverterUpgraderId, accounts[2]);

        try {
            await converter.transferTokenOwnership(accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            await contractRegistry.registerAddress(bancorConverterUpgraderId, upgrader.address);
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can withdraw a non connector token from the converter while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        let token = await TestERC20Token.new('ERC Token 3', 'ERC3', 100000);
        await token.transfer(converter.address, 100);
        let balance = await token.balanceOf.call(converter.address);
        assert.equal(balance, 100);

        await converter.withdrawTokens(token.address, accounts[1], 50);
        balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 50);
    });

    it('verifies that the owner can withdraw a connector token from the converter while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        await converter.withdrawTokens(connectorToken.address, accounts[1], 50);
        balance = await connectorToken.balanceOf.call(accounts[1]);
        assert.equal(balance, 50);
    });

    it('verifies that the owner can withdraw a non connector token from the converter while the converter is active', async () => {
        let converter = await initConverter(accounts, true);

        let token = await TestERC20Token.new('ERC Token 3', 'ERC3', 100000);
        await token.transfer(converter.address, 100);
        let balance = await token.balanceOf.call(converter.address);
        assert.equal(balance, 100);

        await converter.withdrawTokens(token.address, accounts[1], 50);
        balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 50);
    });
 
    it('should throw when the owner attempts to withdraw a connector token while the converter is active', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.withdrawTokens(connectorToken.address, accounts[1], 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to withdraw a non connector token while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        let token = await TestERC20Token.new('ERC Token 3', 'ERC3', 100000);
        await token.transfer(converter.address, 100);
        let balance = await token.balanceOf.call(converter.address);
        assert.equal(balance, 100);

        try {
            await converter.withdrawTokens(token.address, accounts[1], 50, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to withdraw a connector token while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.withdrawTokens(connectorToken.address, accounts[1], 50, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to withdraw a connector token while the converter is active', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.withdrawTokens(connectorToken.address, accounts[1], 50, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can upgrade the converter while the converter is active', async () => {
        let converter = await initConverter(accounts, true);
        await converter.upgrade();
    });

    it('verifies that the owner can upgrade the converter while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await converter.upgrade();
    });

    it('verifies that the owner can upgrade the converter while the converter using the legacy upgrade function', async () => {
        let converter = await initConverter(accounts, true);
        await converter.transferOwnership(upgrader.address);
        await upgrader.upgradeOld(converter.address, web3.fromUtf8("0.9"));
    });

    it('should throw when a non owner attempts to upgrade the converter', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.upgrade({ from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getReturn.call(connectorToken.address, tokenAddress, 500))[0];
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
    });

    it('verifies that getReturn returns the same amount as getPurchaseReturn when converting from a connector to the token', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getReturn.call(connectorToken.address, tokenAddress, 500))[0];
        let purchaseReturnAmount = (await converter.getPurchaseReturn.call(connectorToken.address, 500))[0];
        assert.equal(returnAmount.toNumber(), purchaseReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as getSaleReturn when converting from the token to a connector', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getReturn.call(tokenAddress, connectorToken.address, 500))[0];
        let saleReturnAmount = (await converter.getSaleReturn.call(connectorToken.address, 500))[0];
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
        assert.equal(returnAmount.toNumber(), saleReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as buy -> sell when converting between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getReturn.call(connectorToken.address, connectorToken2.address, 500))[0];

        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorToken.address, tokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);
        let saleRes = await converter.convert(tokenAddress, connectorToken2.address, purchaseAmount, 1);
        let saleAmount = getConversionAmount(saleRes);

        // converting directly between 2 tokens is more efficient than buying and then selling
        // which might result in a very small rounding difference
        assert(returnAmount.minus(saleAmount).absoluteValue().toNumber() < 2);
    });

    it('verifies that Conversion event returns conversion fee after buying', async () => {
        let converter = await initConverter(accounts, true, 5000);
        await converter.setConversionFee(3000);
        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorToken.address, tokenAddress, 500, 1);
        assert(purchaseRes.logs.length > 0 && purchaseRes.logs[0].event == 'Conversion');
        assert('_conversionFee' in purchaseRes.logs[0].args);
    });

    it('verifies that Conversion event returns conversion fee after selling', async () => {
        let converter = await initConverter(accounts, true, 5000);
        await converter.setConversionFee(3000);
        await connectorToken.approve(converter.address, 500);
        let saleRes = await converter.convert(tokenAddress, connectorToken.address, 500, 1);
        assert(saleRes.logs.length > 0 && saleRes.logs[0].event == 'Conversion');
        assert('_conversionFee' in saleRes.logs[0].args);
    });

    it('should throw when attempting to get the return with an invalid from token adress', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call('0x0', connectorToken2.address, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with an invalid to token address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call(connectorToken.address, '0x0', 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with identical from/to addresses', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call(connectorToken.address, connectorToken.address, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.getPurchaseReturn.call(connectorToken.address, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return with a non connector address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getPurchaseReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while purchasing with the connector is disabled', async () => {
        let converter = await initConverter(accounts, true);
        await converter.disableConnectorPurchases(connectorToken.address, true);

        try {
            await converter.getPurchaseReturn.call(connectorToken.address, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.getSaleReturn.call(connectorToken.address, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return with a non connector address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getSaleReturn.call(tokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that convert returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);
        let res = await converter.convert(connectorToken.address, tokenAddress, 500, 1);
        let conversionAmount = getConversionAmount(res);
        assert.isNumber(conversionAmount);
        assert.notEqual(conversionAmount, 0);
    });

    it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorToken.address, tokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);
        let saleRes = await converter.convert(tokenAddress, connectorToken.address, purchaseAmount, 1);
        let saleAmount = getConversionAmount(saleRes);
        assert(saleAmount <= 500);
    });

    it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
        let converter = await initConverter(accounts, true);
        let saleRes = await converter.convert(tokenAddress, connectorToken.address, 500, 1);
        let saleAmount = getConversionAmount(saleRes);
        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorToken.address, tokenAddress, saleAmount, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        assert(purchaseAmount <= 500);
    });

    it('should throw when attempting to convert with an invalid from token adress', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert('0x0', connectorToken2.address, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert with an invalid to token address', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, '0x0', 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert with identical from/to addresses', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, connectorToken.address, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, connectorToken2.address, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert when the return is smaller than the minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, connectorToken2.address, 500, 2000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances after buy', async () => {
        let converter = await initConverter(accounts, true);

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let connectorTokenPrevBalance = await connectorToken.balanceOf.call(accounts[0]);

        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorToken.address, tokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        let connectorTokenNewBalance = await connectorToken.balanceOf.call(accounts[0]);
        assert.equal(connectorTokenNewBalance.toNumber(), connectorTokenPrevBalance.minus(500).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.plus(purchaseAmount).toNumber());
    });

    it('should throw when attempting to buy while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with a non connector address', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(tokenAddress, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the purchase yields 0 return', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to convert while conversions are disabled', async () => {
        let converter = await initConverter(accounts, true);
        await converter.disableConversions(true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with gas price higher than the universal limit', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 500, 1, { gasPrice: gasPriceBadHigh });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy with 0 minimum requested amount', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the connector purchases are disabled', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);
        await converter.disableConnectorPurchases(connectorToken.address, true);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy without first approving the converter to transfer from the buyer account in the connector contract', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.convert(connectorToken.address, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies balances after sell', async () => {
        let converter = await initConverter(accounts, true);

        let tokenPrevBalance = await token.balanceOf.call(accounts[0]);
        let connectorTokenPrevBalance = await connectorToken.balanceOf.call(accounts[0]);

        let saleRes = await converter.convert(tokenAddress, connectorToken.address, 500, 1);
        let saleAmount = getConversionAmount(saleRes);

        let connectorTokenNewBalance = await connectorToken.balanceOf.call(accounts[0]);
        assert.equal(connectorTokenNewBalance.toNumber(), connectorTokenPrevBalance.plus(saleAmount).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
    });

    it('should throw when attempting to sell while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.convert(tokenAddress, connectorToken.address, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with a non connector address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.convert(tokenAddress, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell while the sale yields 0 return', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.convert(tokenAddress, connectorToken.address, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with amount greater then the seller balance', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.convert(tokenAddress, connectorToken.address, 30000, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns the same amount as getCrossConnectorReturn when converting between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getReturn.call(connectorToken.address, connectorToken2.address, 500))[0];
        let returnAmount2 = (await converter.getCrossConnectorReturn.call(connectorToken.address, connectorToken2.address, 500))[0];
        assert.equal(returnAmount.toNumber(), returnAmount2.toNumber());
    });

    it('verifies that getCrossConnectorReturn returns the same amount as convert between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getCrossConnectorReturn.call(connectorToken.address, connectorToken2.address, 500))[0];

        await connectorToken.approve(converter.address, 500);
        let convertRes = await converter.convert(connectorToken.address, connectorToken2.address, 500, 1);
        let returnAmount2 = getConversionAmount(convertRes);

        assert.equal(returnAmount.toNumber(), returnAmount2);
    });

    it('verifies that getCrossConnectorReturn returns the same amount as convert between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = (await converter.getCrossConnectorReturn.call(connectorToken.address, connectorToken2.address, 500))[0];

        await connectorToken.approve(converter.address, 500);
        let convertRes = await converter.convert(connectorToken.address, connectorToken2.address, 500, 1);
        let returnAmount2 = getConversionAmount(convertRes);

        assert.equal(returnAmount.toNumber(), returnAmount2);
    });

    it('verifies that fund executes when the total connector weight equals 100%', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        let prevBalance = await token.balanceOf.call(accounts[0]);
        await connectorToken.approve(converter.address, 100000);
        await connectorToken2.approve(converter.address, 100000);
        await connectorToken3.approve(converter.address, 100000);
        await converter.fund(100);
        let balance = await token.balanceOf.call(accounts[0]);

        assert.equal(balance.toNumber(), prevBalance.toNumber() + 100);
    });

    it('verifies that fund updates the virtual balance correctly', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);
        await converter.updateConnector(connectorToken3.address, 600000, true, 7000);

        await connectorToken3.transfer(converter.address, 1000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 60);
        let prevConnector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        let token3Amount = prevConnector3Balance * percentage / 100;
        await connectorToken.approve(converter.address, 100000);
        await connectorToken2.approve(converter.address, 100000);
        await connectorToken3.approve(converter.address, 100000);
        await converter.fund(60);
        
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        assert.equal(connector3Balance.toNumber(), prevConnector3Balance.plus(Math.floor(token3Amount)).toNumber());
    });

    it('verifies that fund gets the correct connector balance amounts from the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await connectorToken.transfer(accounts[9], 5000);
        await connectorToken2.transfer(accounts[9], 5000);
        await connectorToken3.transfer(accounts[9], 5000);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 19);
        let prevConnector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let prevConnector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let prevConnector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        let token1Amount = prevConnector1Balance * percentage / 100;
        let token2Amount = prevConnector2Balance * percentage / 100;
        let token3Amount = prevConnector3Balance * percentage / 100;

        await connectorToken.approve(converter.address, 100000, { from: accounts[9] });
        await connectorToken2.approve(converter.address, 100000, { from: accounts[9] });
        await connectorToken3.approve(converter.address, 100000, { from: accounts[9] });
        await converter.fund(19, { from: accounts[9] });

        let connector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let connector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);

        assert.equal(connector1Balance.toNumber(), prevConnector1Balance.plus(Math.floor(token1Amount)));
        assert.equal(connector2Balance.toNumber(), prevConnector2Balance.plus(Math.floor(token2Amount)));
        assert.equal(connector3Balance.toNumber(), prevConnector3Balance.plus(Math.floor(token3Amount)));

        let token1Balance = await connectorToken.balanceOf.call(accounts[9]);
        let token2Balance = await connectorToken2.balanceOf.call(accounts[9]);
        let token3Balance = await connectorToken3.balanceOf.call(accounts[9]);

        await connectorToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await connectorToken2.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await connectorToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that increasing the liquidity by a large amount gets the correct connector balance amounts from the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await connectorToken.transfer(accounts[9], 500000);
        await connectorToken2.transfer(accounts[9], 500000);
        await connectorToken3.transfer(accounts[9], 500000);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 140854);
        let prevConnector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let prevConnector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let prevConnector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        let token1Amount = prevConnector1Balance * percentage / 100;
        let token2Amount = prevConnector2Balance * percentage / 100;
        let token3Amount = prevConnector3Balance * percentage / 100;

        await connectorToken.approve(converter.address, 100000, { from: accounts[9] });
        await connectorToken2.approve(converter.address, 100000, { from: accounts[9] });
        await connectorToken3.approve(converter.address, 100000, { from: accounts[9] });
        await converter.fund(140854, { from: accounts[9] });

        let connector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let connector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);

        assert.equal(connector1Balance.toNumber(), prevConnector1Balance.plus(Math.floor(token1Amount)));
        assert.equal(connector2Balance.toNumber(), prevConnector2Balance.plus(Math.floor(token2Amount)));
        assert.equal(connector3Balance.toNumber(), prevConnector3Balance.plus(Math.floor(token3Amount)));

        let token1Balance = await connectorToken.balanceOf.call(accounts[9]);
        let token2Balance = await connectorToken2.balanceOf.call(accounts[9]);
        let token3Balance = await connectorToken3.balanceOf.call(accounts[9]);

        await connectorToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await connectorToken2.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await connectorToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('should throw when attempting to fund the converter while conversions are disabled', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await connectorToken.approve(converter.address, 100000);
        await connectorToken2.approve(converter.address, 100000);
        await connectorToken3.approve(converter.address, 100000);
        await converter.fund(100);

        await converter.disableConversions(true);
        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, false);

        try {
            await converter.fund(100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to fund the converter when the total connector weight is not equal to 100%', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 500000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await connectorToken.approve(converter.address, 100000);
        await connectorToken2.approve(converter.address, 100000);
        await connectorToken3.approve(converter.address, 100000);

        try {
            await converter.fund(100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to fund the converter with insufficient funds', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await connectorToken.transfer(accounts[9], 100);
        await connectorToken2.transfer(accounts[9], 100);
        await connectorToken3.transfer(accounts[9], 100);

        await connectorToken.approve(converter.address, 100000, { from: accounts[9] });
        await connectorToken2.approve(converter.address, 100000, { from: accounts[9] });
        await connectorToken3.approve(converter.address, 100000, { from: accounts[9] });
        await converter.fund(5, { from: accounts[9] });

        try {
            await converter.fund(600, { from: accounts[9] });
            assert(false, "didn't throw");
        }
        catch (error) {
            let token1Balance = await connectorToken.balanceOf.call(accounts[9]);
            let token2Balance = await connectorToken2.balanceOf.call(accounts[9]);
            let token3Balance = await connectorToken3.balanceOf.call(accounts[9]);

            await connectorToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
            await connectorToken2.transfer(accounts[0], token2Balance, { from: accounts[9] });
            await connectorToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
            
            return utils.ensureException(error);
        }
    });

    it('verifies that liquidate executes when the total connector weight equals 100%', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        let prevSupply = await token.totalSupply.call();
        await converter.liquidate(100);
        let supply = await token.totalSupply();

        assert.equal(prevSupply - 100, supply);
    });

    it('verifies that liquidate updates the virtual balance correctly', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);
        await converter.updateConnector(connectorToken3.address, 600000, true, 7000);

        await connectorToken3.transfer(converter.address, 1000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 60);
        let prevConnector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        let token3Amount = prevConnector3Balance * percentage / 100;
        await converter.liquidate(60);
        
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        assert.equal(connector3Balance.toNumber(), prevConnector3Balance.minus(Math.floor(token3Amount)).toNumber());
    });

    it('verifies that liquidate sends the correct connector balance amounts to the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 100);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 19);
        let connector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let connector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        let token1Amount = connector1Balance * percentage / 100;
        let token2Amount = connector2Balance * percentage / 100;
        let token3Amount = connector3Balance * percentage / 100;

        await converter.liquidate(19, { from: accounts[9] });

        let token1Balance = await connectorToken.balanceOf.call(accounts[9]);
        let token2Balance = await connectorToken2.balanceOf.call(accounts[9]);
        let token3Balance = await connectorToken3.balanceOf.call(accounts[9]);

        assert.equal(token1Balance.toNumber(), Math.floor(token1Amount));
        assert.equal(token2Balance.toNumber(), Math.floor(token2Amount));
        assert.equal(token3Balance.toNumber(), Math.floor(token3Amount));

        await connectorToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await connectorToken2.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await connectorToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that liquidating a large amount sends the correct connector balance amounts to the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 15000);

        let supply = await token.totalSupply.call();
        let percentage = 100 / (supply / 14854);
        let connector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let connector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);
        let token1Amount = connector1Balance * percentage / 100;
        let token2Amount = connector2Balance * percentage / 100;
        let token3Amount = connector3Balance * percentage / 100;

        await converter.liquidate(14854, { from: accounts[9] });

        supply = await token.totalSupply.call();
        let token1Balance = await connectorToken.balanceOf.call(accounts[9]);
        let token2Balance = await connectorToken2.balanceOf.call(accounts[9]);
        let token3Balance = await connectorToken3.balanceOf.call(accounts[9]);

        assert.equal(token1Balance.toNumber(), Math.floor(token1Amount));
        assert.equal(token2Balance.toNumber(), Math.floor(token2Amount));
        assert.equal(token3Balance.toNumber(), Math.floor(token3Amount));

        await connectorToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await connectorToken2.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await connectorToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that liquidating the entire supply sends the full connector balances to the caller', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 20000);

        let connector1Balance = await converter.getConnectorBalance.call(connectorToken.address);
        let connector2Balance = await converter.getConnectorBalance.call(connectorToken2.address);
        let connector3Balance = await converter.getConnectorBalance.call(connectorToken3.address);

        await converter.liquidate(20000, { from: accounts[9] });

        let supply = await token.totalSupply.call();
        let token1Balance = await connectorToken.balanceOf.call(accounts[9]);
        let token2Balance = await connectorToken2.balanceOf.call(accounts[9]);
        let token3Balance = await connectorToken3.balanceOf.call(accounts[9]);

        assert.equal(supply, 0);
        assert.equal(token1Balance.toNumber(), connector1Balance.toNumber());
        assert.equal(token2Balance.toNumber(), connector2Balance.toNumber());
        assert.equal(token3Balance.toNumber(), connector3Balance.toNumber());

        await connectorToken.transfer(accounts[0], token1Balance, { from: accounts[9] });
        await connectorToken2.transfer(accounts[0], token2Balance, { from: accounts[9] });
        await connectorToken3.transfer(accounts[0], token3Balance, { from: accounts[9] });
    });

    it('verifies that liquidate executes when conversions are disabled', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await converter.disableConversions(true);
        let conversionsEnabled = await converter.conversionsEnabled.call();
        assert.equal(conversionsEnabled, false);

        let prevSupply = await token.totalSupply.call();
        await converter.liquidate(100);
        let supply = await token.totalSupply();

        assert.equal(prevSupply - 100, supply);
    });

    it('should throw when attempting to liquidate when the total connector weight is not equal to 100%', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 500000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        try {
            await converter.liquidate(100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to liquidate when the virtual balance is insufficient', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);
        await converter.updateConnector(connectorToken3.address, 600000, true, 7000);

        await connectorToken3.transfer(converter.address, 50);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await converter.liquidate(5);

        try {
            await converter.liquidate(600);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to liquidate with insufficient funds', async () => {
        let converter = await initConverter(accounts, false);
        await converter.addConnector(connectorToken3.address, 600000, false);

        await connectorToken3.transfer(converter.address, 6000);

        await token.transferOwnership(converter.address);
        await converter.acceptTokenOwnership();

        await token.transfer(accounts[9], 100);

        await converter.liquidate(5, { from: accounts[9] });

        try {
            await converter.liquidate(600, { from: accounts[9] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
