/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const BancorConverter = require('./helpers/BancorConverter');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const ContractFeatures = artifacts.require('ContractFeatures');
const ERC20Token = artifacts.require('ERC20Token');
const Whitelist = artifacts.require('Whitelist');
const BancorConverterFactory = artifacts.require('BancorConverterFactory');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader');

const versions = [9, 10, 11];

let token;
let contractRegistry;
let contractFeatures;
let converterUpgrader;

async function initConverter(accounts, activate, version = null, maxConversionFee = 30000) {
    token = await SmartToken.new('Token1', 'TKN1', 18);
    let tokenAddress = token.address;

    let connectorToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
    let connectorTokenAddress = connectorToken.address;

    let connectorToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, 200000);
    let connectorTokenAddress2 = connectorToken2.address;

    let converter = await BancorConverter.new(tokenAddress, contractRegistry.address, maxConversionFee, connectorTokenAddress, 500000, version);
    let converterAddress = converter.address;
    await converter.addConnector(connectorTokenAddress2, 150000, false);

    await token.issue(accounts[0], 20000);
    await connectorToken.transfer(converterAddress, 5000);
    await connectorToken2.transfer(converterAddress, 8000);
    await converter.setConversionFee(1000);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

async function upgradeConverter(converter, version = null) {
    let newConverter;

    // for the latest version, we just call upgrade on the converter
    if (!version) {
        await converter.upgrade();
        newConverter = await getNewConverter();
    }
    else {
        // for previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
        // then accept ownership of the new and old converter. The end results should be the same.
        await converter.transferOwnership(converterUpgrader.address);
        await converterUpgrader.upgradeOld(converter.address, web3.fromAscii(`0.${version}`));
        newConverter = await getNewConverter();
        await converter.acceptOwnership();
    }

    return newConverter;
}

async function getNewConverter() {
    let converterUpgrade = converterUpgrader.ConverterUpgrade({fromBlock: 'latest', toBlock: 'latest'});
    newConverterAddress = await new Promise((resolve, reject) => {
        converterUpgrade.get((error, logs) => {
            assert(logs.length == 1);
            resolve(logs[0].args._newConverter);
        });
    });

    let converter = await BancorConverter.at(newConverterAddress);
    return converter;
}

contract('BancorConverterUpgrader', accounts => {
    before(async () => {
        contractRegistry = await ContractRegistry.new();

        contractFeatures = await ContractFeatures.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_FEATURES, contractFeatures.address);

        let converterFactory = await BancorConverterFactory.new();
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_FACTORY, converterFactory.address);

        converterUpgrader = await BancorConverterUpgrader.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_UPGRADER, converterUpgrader.address);
    });

    it('verifies that the ownership of the converter is returned to the original owner after upgrade', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let initialOwner = await converter.owner.call();
            await upgradeConverter(converter, versions[i])
            let currentOwner = await converter.owner.call();
            assert.equal(initialOwner, currentOwner);    
        }
    });

    it('verifies that the ownership of the new converter is transfered to the old converter owner', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let initialOwner = await converter.owner.call();
            let newConverter = await upgradeConverter(converter, versions[i])

            let newOwner = await newConverter.newOwner.call();
            assert.equal(initialOwner, newOwner);    
        }
    });

    it('verifies that the token ownership held by the converter is transfered to the new converter', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let tokenAddress = await converter.token.call();
            let token1 = await SmartToken.at(tokenAddress)
            let initialTokenOwner = await token1.owner.call();
            assert.equal(initialTokenOwner, converter.address);
            let newConverter = await upgradeConverter(converter, versions[i]);
            let currentTokenOwner = await token1.owner.call();
            assert.equal(currentTokenOwner, newConverter.address);    
        }        
    });

    it('verifies that the whitelist feature is enabled in the new converter', async () => {
        let converter = await initConverter(accounts, true);
        await converter.upgrade();
        let newConverter = await getNewConverter();
        
        let featureWhitelist = await newConverter.CONVERTER_CONVERSION_WHITELIST.call();
        let isSupported = await contractFeatures.isSupported.call(newConverter.address, featureWhitelist);
        assert(isSupported);
    });

    it('verifies that the whitelist from the converter is copied to the new converter', async () => {
        let converter = await initConverter(accounts, true);
        let whitelist = await Whitelist.new();
        await converter.setConversionWhitelist(whitelist.address);
        await converter.upgrade();
        let newConverter = await getNewConverter();
        let conversionWhitelist = await newConverter.conversionWhitelist.call();
        assert.equal(whitelist.address, conversionWhitelist);
    });

    it('should throw if the upgrader did not receive the converter ownership before calling the upgrade function', async () => {
        let converter = await initConverter(accounts, true);
        await utils.catchRevert(converterUpgrader.upgradeOld(converter.address, web3.fromUtf8("0.7")));
    });

    it('verifies that the max conversion fee after upgrade is the same', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i], 20000);
            let newConverter = await upgradeConverter(converter, versions[i]);
            let newVal = await newConverter.maxConversionFee.call();
            assert.equal(newVal.toFixed(), "20000");            
        }

    });

    it('verifies that the conversion fee after upgrade is the same', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let initialConversionFee = await converter.conversionFee.call();
            let newConverter = await upgradeConverter(converter, versions[i]);
            let currentConversionFee = await newConverter.conversionFee.call();
            assert.equal(initialConversionFee.toFixed(), currentConversionFee.toFixed());            
        }
    });

    it('verifies that the ownership did not change if the process stopped due to gas limitation', async () => {
        let converter = await initConverter(accounts, true);
        let initialOwner = await converter.owner.call();
        
        await utils.catchRevert(converter.upgrade({ gas: 2000000 }));
        let currentOwner = await converter.owner.call();
        assert.equal(initialOwner, currentOwner);
    });

    it('verifies upgrade of converter without connectors', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let converter1 = await BancorConverter.new(token1.address, contractRegistry.address, 30000, '0x0', 0);
        await token1.issue(accounts[0], 20000);
        await token1.transferOwnership(converter1.address);
        await converter1.acceptTokenOwnership();
        let currentMaxConversionFee = await converter1.maxConversionFee.call();
        await converter1.upgrade();
        let newConverter = await getNewConverter();
        let newConverterConnectorTokenCount = await newConverter.connectorTokenCount.call();
        assert.equal(newConverterConnectorTokenCount.toFixed(), 0);
        let newTokenOwner = await token1.owner.call();
        assert.equal(newTokenOwner, newConverter.address);
        let newMaxConversionFee = await newConverter.maxConversionFee.call();
        assert.equal(currentMaxConversionFee.toFixed(), newMaxConversionFee.toFixed());
    });

    it('verifies that the connectors count after an upgrade is the same', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let currentConverterConnectorTokenCount = await converter.connectorTokenCount.call();
            let newConverter = await upgradeConverter(converter, versions[i]);
            let newConverterConnectorTokenCount = await newConverter.connectorTokenCount.call();
            assert.equal(currentConverterConnectorTokenCount.toFixed(), newConverterConnectorTokenCount.toFixed());            
        }
    });

    it('verifies that the connector balances after upgrade is equal', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let connector1 = await converter.connectorTokens.call(0);
            let connector2 = await converter.connectorTokens.call(1);
            let initialConnectorBalance1 = await converter.getConnectorBalance.call(connector1);
            let initialConnectorBalance2 = await converter.getConnectorBalance.call(connector2);
            let newConverter = await upgradeConverter(converter, versions[i]);
            let currentConnectorBalance1 = await newConverter.getConnectorBalance.call(connector1);
            let currentConnectorBalance2 = await newConverter.getConnectorBalance.call(connector2);
            assert.equal(initialConnectorBalance1.toFixed(), currentConnectorBalance1.toFixed());
            assert.equal(initialConnectorBalance2.toFixed(), currentConnectorBalance2.toFixed());            
        }
    });

    it('verifies that balances did not change if the process stopped due to gas limitation', async () => {
        let converter = await initConverter(accounts, true);
        let connector1 = await converter.connectorTokens.call(0);
        let connector2 = await converter.connectorTokens.call(1);
        let initialConnectorBalance1 = await converter.getConnectorBalance.call(connector1);
        let initialConnectorBalance2 = await converter.getConnectorBalance.call(connector2);
        
        await utils.catchRevert(converter.upgrade({ gas: 2000000 }));
        let currentConnectorBalance1 = await converter.getConnectorBalance.call(connector1);
        let currentConnectorBalance2 = await converter.getConnectorBalance.call(connector2);
        assert.equal(initialConnectorBalance1.toFixed(), currentConnectorBalance1.toFixed());
        assert.equal(initialConnectorBalance2.toFixed(), currentConnectorBalance2.toFixed());
    });

    it('verifies upgrade of a non active converter', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let connectorToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
        let connectorTokenAddress = connectorToken.address;
        let connectorToken2 = await ERC20Token.new('ERC Token 2', 'ERC2', 0, 200000);
        let connectorTokenAddress2 = connectorToken2.address;
        let converter1 = await BancorConverter.new(token1.address, contractRegistry.address, 30000, connectorTokenAddress, 500000);
        await converter1.addConnector(connectorTokenAddress2, 500000, false);
        await connectorToken.transfer(converter1.address, 5000);
        await connectorToken2.transfer(converter1.address, 8000);
        await token1.issue(accounts[0], 20000);
        let currentMaxConversionFee = await converter1.maxConversionFee.call();
        await converter1.upgrade();
        let newConverter = await getNewConverter();
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
