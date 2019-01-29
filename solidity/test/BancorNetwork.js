/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const Whitelist = artifacts.require('Whitelist.sol');
const NonStandardTokenRegistry = artifacts.require('NonStandardTokenRegistry.sol');
const BancorNetwork = artifacts.require('BancorNetwork.sol');
const ContractIds = artifacts.require('ContractIds.sol');
const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const NonStandardSmartToken = artifacts.require('NonStandardSmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const ContractRegistry = artifacts.require('ContractRegistry.sol');
const ContractFeatures = artifacts.require('ContractFeatures.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const TestNonStandardERC20Token = artifacts.require('TestNonStandardERC20Token.sol');
const utils = require('./helpers/Utils');
const ethUtil = require('ethereumjs-util');
const web3Utils = require('web3-utils');

let etherToken;
let smartToken1;
let smartToken2;
let smartToken3;
let smartToken4;
let erc20Token;
let contractRegistry;
let contractIds;
let converter1;
let converter2;
let converter3;
let converter4;
let bancorNetwork;
let smartToken1BuyPath;
let smartToken2BuyPath;
let smartToken1SellPath;
let smartToken2SellPath;
let defaultGasPriceLimit = BancorGasPriceLimit.class_defaults.gasPrice;

function sign(msgToSign, signerAddress) {
    try {
        const sig = web3.eth.sign(signerAddress, ethUtil.bufferToHex(msgToSign));
        const { v, r, s } = ethUtil.fromRpcSig(sig);
        return { v: v, r: ethUtil.bufferToHex(r), s: ethUtil.bufferToHex(s) };
    }
    catch (err) {
        return err;
    }
}

/*
Token network structure:

         SmartToken2
         /         \
    SmartToken1   SmartToken3
          \          \
           \        SmartToken4
            \        /      \
            EtherToken     ERC20Token

*/

contract('BancorNetwork', accounts => {
    const trustedAddress = accounts[3];
    const untrustedAddress = accounts[1];

    before(async () => {
        contractRegistry = await ContractRegistry.new();
        contractIds = await ContractIds.new();

        let contractFeatures = await ContractFeatures.new();
        let contractFeaturesId = await contractIds.CONTRACT_FEATURES.call();
        await contractRegistry.registerAddress(contractFeaturesId, contractFeatures.address);

        let gasPriceLimit = await BancorGasPriceLimit.new(defaultGasPriceLimit);
        let gasPriceLimitId = await contractIds.BANCOR_GAS_PRICE_LIMIT.call();
        await contractRegistry.registerAddress(gasPriceLimitId, gasPriceLimit.address);

        let formula = await BancorFormula.new();
        let formulaId = await contractIds.BANCOR_FORMULA.call();
        await contractRegistry.registerAddress(formulaId, formula.address);

        let nonStandardTokenRegistry = await NonStandardTokenRegistry.new();
        let nonStandardTokenRegistryId = await contractIds.NON_STANDARD_TOKEN_REGISTRY.call();
        await contractRegistry.registerAddress(nonStandardTokenRegistryId, nonStandardTokenRegistry.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        let bancorNetworkId = await contractIds.BANCOR_NETWORK.call();
        await contractRegistry.registerAddress(bancorNetworkId, bancorNetwork.address);
        await bancorNetwork.setSignerAddress(accounts[3]);

        etherToken = await EtherToken.new();
        await etherToken.deposit({ value: 10000000 });

        await bancorNetwork.registerEtherToken(etherToken.address, true);

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        await smartToken1.issue(accounts[0], 1000000);

        smartToken2 = await NonStandardSmartToken.new('Token2', 'TKN2', 2);
        await smartToken2.issue(accounts[0], 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        await smartToken3.issue(accounts[0], 3000000);

        smartToken4 = await SmartToken.new('Token4', 'TKN4', 2);
        await smartToken4.issue(accounts[0], 2500000);

        erc20Token = await TestNonStandardERC20Token.new('ERC20Token', 'ERC5', 1000000);

        await nonStandardTokenRegistry.setAddress(smartToken2.address, true);
        await nonStandardTokenRegistry.setAddress(erc20Token.address, true);

        converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, etherToken.address, 250000);

        converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken1.address, 300000);
        await converter2.addConnector(smartToken3.address, 150000, false);

        converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, smartToken4.address, 350000);

        converter4 = await BancorConverter.new(smartToken4.address, contractRegistry.address, 0, etherToken.address, 150000);
        await converter4.addConnector(erc20Token.address, 220000, false);

        await etherToken.transfer(converter1.address, 50000);
        await smartToken1.transfer(converter2.address, 40000);
        await smartToken3.transfer(converter2.address, 25000);
        await smartToken4.transfer(converter3.address, 30000);
        await etherToken.transfer(converter4.address, 20000);
        await erc20Token.transfer(converter4.address, 35000);

        await smartToken1.transferOwnership(converter1.address);
        await converter1.acceptTokenOwnership();

        await smartToken2.transferOwnership(converter2.address);
        await converter2.acceptTokenOwnership();

        await smartToken3.transferOwnership(converter3.address);
        await converter3.acceptTokenOwnership();

        await smartToken4.transferOwnership(converter4.address);
        await converter4.acceptTokenOwnership();

        smartToken1BuyPath = [etherToken.address, smartToken1.address, smartToken1.address];
        smartToken2BuyPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken2.address, smartToken2.address];

        smartToken1SellPath = [smartToken1.address, smartToken1.address, etherToken.address];
        smartToken2SellPath = [smartToken2.address, smartToken2.address, smartToken1.address, smartToken1.address, etherToken.address];
    });

    it('should be able to convert from a non compliant erc-20 to another token', async () => {
        await erc20Token.approve(converter4.address, 1000);
        let path = [erc20Token.address, smartToken4.address, smartToken4.address];
        let prevBalance = await smartToken4.balanceOf.call(accounts[0]);
        await converter4.quickConvert(path, 1000, 1);
        let postBalance = await smartToken4.balanceOf.call(accounts[0]);

        assert.isAbove(postBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should be able to convert from a smart token to a non compliant erc-20', async () => {
        let path = [smartToken4.address, smartToken4.address, erc20Token.address];
        let prevBalance = await erc20Token.balanceOf.call(accounts[0]);
        await converter4.quickConvert(path, 1000, 1);
        let postBalance = await erc20Token.balanceOf.call(accounts[0]);

        assert.isAbove(postBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy with a single converter results in increased balance for the buyer', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        let res = await converter1.quickConvert(smartToken1BuyPath, 100, 1, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
        // console.log(`gas used for converting eth -> 1: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that quick buy with multiple converters results in increased balance for the buyer', async () => {
        let prevBalance = await smartToken2.balanceOf.call(accounts[1]);

        let res = await converter2.quickConvert(smartToken2BuyPath, 100, 1, { from: accounts[1], value: 100 });
        let newBalance = await smartToken2.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
        // console.log(`gas used for converting eth -> 1 -> 2: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that sending ether to the converter fails', async () => {
        try {
            await converter2.send(100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that quick buy with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
        let prevBalance = await smartToken2.balanceOf.call(accounts[0]);
        
        let token1Return = (await converter1.getPurchaseReturn(etherToken.address, 100000))[0];
        let token2Return = (await converter2.getPurchaseReturn(smartToken1.address, token1Return))[0];

        await converter2.quickConvert(smartToken2BuyPath, 100000, token2Return, { value: 100000 });
        let newBalance = await smartToken2.balanceOf.call(accounts[0]);

        assert.equal(token2Return.toNumber(), newBalance.toNumber() - prevBalance.toNumber(), "new balance isn't equal to the expected purchase return");
    });

    it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
        try {
            await converter2.quickConvert(smartToken2BuyPath, 100, 1000000, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to quick buy and passing an amount higher than the ETH amount sent with the request', async () => {
        try {
            await converter2.quickConvert(smartToken2BuyPath, 100001, 1, { from: accounts[1], value: 100000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the caller balances after selling directly for ether with a single converter', async () => {
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let res = await converter1.quickConvert(smartToken1SellPath, 10000, 1);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('verifies the caller balances after selling directly for ether with multiple converters', async () => {
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let res = await converter2.quickConvert(smartToken2SellPath, 10000, 1);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('should throw when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
        try {
            await converter2.quickConvert(smartToken2SellPath, 10000, 20000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the caller balances after converting from one token to another with multiple converters', async () => {

        let path = [smartToken1.address,
                    smartToken2.address, smartToken2.address,
                    smartToken2.address, smartToken3.address,
                    smartToken3.address, smartToken4.address];

        let prevToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let prevToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        await converter1.quickConvert(path, 1000, 1);
        let newToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let newToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        assert(newToken4Balance.greaterThan(prevToken4Balance), "bought token balance isn't higher than previous balance");
        assert(newToken1Balance.lessThan(prevToken1Balance), "sold token balance isn't lower than previous balance");
    });

    it('verifies valid ether token registration', async () => {
        let etherToken1 = await EtherToken.new();
        await etherToken1.deposit({ value: 10000000 });
        let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);
        let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        assert.isTrue(validEtherToken, 'registered etherToken address verification');
    });

    it('should throw when attempting register ether token with invalid address', async () => {
        try {
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken('0x0', true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when non owner attempting register ether token', async () => {
        try {
            let etherToken1 = await EtherToken.new();
            await etherToken1.deposit({ value: 10000000 });
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken1.address, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies valid ether token unregistration', async () => {
        let etherToken1 = await EtherToken.new();
        await etherToken1.deposit({ value: 10000000 });
        let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);
        let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        assert.isTrue(validEtherToken, 'registered etherToken address verification');
        await bancorNetwork1.registerEtherToken(etherToken1.address, false);
        let validEtherToken2 = await bancorNetwork1.etherTokens.call(etherToken1.address);
        assert.isNotTrue(validEtherToken2, 'unregistered etherToken address verification');
    });

    it('should throw when non owner attempting to unregister ether token', async () => {
        try {
            let etherToken1 = await EtherToken.new();
            await etherToken1.deposit({ value: 10000000 });
            let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
            await bancorNetwork1.registerEtherToken(etherToken1.address, true);
            let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
            assert.isTrue(validEtherToken, 'registered etherToken address verification');
            await bancorNetwork1.registerEtherToken(etherToken1.address, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that convertFor transfers the converted amount correctly', async () => {
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies converting with a path that starts with a smart token and ends with another smart token', async () => {
        await smartToken4.approve(bancorNetwork.address, 10000);
        let path = [smartToken4.address, smartToken3.address, smartToken3.address, smartToken2.address, smartToken2.address];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await bancorNetwork.claimAndConvertFor(path, 10000, 1, accounts[1]);
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that convertFor returns the valid converted amount', async () => {
        let amount = await bancorNetwork.convertFor.call(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 });
        assert.isAbove(amount.toNumber(), 1, 'amount converted');
    });

    it('verifies that convert returns the valid converted amount', async () => {
        let amount = await bancorNetwork.convert.call(smartToken1BuyPath, 10000, 1, { from: accounts[1], value: 10000 });
        assert.isAbove(amount.toNumber(), 1, 'amount converted');
    });

    it('should throw when trying convert ether token without sending ether', async () => {
        try {
            await bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when ether is different than the amount sent ', async () => {
        try {
            await bancorNetwork.convertFor.call(smartToken1BuyPath, 20000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when trying convert with invalid path', async () => {
        try {
            let invalidPath = [etherToken.address, smartToken1.address];
            await bancorNetwork.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when trying convert with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 100; ++i)
            longBuyPath.push(etherToken.address);

        try {
            await bancorNetwork.convertFor(longBuyPath, 10000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that convertFor transfers the converted amount correctly', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.claimAndConvertFor(smartToken1BuyPath, 10000, 1, accounts[1]);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when trying claim and convert without approval', async () => {
        try {
            await bancorNetwork.claimAndConvertFor(smartToken1BuyPath, 10000, 1, accounts[1]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that convertFor transfers the converted amount correctly with claimAndConvert', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[0]);
        await bancorNetwork.claimAndConvert(smartToken1BuyPath, 10000, 1);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[0]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when trying claim and convert without approval with claimAndConvert', async () => {
        try {
            await bancorNetwork.claimAndConvert(smartToken1BuyPath, 10000, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that convertFor is allowed for a whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        await converter1.setConversionWhitelist(whitelist.address);

        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('should throw when attempting to convertFor a non whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await converter1.setConversionWhitelist(whitelist.address);

        try {
            await bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            await converter1.setConversionWhitelist(utils.zeroAddress);
            return utils.ensureException(error);
        }
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken1BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token through multiple converters', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken2BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor(smartToken2BuyPath, 10000, 1, accounts[1], { value: 10000 });
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for cross connector conversion', async () => {
        await converter2.quickConvert([etherToken.address, smartToken1.address, smartToken1.address], 1000, 1, { from: accounts[1], value: 1000 });
        await smartToken1.approve(converter2.address, 100, { from: accounts[1] });
        let path = [smartToken1.address, smartToken2.address, smartToken3.address];
        let returnByPath = (await bancorNetwork.getReturnByPath.call(path, 100))[0];
        let balanceBeforeTransfer = await smartToken3.balanceOf.call(accounts[1]);
        await converter2.quickConvert(path, 100, 1, { from: accounts[1] });
        let balanceAfterTransfer = await smartToken3.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for selling the smart token', async () => {
        await converter1.quickConvert(smartToken1BuyPath, 100, 1, { from: accounts[1], value: 100 });
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken1SellPath, 100))[0];
        let balanceBeforeTransfer = web3.eth.getBalance(accounts[1]);
        let res = await converter1.quickConvert(smartToken1SellPath, 100, 1, { from: accounts[1] });
        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        let balanceAfterTransfer = web3.eth.getBalance(accounts[1]);
        assert.equal(returnByPath.toNumber(), balanceAfterTransfer.minus(balanceBeforeTransfer).plus(transactionCost).toNumber());
    });

    it('verifies that getReturnByPath returns the correct amount for selling the smart token through multiple converters', async () => {
        await converter2.quickConvert(smartToken2BuyPath, 100, 1, { from: accounts[1], value: 100 });
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken2SellPath, 100))[0];
        let balanceBeforeTransfer = web3.eth.getBalance(accounts[1]);
        let res = await converter2.quickConvert(smartToken2SellPath, 100, 1, { from: accounts[1] });
        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        let balanceAfterTransfer = web3.eth.getBalance(accounts[1]);
        assert.equal(returnByPath.toNumber(), balanceAfterTransfer.minus(balanceBeforeTransfer).plus(transactionCost).toNumber());
        // console.log(`gas used for converting 2 -> 1 -> eth: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that getReturnByPath returns the correct amount for selling the smart token with a long conversion path', async () => {
        await converter4.quickConvert([etherToken.address, smartToken1.address, smartToken1.address, smartToken2.address, smartToken3.address], 1000, 1, { from: accounts[1], value: 1000 });
        let path = [smartToken3.address, smartToken2.address, smartToken2.address, smartToken2.address, smartToken1.address, smartToken1.address, etherToken.address];
        let returnByPath = (await bancorNetwork.getReturnByPath.call(path, 100))[0];
        let balanceBeforeTransfer = web3.eth.getBalance(accounts[1]);
        let res = await converter3.quickConvert(path, 100, 1, { from: accounts[1] });
        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        let balanceAfterTransfer = web3.eth.getBalance(accounts[1]);
        assert.equal(returnByPath.toNumber(), balanceAfterTransfer.minus(balanceBeforeTransfer).plus(transactionCost).toNumber());
        // console.log(`gas used for converting 3 -> 2 -> 1 -> eth: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a connector to the smart token', async () => {
        let getReturn = (await converter2.getReturn.call(smartToken1.address, smartToken2.address, 100))[0];
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken1.address, smartToken2.address, smartToken2.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a connector', async () => {
        let getReturn = (await converter2.getReturn.call(smartToken2.address, smartToken1.address, 100))[0];
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken2.address, smartToken2.address, smartToken1.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    it('should throw when attempting to get the return by path with invalid path', async () => {
        try {
            let invalidPath = [etherToken.address, smartToken1.address];
            await bancorNetwork.getReturnByPath.call(invalidPath, 1000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to get the return by path with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 103; ++i)
            longBuyPath.push(etherToken.address);

        try {
            await bancorNetwork.getReturnByPath.call(longBuyPath, 1000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies prioritized quick buy with trusted signature', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        let block = await web3.eth.blockNumber;
        let maximumBlock = block + 100;
        let gasPrice = defaultGasPriceLimit;

        let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
        let result = sign(soliditySha3, trustedAddress);

        await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, maximumBlock, result.v, result.r, result.s, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when attempts to call quick convert prioritized with untrusted signature', async () => {
        try {
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = defaultGasPriceLimit;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
            let result = sign(soliditySha3, untrustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, maximumBlock, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick convert prioritized with wrong path', async () => {
        try {
            let wrongPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken1.address, smartToken1.address];
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = defaultGasPriceLimit;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': wrongPath});
            let result = sign(soliditySha3, trustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, maximumBlock, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick convert prioritized with wrong amount', async () => {
        try {
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = defaultGasPriceLimit;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
            let result = sign(soliditySha3, trustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 200, 1, maximumBlock, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick convert prioritized with higher block number than what appears in the signing data', async () => {
        try {
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let wrongBlockNumber = maximumBlock + 100;
            let gasPrice = defaultGasPriceLimit;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
            let result = sign(soliditySha3, trustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, wrongBlockNumber, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick convert prioritized with lower block number than what appears in the signing data', async () => {
        try {
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let wrongBlockNumber = maximumBlock - 1;
            let gasPrice = defaultGasPriceLimit;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
            let result = sign(soliditySha3, trustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, wrongBlockNumber, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick convert prioritized with higher gas price than what appears in the signing data', async () => {
        try {
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = defaultGasPriceLimit - 1;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
            let result = sign(soliditySha3, trustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, maximumBlock, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick convert prioritized with lower gas price than what appears in the signing data', async () => {
        try {
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = defaultGasPriceLimit + 1;

            let soliditySha3 = web3Utils.soliditySha3(maximumBlock, gasPrice, accounts[1], converter1.address, 100, {'type': 'address', 'value': smartToken1BuyPath});
            let result = sign(soliditySha3, trustedAddress);

            await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, maximumBlock, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
