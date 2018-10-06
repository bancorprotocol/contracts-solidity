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
const truffleContract = require('truffle-contract');
const web3Utils = require('web3-utils')

let token;
let contractRegistry;
let contractFeatures;
let converterUpgrader;

// The tests will be ran for each of these converter versions
const versions = ["0.11", "0.10", "0.9"]

const contractsPath = path.resolve(__dirname, './bin');

const converters = {
    "0.9": { filename: 'bancor_converter_v9' },
    "0.10": { filename: 'bancor_converter_v10' }
};

loadDataFiles(contractsPath, converters)

async function initConverter(accounts, activate, version = null, maxConversionFee = 30000) {
    token = await SmartToken.new('Token1', 'TKN1', 18);
    let tokenAddress = token.address;

    let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    let connectorTokenAddress = connectorToken.address;

    let connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    let connectorTokenAddress2 = connectorToken2.address;

    let converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee, connectorTokenAddress, 500000, version);
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

async function createConverter(tokenAddress, registryAddress, maxConversionFee, connectorTokenAddress, weight, version) {
    let converter

    // If no version is passed, create newest converter
    if (version == "0.11" || !version) {
        converter = await BancorConverter.new(tokenAddress, registryAddress, maxConversionFee, connectorTokenAddress, weight)
    }
    else {
        let abi = converters[version]['abi']
        let byteCode = '0x' + converters[version]['bin']
        let converterContract = truffleContract({ abi, unlinked_binary: byteCode })
        converterContract.setProvider(web3.currentProvider)
        converterContract.defaults({ from: web3.eth.accounts[0], gas: 5712388 })

        converter = await converterContract.new(tokenAddress, registryAddress, maxConversionFee, connectorTokenAddress, weight)
    }

    return converter
}

async function upgradeConverter(converter, version = null) {
    let newConverter

    // For the latest version, we just call upgrade on the converter
    if (version == "0.11" || !version) {
        await converter.upgrade()
        newConverter = await getNewConverter()
    } else {
        // For previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
        // then accept ownership of the new and old converter. The end results should be the same.
        await converter.transferOwnership(converterUpgrader.address)
        let newOwner = await converter.newOwner.call()
        await converterUpgrader.upgradeOld(converter.address, web3Utils.asciiToHex(version))
        newConverter = await getNewConverter()
        await converter.acceptOwnership()
    }

    return newConverter
}

async function getNewConverter() {
    let converterUpgrade = converterUpgrader.ConverterUpgrade({fromBlock: 'latest', toBlock: 'latest'});
    newConverterAddress = await new Promise((resolve, reject) => {
        converterUpgrade.get((error, logs) => {
            assert(logs.length == 1);
            resolve(logs[0].args._newConverter);
        });
    });

    let converter = await BancorConverter.at(newConverterAddress)
    return converter
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
        let bancorConverterUpgraderId = await contractIds.BANCOR_CONVERTER_UPGRADER.call();
        await contractRegistry.registerAddress(bancorConverterUpgraderId, converterUpgrader.address);
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

    it('verifies that the management of the new converter is transfered to the old converter owner', async () => {        
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let initialManager = await converter.manager.call();
            let newConverter = await upgradeConverter(converter, versions[i]);
            let newManager = await newConverter.newManager.call();
            assert.equal(initialManager, newManager);    
        }
    });

    it('verifies that the quick buy path length of the converter is equal to the path length in the new converter', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let initialLength = await converter.getQuickBuyPathLength.call();
            let newConverter = await upgradeConverter(converter, versions[i]);
            let newLength = await newConverter.getQuickBuyPathLength.call();
            assert.equal(initialLength.toFixed(), newLength.toFixed());    
        }                
    });

    it('verifies that the quick buy path of the new converter is equal to the path in the old converter', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let initialPathLength = await converter.getQuickBuyPathLength.call();
            let newConverter = await upgradeConverter(converter, versions[i]);
            for (let i = 0; i < initialPathLength; i++) {
                let initialToken = await converter.quickBuyPath.call(i);
                let currentToken = await newConverter.quickBuyPath.call(i);
                assert.equal(initialToken, currentToken);
            }    
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
        try {
            let converter = await initConverter(accounts, true);
            await converterUpgrader.upgradeOld(converter.address, web3.fromUtf8("0.7"));
        }
        catch (error) {
            return utils.ensureException(error);
        }
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
        
        try {
            await converter.upgrade({ gas: 2000000 });
            assert.fail('Expected throw not received');
        }
        catch (error) {
            let currentOwner = await converter.owner.call();
            assert.equal(initialOwner, currentOwner);
            return utils.ensureException(error);
        }
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
        
        try {
            await converter.upgrade({ gas: 2000000 });
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

    it('verifies upgrade of a non active converter', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        let connectorTokenAddress = connectorToken.address;
        let connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
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


function loadDataFiles(rootPath, container) {
    Object.keys(container).forEach(item => {
        loadContractDataFile(rootPath, container, item, 'abi')
        loadContractDataFile(rootPath, container, item, 'bin')
    });
}

function loadContractDataFile(rootPath, container, key, type) {
    const filepath = path.resolve(rootPath, `${container[key].filename}.${type}`);
    const content = fs.readFileSync(filepath, 'utf8')

    container[key][type] = (type == 'abi') ? JSON.parse(content) : content;
}