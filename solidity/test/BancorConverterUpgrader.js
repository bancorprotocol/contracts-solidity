const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const BancorConverterFactory = artifacts.require('BancorConverterFactory.sol');
const BancorConverterUpgrader = artifacts.require('BancorConverterUpgrader.sol');
const utils = require('./helpers/Utils');

/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const gasPrice = 22000000000;

let token;
let contractFeaturesAddress;
let converterExtensionsAddress;
let converterFactory;
let converterUpgrader;
let smartToken1QuickBuyPath;
let converterAbi = [{"constant":false,"inputs":[{"name":"_connectorToken","type":"address"},{"name":"_weight","type":"uint32"},{"name":"_enableVirtualBalance","type":"bool"},{"name":"_virtualBalance","type":"uint256"}],"name":"updateConnector","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"connectors","outputs":[{"name":"virtualBalance","type":"uint256"},{"name":"weight","type":"uint32"},{"name":"isVirtualBalanceEnabled","type":"bool"},{"name":"isPurchaseEnabled","type":"bool"},{"name":"isSet","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_path","type":"address[]"},{"name":"_amount","type":"uint256"},{"name":"_minReturn","type":"uint256"},{"name":"_block","type":"uint256"},{"name":"_nonce","type":"uint256"},{"name":"_v","type":"uint8"},{"name":"_r","type":"bytes32"},{"name":"_s","type":"bytes32"}],"name":"quickConvertPrioritized","outputs":[{"name":"","type":"uint256"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"connectorTokens","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_fromToken","type":"address"},{"name":"_toToken","type":"address"},{"name":"_amount","type":"uint256"}],"name":"getReturn","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferTokenOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_disable","type":"bool"}],"name":"disableConversions","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_extensions","type":"address"}],"name":"setExtensions","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"extensions","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_fromToken","type":"address"},{"name":"_toToken","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_minReturn","type":"uint256"}],"name":"convertInternal","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_amount","type":"uint256"}],"name":"getConversionFeeAmount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"features","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptTokenOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"converterType","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"},{"name":"_weight","type":"uint32"},{"name":"_enableVirtualBalance","type":"bool"}],"name":"addConnector","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"withdrawFromToken","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newManager","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"manager","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_whitelist","type":"address"}],"name":"setConversionWhitelist","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"clearQuickBuyPath","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_connectorToken","type":"address"},{"name":"_disable","type":"bool"}],"name":"disableConnectorPurchases","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"version","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"conversionFee","outputs":[{"name":"","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"withdrawTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_fromToken","type":"address"},{"name":"_toToken","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_minReturn","type":"uint256"}],"name":"change","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"connectorTokenCount","outputs":[{"name":"","type":"uint16"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_connectorToken","type":"address"},{"name":"_sellAmount","type":"uint256"}],"name":"getSaleReturn","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_fromToken","type":"address"},{"name":"_toToken","type":"address"},{"name":"_amount","type":"uint256"},{"name":"_minReturn","type":"uint256"}],"name":"convert","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_disable","type":"bool"}],"name":"disableTokenTransfers","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getQuickBuyPathLength","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"maxConversionFee","outputs":[{"name":"","type":"uint32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_connectorToken","type":"address"},{"name":"_depositAmount","type":"uint256"}],"name":"getPurchaseReturn","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"convertibleTokenCount","outputs":[{"name":"","type":"uint16"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"conversionsEnabled","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"conversionWhitelist","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptManagement","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_path","type":"address[]"}],"name":"setQuickBuyPath","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_connectorToken","type":"address"}],"name":"getConnectorBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newManager","type":"address"}],"name":"transferManagement","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"quickBuyPath","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_conversionFee","type":"uint32"}],"name":"setConversionFee","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_path","type":"address[]"},{"name":"_amount","type":"uint256"},{"name":"_minReturn","type":"uint256"}],"name":"quickConvert","outputs":[{"name":"","type":"uint256"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"_tokenIndex","type":"uint16"}],"name":"convertibleToken","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"token","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"FEATURE_CONVERSION_WHITELIST","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_token","type":"address"},{"name":"_features","type":"address"},{"name":"_extensions","type":"address"},{"name":"_maxConversionFee","type":"uint32"},{"name":"_connectorToken","type":"address"},{"name":"_connectorWeight","type":"uint32"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_fromToken","type":"address"},{"indexed":true,"name":"_toToken","type":"address"},{"indexed":true,"name":"_trader","type":"address"},{"indexed":false,"name":"_amount","type":"uint256"},{"indexed":false,"name":"_return","type":"uint256"},{"indexed":false,"name":"_conversionFee","type":"int256"},{"indexed":false,"name":"_currentPriceN","type":"uint256"},{"indexed":false,"name":"_currentPriceD","type":"uint256"}],"name":"Conversion","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_prevFee","type":"uint32"},{"indexed":false,"name":"_newFee","type":"uint32"}],"name":"ConversionFeeUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_prevManager","type":"address"},{"indexed":true,"name":"_newManager","type":"address"}],"name":"ManagerUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_prevOwner","type":"address"},{"indexed":true,"name":"_newOwner","type":"address"}],"name":"OwnerUpdate","type":"event"}];
let SmartTokenAbi = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_disable","type":"bool"}],"name":"disableTransfers","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"version","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"standard","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"},{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"withdrawTokens","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"issue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_amount","type":"uint256"}],"name":"destroy","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"transfersEnabled","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_name","type":"string"},{"name":"_symbol","type":"string"},{"name":"_decimals","type":"uint8"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_token","type":"address"}],"name":"NewSmartToken","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_amount","type":"uint256"}],"name":"Issuance","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_amount","type":"uint256"}],"name":"Destruction","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_spender","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_prevOwner","type":"address"},{"indexed":true,"name":"_newOwner","type":"address"}],"name":"OwnerUpdate","type":"event"}];

async function initConverter(accounts, activate, maxConversionFee = 30000) {
    token = await SmartToken.new('Token1', 'TKN1', 18);
    let formula = await BancorFormula.new();
    let tokenAddress = token.address;

    let connectorToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
    let connectorTokenAddress = connectorToken.address;

    let connectorToken2 = await TestERC20Token.new('ERC Token 2', 'ERC2', 200000);
    let connectorTokenAddress2 = connectorToken2.address;

    let converter = await BancorConverter.new(tokenAddress, contractFeaturesAddress, converterExtensionsAddress, maxConversionFee, connectorTokenAddress, 500000);
    let converterAddress = converter.address;
    await converter.addConnector(connectorTokenAddress2, 150000, false);

    await token.issue(accounts[0], 20000);
    await connectorToken.transfer(converterAddress, 5000);
    await connectorToken2.transfer(converterAddress, 8000);
    await converter.setConversionFee(1000);

    smartToken1QuickBuyPath = [connectorTokenAddress, tokenAddress, tokenAddress];

    await converter.setQuickBuyPath(smartToken1QuickBuyPath);

    if (activate) {
        await token.transferOwnership(converterAddress);
        await converter.acceptTokenOwnership();
    }

    return converter;
}

contract('BancorConverterUpgrader', accounts => {
    before(async () => {
        let formula = await BancorFormula.new();
        let gasPriceLimit = await BancorGasPriceLimit.new(gasPrice);
        let quickConverter = await BancorQuickConverter.new();
        let contractFeatures = await ContractFeatures.new();
        let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address);
        converterFactory = await BancorConverterFactory.new();
        converterUpgrader = await BancorConverterUpgrader.new(converterFactory.address);
        contractFeaturesAddress = contractFeatures.address;
        converterExtensionsAddress = converterExtensions.address;
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

    it('verifies that the extentions after upgrade is the same', async () => {
        let converter = await initConverter(accounts, true);
        let currentExtensions = await converter.extensions.call();
        await converter.transferOwnership(converterUpgrader.address);
        let upgradeRes = await converterUpgrader.upgrade(converter.address, web3.fromUtf8("0.7"));
        let newConverterAddress = upgradeRes.logs[4].args._newConverter;
        let contract = web3.eth.contract(converterAbi);
        let newConverter = contract.at(newConverterAddress);
        let newExtensions = await newConverter.extensions.call();
        assert.equal(currentExtensions, newExtensions);
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
        let converter1 = await BancorConverter.new(token1.address, contractFeaturesAddress, converterExtensionsAddress, 30000, '0x0', 0);
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
        let connector1 = await converter.convertibleToken.call(1);
        let connector2 = await converter.convertibleToken.call(2);
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
        let connector1 = await converter.convertibleToken.call(1);
        let connector2 = await converter.convertibleToken.call(2);
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
});
