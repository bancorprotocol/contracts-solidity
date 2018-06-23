/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
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
let connectorTokenAddress;
let connectorTokenAddress2 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';

// used by purchase/sale tests
async function initConverter(accounts, activate, maxConversionFee = 0) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    tokenAddress = token.address;

    connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    connectorTokenAddress = connectorToken.address;

    connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    connectorTokenAddress2 = connectorToken2.address;

    let converter = await BancorConverter.new(
        tokenAddress,
        contractRegistry.address,
        maxConversionFee,
        connectorTokenAddress,
        250000
    );
    let converterAddress = converter.address;
    await converter.addConnector(connectorTokenAddress2, 150000, false);

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

        let token = await SmartToken.new('Token1', 'TKN1', 2);
        
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        tokenAddress = token.address;
        connectorTokenAddress = connectorToken.address;
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
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, connectorTokenAddress, 200000);
        let connectorToken = await converter.connectorTokens.call(0);
        assert.equal(connectorToken, connectorTokenAddress);
        let connector = await converter.connectors.call(connectorToken);
        verifyConnector(connector, true, true, 200000, false, 0);
    });

    it('should throw when attempting to construct a converter with a connector with invalid weight', async () => {
        try {
            await BancorConverter.new(tokenAddress, contractRegistry.address, 0, connectorTokenAddress, 1000001);
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
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);
        connectorTokenCount = await converter.connectorTokenCount.call();
        assert.equal(connectorTokenCount, 1);
    });

    it('verifies the owner can update the converter contract registry contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.setRegistry(accounts[3]);
        let registry = await converter.registry.call();
        assert.notEqual(registry, contractRegistry.address);
    });

    it('should throw when a non owner attempts update the converter contract registry contract address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.setRegistry(accounts[3], { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the attempts update the converter contract registry contract address with an invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.setRegistry('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts update the converter contract registry contract address with the converter address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.setRegistry(converter.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
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

    it('verifies that an event is fired when the owner update the fee', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 200000, '0x0', 0);
        let watcher = converter.ConversionFeeUpdate();
        await converter.setConversionFee(30000);
        let events = await watcher.get();
        assert.equal(events[0].args._prevFee.valueOf(), 0);
        assert.equal(events[0].args._newFee.valueOf(), 30000);
    });

    it('verifies that an event is fired when the owner update the fee multiple times', async () => {
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
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);
        let connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
        await converter.addConnector(connectorTokenAddress2, 200000, false);
        connector = await converter.connectors.call(connectorTokenAddress2);
        verifyConnector(connector, true, true, 200000, false, 0);
    });

    it('should throw when a non owner attempts to add a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(connectorTokenAddress, weight10Percent, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector when the converter is active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let converter = await BancorConverter.new(token.address, contractRegistry.address, 0, '0x0', 0);
        token.transferOwnership(converter.address);
        converter.acceptTokenOwnership();

        try {
            await converter.addConnector(connectorTokenAddress, weight10Percent, false);
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
            await converter.addConnector(connectorTokenAddress, 0, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add a connector with weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);

        try {
            await converter.addConnector(connectorTokenAddress, 1000001, false);
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
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.addConnector(connectorTokenAddress, 200000, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to add multiple connectors with total weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, 500000, false);

        try {
            await converter.addConnector(connectorTokenAddress2, 500001, false);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can update a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);
        let connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
        await converter.updateConnector(connectorTokenAddress, 200000, true, 50);
        connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, true, 200000, true, 50);
    });

    it('should throw when a non owner attempts to update a connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.updateConnector(connectorTokenAddress, 200000, false, 0, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.updateConnector(connectorTokenAddress2, 200000, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector with weight = 0', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.updateConnector(connectorTokenAddress, 0, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector with weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.updateConnector(connectorTokenAddress, 1000001, false, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to update a connector that will result in total weight greater than 100%', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, 500000, false);
        await converter.addConnector(connectorTokenAddress2, 400000, false);

        try {
            await converter.updateConnector(connectorTokenAddress2, 500001, false, 0);
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
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);
        let connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
        await converter.disableConnectorPurchases(connectorTokenAddress, true);
        connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, false, weight10Percent, false, 0);
        await converter.disableConnectorPurchases(connectorTokenAddress, false);
        connector = await converter.connectors.call(connectorTokenAddress);
        verifyConnector(connector, true, true, weight10Percent, false, 0);
    });

    it('should throw when a non owner attempts to disable connector purchases', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.disableConnectorPurchases(connectorTokenAddress, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to disable connector purchases for a connector that does not exist', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.disableConnectorPurchases(connectorTokenAddress2, true);
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
        await converter.addConnector(connectorTokenAddress, weight10Percent, false);

        try {
            await converter.getConnectorBalance.call(connectorTokenAddress2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can withdraw from the connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        await connectorToken.transfer(converter.address, 1000);
        let converterBalance = await connectorToken.balanceOf(converter.address);
        assert.equal(converterBalance, 1000);
        await converter.withdrawTokens(connectorToken.address, accounts[2], 50);
        converterBalance = await connectorToken.balanceOf(converter.address);
        assert.equal(converterBalance, 950);
        let account2Balance = await connectorToken.balanceOf(accounts[2]);
        assert.equal(account2Balance, 50);
    });

    it('should throw when a non owner attempts to withdraw from the connector', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        await connectorToken.transfer(converter.address, 1000);

        try {
            await converter.withdrawTokens(connectorToken.address, accounts[3], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a connector to an invalid address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        await connectorToken.transfer(converter.address, 1000);

        try {
            await converter.withdrawTokens(connectorToken.address, '0x0', 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to withdraw from a connector to the converter address', async () => {
        let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, 0, '0x0', 0);
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await converter.addConnector(connectorToken.address, weight10Percent, false);
        await connectorToken.transfer(converter.address, 1000);

        try {
            await converter.withdrawTokens(connectorToken.address, converter.address, 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns a valid amount', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(connectorTokenAddress, tokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
    });

    it('verifies that getReturn returns the same amount as getPurchaseReturn when converting from a connector to the token', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(connectorTokenAddress, tokenAddress, 500);
        let purchaseReturnAmount = await converter.getPurchaseReturn.call(connectorTokenAddress, 500);
        assert.equal(returnAmount.toNumber(), purchaseReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as getSaleReturn when converting from the token to a connector', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(tokenAddress, connectorTokenAddress, 500);
        let saleReturnAmount = await converter.getSaleReturn.call(connectorTokenAddress, 500);
        assert.isNumber(returnAmount.toNumber());
        assert.notEqual(returnAmount.toNumber(), 0);
        assert.equal(returnAmount.toNumber(), saleReturnAmount.toNumber());
    });

    it('verifies that getReturn returns the same amount as buy -> sell when converting between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(connectorTokenAddress, connectorTokenAddress2, 500);

        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);
        let saleRes = await converter.convert(tokenAddress, connectorTokenAddress2, purchaseAmount, 1);
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
        let saleRes = await converter.convert(tokenAddress, connectorTokenAddress, 500, 1);
        assert(saleRes.logs.length > 0 && saleRes.logs[0].event == 'Conversion');
        assert('_conversionFee' in saleRes.logs[0].args);
    });

    it('should throw when attempting to get the return with an invalid from token adress', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call('0x0', connectorTokenAddress2, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with an invalid to token address', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call(connectorTokenAddress, '0x0', 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return with identical from/to addresses', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.getReturn.call(connectorTokenAddress, connectorTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the purchase return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.getPurchaseReturn.call(connectorTokenAddress, 500);
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
        await converter.disableConnectorPurchases(connectorTokenAddress, true);

        try {
            await converter.getPurchaseReturn.call(connectorTokenAddress, 500);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the sale return while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.getSaleReturn.call(connectorTokenAddress, 500);
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
        let res = await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
        let conversionAmount = getConversionAmount(res);
        assert.isNumber(conversionAmount);
        assert.notEqual(conversionAmount, 0);
    });

    it('verifies that selling right after buying does not result in an amount greater than the original purchase amount', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);
        let saleRes = await converter.convert(tokenAddress, connectorTokenAddress, purchaseAmount, 1);
        let saleAmount = getConversionAmount(saleRes);
        assert(saleAmount <= 500);
    });

    it('verifies that buying right after selling does not result in an amount greater than the original sale amount', async () => {
        let converter = await initConverter(accounts, true);
        let saleRes = await converter.convert(tokenAddress, connectorTokenAddress, 500, 1);
        let saleAmount = getConversionAmount(saleRes);
        await connectorToken.approve(converter.address, 500);
        let purchaseRes = await converter.convert(connectorTokenAddress, tokenAddress, saleAmount, 1);
        let purchaseAmount = getConversionAmount(purchaseRes);

        assert(purchaseAmount <= 500);
    });

    it('should throw when attempting to convert with an invalid from token adress', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);

        try {
            await converter.convert('0x0', connectorTokenAddress2, 500, 1);
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
            await converter.convert(connectorTokenAddress, '0x0', 500, 1);
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
            await converter.convert(connectorTokenAddress, connectorTokenAddress, 500, 0);
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
            await converter.convert(connectorTokenAddress, connectorTokenAddress2, 500, 2000);
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
            await converter.convert(connectorTokenAddress, connectorTokenAddress2, 500, 2000);
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
        let purchaseRes = await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
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
            await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
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
            await converter.convert(connectorTokenAddress, tokenAddress, 0, 1);
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
            await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
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
            await converter.convert(connectorTokenAddress, tokenAddress, 500, 1, { gasPrice: gasPriceBadHigh });
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
            await converter.convert(connectorTokenAddress, tokenAddress, 500, 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy while the connector purchases are disabled', async () => {
        let converter = await initConverter(accounts, true);
        await connectorToken.approve(converter.address, 500);
        await converter.disableConnectorPurchases(connectorTokenAddress, true);

        try {
            await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to buy without first approving the converter to transfer from the buyer account in the connector contract', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.convert(connectorTokenAddress, tokenAddress, 500, 1);
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

        let saleRes = await converter.convert(tokenAddress, connectorTokenAddress, 500, 1);
        let saleAmount = getConversionAmount(saleRes);

        let connectorTokenNewBalance = await connectorToken.balanceOf.call(accounts[0]);
        assert.equal(connectorTokenNewBalance.toNumber(), connectorTokenPrevBalance.plus(saleAmount).toNumber());

        let tokenNewBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenNewBalance.toNumber(), tokenPrevBalance.minus(500).toNumber());
    });

    it('should throw when attempting to sell while the converter is not active', async () => {
        let converter = await initConverter(accounts, false);

        try {
            await converter.convert(tokenAddress, connectorTokenAddress, 500, 1);
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
            await converter.convert(tokenAddress, connectorTokenAddress, 0, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to sell with amount greater then the seller balance', async () => {
        let converter = await initConverter(accounts, true);

        try {
            await converter.convert(tokenAddress, connectorTokenAddress, 30000, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturn returns the same amount as getCrossConnectorReturn when converting between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getReturn.call(connectorTokenAddress, connectorTokenAddress2, 500);
        let returnAmount2 = await converter.getCrossConnectorReturn.call(connectorTokenAddress, connectorTokenAddress2, 500);
        assert.equal(returnAmount.toNumber(), returnAmount2.toNumber());
    });

    it('verifies that getCrossConnectorReturn returns the same amount as convert between 2 connectors', async () => {
        let converter = await initConverter(accounts, true);
        let returnAmount = await converter.getCrossConnectorReturn.call(connectorTokenAddress, connectorTokenAddress2, 500);

        await connectorToken.approve(converter.address, 500);
        let convertRes = await converter.convert(connectorTokenAddress, connectorTokenAddress2, 500, 1);
        let returnAmount2 = getConversionAmount(convertRes);

        assert.equal(returnAmount.toNumber(), returnAmount2);
    });
});
