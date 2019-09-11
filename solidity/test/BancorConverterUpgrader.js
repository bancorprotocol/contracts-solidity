/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const fs = require('fs');
const path = require('path');
const ContractIds = artifacts.require('ContractIds');
const BancorConverter = artifacts.require('BancorConverter');
const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const ContractFeatures = artifacts.require('ContractFeatures');
const TestERC20Token = artifacts.require('TestERC20Token');
const Whitelist = artifacts.require('Whitelist');
const BancorConverterFactory = artifacts.require('BancorConverterFactory');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader');
const utils = require('./helpers/Utils');
const truffleContract = require('truffle-contract');

let token;
let contractRegistry;
let contractFeatures;
let converterUpgrader;

// the tests will be ran for each of these converter versions
const versions = ["0.12","0.11", "0.10", "0.9"]

const contractsPath = path.resolve(__dirname, './bin');

const converters = {
    "0.9": { filename: 'bancor_converter_v9' },
    "0.10": { filename: 'bancor_converter_v10' },
    "0.11": { filename: 'bancor_converter_v11' }
};

loadDataFiles(contractsPath, converters);

async function initConverter(accounts, activate, version = null, maxConversionFee = 30000) {
    token = await SmartToken.new('Token1', 'TKN1', 18);
    let tokenAddress = token.address;

    let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    let reserveTokenAddress = reserveToken.address;

    let reserveToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    let reserveTokenAddress2 = reserveToken2.address;

    let converter = await createConverter(tokenAddress, contractRegistry.address, maxConversionFee, reserveTokenAddress, 500000, version);
    let converterAddress = converter.address;
    await converter.addConnector(reserveTokenAddress2, 150000, false);

    await token.issue(accounts[0], 20000);
    await reserveToken.transfer(converterAddress, 5000);
    await reserveToken2.transfer(converterAddress, 8000);
    await converter.setConversionFee(1000);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

async function createConverter(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, ratio, version) {
    let converter;

    // if no version is passed, create newest converter
    if (!version || version == "0.12") {
        converter = await BancorConverter.new(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, ratio);
    }
    else {
        let abi = converters[version]['abi'];
        let byteCode = '0x' + converters[version]['bin'];
        let converterContract = truffleContract({ abi, unlinked_binary: byteCode });
        let block = await web3.eth.getBlock("latest");
        converterContract.setProvider(web3.currentProvider);
        converterContract.defaults({ from: web3.eth.accounts[0], gas: block.gasLimit });

        converter = await converterContract.new(tokenAddress, registryAddress, maxConversionFee, reserveTokenAddress, ratio);
    }

    return converter;
}

async function upgradeConverter(converter, version = null) {
    let newConverter;

    // for the latest version, we just call upgrade on the converter
    if (version == "0.11" || version == "0.12" || !version) {
        await converter.upgrade();
        newConverter = await getNewConverter();
    }
    else {
        // for previous versions we transfer ownership to the upgrader, then call upgradeOld on the upgrader,
        // then accept ownership of the new and old converter. The end results should be the same.
        await converter.transferOwnership(converterUpgrader.address);
        await converterUpgrader.upgradeOld(converter.address, web3.fromAscii(version));
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
        let contractIds = await ContractIds.new();

        contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

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

    it('verifies upgrade of converter without reserves', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let converter1 = await BancorConverter.new(token1.address, contractRegistry.address, 30000, '0x0', 0);
        await token1.issue(accounts[0], 20000);
        await token1.transferOwnership(converter1.address);
        await converter1.acceptTokenOwnership();
        let currentMaxConversionFee = await converter1.maxConversionFee.call();
        await converter1.upgrade();
        let newConverter = await getNewConverter();
        let newConverterReserveTokenCount = await newConverter.reserveTokenCount.call();
        assert.equal(newConverterReserveTokenCount.toFixed(), 0);
        let newTokenOwner = await token1.owner.call();
        assert.equal(newTokenOwner, newConverter.address);
        let newMaxConversionFee = await newConverter.maxConversionFee.call();
        assert.equal(currentMaxConversionFee.toFixed(), newMaxConversionFee.toFixed());
    });

    it('verifies that the reserves count after an upgrade is the same', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let currentConverterReserveTokenCount = await converter.reserveTokenCount.call();
            let newConverter = await upgradeConverter(converter, versions[i]);
            let newConverterReserveTokenCount = await newConverter.reserveTokenCount.call();
            assert.equal(currentConverterReserveTokenCount.toFixed(), newConverterReserveTokenCount.toFixed());            
        }
    });

    it('verifies that the reserve balances after upgrade is equal', async () => {
        for (let i = 0; i < versions.length; i++) {
            let converter = await initConverter(accounts, true, versions[i]);
            let reserve1 = await converter.reserveTokens.call(0);
            let reserve2 = await converter.reserveTokens.call(1);
            let initialReserveBalance1 = await converter.getReserveBalance.call(reserve1);
            let initialReserveBalance2 = await converter.getReserveBalance.call(reserve2);
            let newConverter = await upgradeConverter(converter, versions[i]);
            let currentReserveBalance1 = await newConverter.getReserveBalance.call(reserve1);
            let currentReserveBalance2 = await newConverter.getReserveBalance.call(reserve2);
            assert.equal(initialReserveBalance1.toFixed(), currentReserveBalance1.toFixed());
            assert.equal(initialReserveBalance2.toFixed(), currentReserveBalance2.toFixed());            
        }
    });

    it('verifies that balances did not change if the process stopped due to gas limitation', async () => {
        let converter = await initConverter(accounts, true);
        let reserve1 = await converter.reserveTokens.call(0);
        let reserve2 = await converter.reserveTokens.call(1);
        let initialReserveBalance1 = await converter.getReserveBalance.call(reserve1);
        let initialReserveBalance2 = await converter.getReserveBalance.call(reserve2);
        
        await utils.catchRevert(converter.upgrade({ gas: 2000000 }));
        let currentReserveBalance1 = await converter.getReserveBalance.call(reserve1);
        let currentReserveBalance2 = await converter.getReserveBalance.call(reserve2);
        assert.equal(initialReserveBalance1.toFixed(), currentReserveBalance1.toFixed());
        assert.equal(initialReserveBalance2.toFixed(), currentReserveBalance2.toFixed());
    });

    it('verifies upgrade of a non active converter', async () => {
        let token1 = await SmartToken.new('Token1', 'TKN1', 18);
        let reserveToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        let reserveTokenAddress = reserveToken.address;
        let reserveToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
        let reserveTokenAddress2 = reserveToken2.address;
        let converter1 = await BancorConverter.new(token1.address, contractRegistry.address, 30000, reserveTokenAddress, 500000);
        await converter1.addConnector(reserveTokenAddress2, 500000, false);
        await reserveToken.transfer(converter1.address, 5000);
        await reserveToken2.transfer(converter1.address, 8000);
        await token1.issue(accounts[0], 20000);
        let currentMaxConversionFee = await converter1.maxConversionFee.call();
        await converter1.upgrade();
        let newConverter = await getNewConverter();
        let newConverterReserveTokenCount = await newConverter.reserveTokenCount.call();
        assert.equal(newConverterReserveTokenCount.toFixed(), 2);
        let newMaxConversionFee = await newConverter.maxConversionFee.call();
        assert.equal(currentMaxConversionFee.toFixed(), newMaxConversionFee.toFixed());
        let currentReserveBalance1 = await newConverter.getReserveBalance.call(reserveToken.address);
        let currentReserveBalance2 = await newConverter.getReserveBalance.call(reserveToken2.address);
        assert.equal(currentReserveBalance1.toFixed(), 5000);
        assert.equal(currentReserveBalance2.toFixed(), 8000);
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