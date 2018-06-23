/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const fs = require('fs');
const path = require('path');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const Whitelist = artifacts.require('Whitelist.sol');
const BancorConverterFactory = artifacts.require('BancorConverterFactory.sol');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader.sol');
const utils = require('./helpers/Utils');

let token;
let contractRegistry;
let contractFeatures;
let converterUpgrader;

const contractsPath = path.resolve(__dirname, '../contracts/build');
let abi;
abi = fs.readFileSync(path.resolve(contractsPath, 'BancorConverter.abi'), 'utf-8');
let converterAbi = JSON.parse(abi);
abi = fs.readFileSync(path.resolve(contractsPath, 'SmartToken.abi'), 'utf-8');
let SmartTokenAbi = JSON.parse(abi);

async function initConverter(accounts, activate, maxConversionFee = 30000) {
    token = await SmartToken.new('Token1', 'TKN1', 18);
    let tokenAddress = token.address;

    let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    let connectorTokenAddress = connectorToken.address;

    let connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    let connectorTokenAddress2 = connectorToken2.address;

    let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, maxConversionFee, connectorTokenAddress, 500000);
    let converterAddress = converter.address;
    await converter.addConnector(connectorTokenAddress2, 150000, false);

    await token.issue(accounts[0], 20000);
    await connectorToken.transfer(converterAddress, 5000);
    await connectorToken2.transfer(converterAddress, 8000);
    await converter.setConversionFee(1000);

    let smartToken1QuickBuyPath = [connectorTokenAddress, tokenAddress, tokenAddress];
    await converter.setQuickBuyPath(smartToken1QuickBuyPath);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

contract('BancorConverterUpgrader', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();
        let contractIds = await ContractIds.new();

        contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let formula = await BancorFormula.new();
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        let bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork.setSignerAddress(accounts[3]);

        let converterFactory = await BancorConverterFactory.new();
        let converterFactoryId = await contractIds.BANCOR_CONVERTER_FACTORY.call();
        await contractRegistry.registerAddress(converterFactoryId, converterFactory.address);

        converterUpgrader = await BancorConverterUpgrader.new(contractRegistry.address);
    });

    it('verifies that the ownership of the given converter returned to the given address', async () => {
        let converter = await initConverter(accounts, true);
        let initialOwner = await converter.owner.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        await converter.acceptOwnership();
        let currentOwner = await converter.owner.call();
        assert.equal(initialOwner, currentOwner);
    });

    it('verifies that the ownership of the new converter transfered to sender', async () => {
        let converter = await initConverter(accounts, true);
        await converter.transferOwnership(converterUpgrader.address);
        let initialOwner = await converter.owner.call();
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = await web3.eth.contract(converterAbi);
        let newConverter = await contract.at(newConverterAddress);
        let newOwner = await newConverter.newOwner.call();
        assert.equal(initialOwner, newOwner);
    });

    it('verifies that the token ownership held by current converter transfered to the new converter', async () => {
        let converter = await initConverter(accounts, true);
        let tokenAddress = await converter.token.call();
        let tokenContract = web3.eth.contract(SmartTokenAbi);
        let token1 = tokenContract.at(tokenAddress);
        let initialTokenOwner = await token1.owner.call();
        assert.equal(initialTokenOwner, converter.address);
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let currentTokenOwner = await token1.owner.call();
        assert.equal(currentTokenOwner, newConverterAddress);
    });

    it('verifies that the management of the new converter transfered to sender', async () => {
        let converter = await initConverter(accounts, true);
        await converter.transferOwnership(converterUpgrader.address);
        let initialManager = await converter.manager.call();
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = await web3.eth.contract(converterAbi);
        let newConverter = await contract.at(newConverterAddress);
        let newManager = await newConverter.newManager.call();
        assert.equal(initialManager, newManager);
    });

    it('verifies that the quick buy path length of the given converter equal to the path in the new converter', async () => {
        let converter = await initConverter(accounts, true);
        let initialLength = await converter.getQuickBuyPathLength.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = await web3.eth.contract(converterAbi);
        let newConverter = await contract.at(newConverterAddress);
        let newLength = await newConverter.getQuickBuyPathLength.call();
        assert.equal(initialLength.toFixed(), newLength.toFixed());
    });

    it('verifies that the whitelist feature is enabled in the new converter', async () => {
        let converter = await initConverter(accounts, true);
        let initialLength = await converter.getQuickBuyPathLength.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = await web3.eth.contract(converterAbi);
        let newConverter = await contract.at(newConverterAddress);

        let featureWhitelist = await newConverter.CONVERTER_CONVERSION_WHITELIST.call();
        let isSupported = await contractFeatures.isSupported.call(newConverter.address, featureWhitelist);
        assert(isSupported);
    });

    it('verifies that the whitelist from the given converter is copied to the new converter', async () => {
        let converter = await initConverter(accounts, true);
        let initialLength = await converter.getQuickBuyPathLength.call();
        let whitelist = await Whitelist.new();
        await converter.setConversionWhitelist(whitelist.address);
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = await web3.eth.contract(converterAbi);
        let newConverter = await contract.at(newConverterAddress);
        let conversionWhitelist = await newConverter.conversionWhitelist.call();
        assert.equal(whitelist.address, conversionWhitelist);
    });

    it('verifies that the quick buy path of the new converter is equal to the path in the given converter', async () => {
        let converter = await initConverter(accounts, true);
        let initialConversionFee = await converter.conversionFee.call();
        let initialPathLength = await converter.getQuickBuyPathLength.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        for (let i = 0; i < initialPathLength; i++) {
            let initialToken = await converter.quickBuyPath.call(i);
            let currentToken = await newConverter.quickBuyPath.call(i);
            assert.equal(initialToken, currentToken);
        }
    });

    it('should throw after the ownership transfered to the contract and upgrade execution triggered from another account', async () => {
        try {
            let converter = await initConverter(accounts, true);
            await converter.transferOwnership(converterUpgrader.address);
            await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"), { from: accounts[1] });
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when start upgrade execution process without transfer the ownership first', async () => {
        try {
            let converter = await initConverter(accounts, true);
            await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the max conversion fee after upgrade is the same', async () => {
        let converter = await initConverter(accounts, true, 20000);
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let newVal = await newConverter.maxConversionFee.call();
        assert.equal(newVal.toFixed(), "20000");
    });

    it('verifies that the conversion fee after upgrade is the same', async () => {
        let converter = await initConverter(accounts, true);
        let initialConversionFee = await converter.conversionFee.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let currentConversionFee = await newConverter.conversionFee.call();
        assert.equal(initialConversionFee.toFixed(), currentConversionFee.toFixed());
    });

    it('verifies that the ownership did not changed if the process stopped due to gas limitation', async () => {
        let converter = await initConverter(accounts, true);
        let initialOwner = await converter.owner.call();
        await converter.transferOwnership(converterUpgrader.address);
        try {
            await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"), { gas: 2000000 });
            assert.fail('Expected throw not received');
        }
        catch (error) {
            let currentOwner = await converter.owner.call();
            assert.equal(initialOwner, currentOwner);
            return utils.ensureException(error);
        }
    });

    it('verifies that the upgrade process of converter without connectors success', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let formula = await BancorFormula.new();
        let converter1 = await BancorConverter.new(token1.address, contractRegistry.address, 30000, '0x0', 0);
        await token1.issue(accounts[0], 20000);
        await token1.transferOwnership(converter1.address);
        await converter1.acceptTokenOwnership();
        let currentOwner = await converter1.owner.call();
        let currentMaxConversionFee = await converter1.maxConversionFee.call();
        await converter1.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter1.address, 7);
        await converter1.acceptOwnership();
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let newConverterConnectorTokenCount = await newConverter.connectorTokenCount.call();
        assert.equal(newConverterConnectorTokenCount.toFixed(), 0);
        let newTokenOwner = await token1.owner.call();
        assert.equal(newTokenOwner, newConverterAddress);
        let newMaxConversionFee = await newConverter.maxConversionFee.call();
        assert.equal(currentMaxConversionFee.toFixed(), newMaxConversionFee.toFixed());
    });

    it('verifies that the connectors count after upgrade is the same', async () => {
        let converter = await initConverter(accounts, true);
        let currentConverterConnectorTokenCount = await converter.connectorTokenCount.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let newConverterConnectorTokenCount = await newConverter.connectorTokenCount.call();
        assert.equal(currentConverterConnectorTokenCount.toFixed(), newConverterConnectorTokenCount.toFixed());
    });

    it('verifies that the connectors balances after upgrade is equal', async () => {
        let converter = await initConverter(accounts, true);
        let connector1 = await converter.connectorTokens.call(0);
        let connector2 = await converter.connectorTokens.call(1);
        let initialConnectorBalance1 = await converter.getConnectorBalance.call(connector1);
        let initialConnectorBalance2 = await converter.getConnectorBalance.call(connector2);
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let currentConnectorBalance1 = await newConverter.getConnectorBalance.call(connector1);
        let currentConnectorBalance2 = await newConverter.getConnectorBalance.call(connector2);
        assert.equal(initialConnectorBalance1.toFixed(), currentConnectorBalance1.toFixed());
        assert.equal(initialConnectorBalance2.toFixed(), currentConnectorBalance2.toFixed());
    });

    it('verifies that balances did not changed if the process stopped due to gas limitation', async () => {
        let converter = await initConverter(accounts, true);
        let connector1 = await converter.connectorTokens.call(0);
        let connector2 = await converter.connectorTokens.call(1);
        let initialConnectorBalance1 = await converter.getConnectorBalance.call(connector1);
        let initialConnectorBalance2 = await converter.getConnectorBalance.call(connector2);
        await converter.transferOwnership(converterUpgrader.address);
        try {
            await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"), { gas: 2000000 });
            assert.fail('Expected throw not received');
        }
        catch (error) {
            let currentConnectorBalance1 = await converter.getConnectorBalance.call(connector1);
            let currentConnectorBalance2 = await converter.getConnectorBalance.call(connector2);
            assert.equal(initialConnectorBalance1.toFixed(), currentConnectorBalance1.toFixed());
            assert.equal(initialConnectorBalance2.toFixed(), currentConnectorBalance2.toFixed());
            return utils.ensureException(error);
        }
    });

    it('verifies that the upgrade process of non active converter success', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let formula = await BancorFormula.new();
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        let connectorTokenAddress = connectorToken.address;
        let connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
        let connectorTokenAddress2 = connectorToken2.address;
        let converter1 = await BancorConverter.new(token1.address, contractRegistry.address, 30000, connectorTokenAddress, 500000);
        await converter1.addConnector(connectorTokenAddress2, 500000, false);
        await connectorToken.transfer(converter1.address, 5000);
        await connectorToken2.transfer(converter1.address, 8000);
        await token1.issue(accounts[0], 20000);
        let currentOwner = await converter1.owner.call();
        let currentMaxConversionFee = await converter1.maxConversionFee.call();
        await converter1.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter1.address, 7);
        await converter1.acceptOwnership();
        let newConverterAddress = upgradeRes.logs[3].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let newConverterConnectorTokenCount = await newConverter.connectorTokenCount.call();
        assert.equal(newConverterConnectorTokenCount.toFixed(), 2);
        let newMaxConversionFee = await newConverter.maxConversionFee.call();
        assert.equal(currentMaxConversionFee.toFixed(), newMaxConversionFee.toFixed());
        let currentConnectorBalance1 = await newConverter.getConnectorBalance.call(connectorToken.address);
        let currentConnectorBalance2 = await newConverter.getConnectorBalance.call(connectorToken2.address);
        assert.equal(currentConnectorBalance1.toFixed(), 5000);
        assert.equal(currentConnectorBalance2.toFixed(), 8000);
    });
});
