/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const Whitelist = artifacts.require('Whitelist');
const BancorNetwork = artifacts.require('BancorNetwork');
const BancorConverter = artifacts.require('BancorConverter');
const SmartToken = artifacts.require('SmartToken');
const NonStandardSmartToken = artifacts.require('NonStandardSmartToken');
const BancorFormula = artifacts.require('BancorFormula');
const ContractRegistry = artifacts.require('ContractRegistry');
const ContractFeatures = artifacts.require('ContractFeatures');
const EtherToken = artifacts.require('EtherToken');
const TestNonStandardERC20Token = artifacts.require('TestNonStandardERC20Token');

let etherToken;
let smartToken1;
let smartToken2;
let smartToken3;
let smartToken4;
let erc20Token;
let contractRegistry;
let converter1;
let converter2;
let converter3;
let converter4;
let bancorNetwork;
let smartToken1BuyPath;
let smartToken2BuyPath;
let smartToken1SellPath;
let smartToken2SellPath;

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

        let contractFeatures = await ContractFeatures.new();
        await contractRegistry.registerAddress(ContractRegistryClient.CONTRACT_FEATURES, contractFeatures.address);

        let bancorFormula = await BancorFormula.new();
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_FORMULA, bancorFormula.address);

        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_NETWORK, bancorNetwork.address);

        etherToken = await EtherToken.new('Token0', 'TKN0');
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

        await contractRegistry.registerAddress(ContractRegistryClient.BNT_TOKEN, smartToken1.address);

        erc20Token = await TestNonStandardERC20Token.new('ERC20Token', 'ERC5', 1000000);

        converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, etherToken.address, 250000);

        converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken1.address, 300000);
        await converter2.addReserve(smartToken3.address, 150000);

        converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, smartToken4.address, 350000);

        converter4 = await BancorConverter.new(smartToken4.address, contractRegistry.address, 0, etherToken.address, 150000);
        await converter4.addReserve(erc20Token.address, 220000);

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

    it('verifies that sending ether to the converter fails', async () => {
        await utils.catchRevert(converter2.send(100));
    });

    it('should be able to quickConvert from a non compliant erc-20 to another token', async () => {
        await erc20Token.approve(converter4.address, 1000);
        let path = [erc20Token.address, smartToken4.address, smartToken4.address];
        let prevBalance = await smartToken4.balanceOf.call(accounts[0]);
        await converter4.quickConvert(path, 1000, 1);
        let postBalance = await smartToken4.balanceOf.call(accounts[0]);

        assert.isAbove(postBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should be able to quickConvert from a smart token to a non compliant erc-20', async () => {
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

    it('verifies that quick buy with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
        let prevBalance = await smartToken2.balanceOf.call(accounts[0]);
        
        let token1Return = (await converter1.getPurchaseReturn(etherToken.address, 100000))[0];
        let token2Return = (await converter2.getPurchaseReturn(smartToken1.address, token1Return))[0];

        await converter2.quickConvert(smartToken2BuyPath, 100000, token2Return, { value: 100000 });
        let newBalance = await smartToken2.balanceOf.call(accounts[0]);

        assert.equal(token2Return.toNumber(), newBalance.toNumber() - prevBalance.toNumber(), "new balance isn't equal to the expected purchase return");
    });

    it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
        await utils.catchRevert(converter2.quickConvert(smartToken2BuyPath, 100, 1000000, { from: accounts[1], value: 100 }));
    });

    it('should throw when attempting to quick buy and passing an amount higher than the ETH amount sent with the request', async () => {
        await utils.catchRevert(converter2.quickConvert(smartToken2BuyPath, 100001, 1, { from: accounts[1], value: 100000 }));
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
        await utils.catchRevert(converter2.quickConvert(smartToken2SellPath, 10000, 20000));
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
        let etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });
        let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);
        let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        assert.isTrue(validEtherToken, 'registered etherToken address verification');
    });

    it('should throw when attempting register ether token with invalid address', async () => {
        let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await utils.catchRevert(bancorNetwork1.registerEtherToken('0x0', true));
    });

    it('should throw when non owner attempting register ether token', async () => {
        let etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });
        let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await utils.catchRevert(bancorNetwork1.registerEtherToken(etherToken1.address, true, { from: accounts[1] }));
    });

    it('verifies valid ether token unregistration', async () => {
        let etherToken1 = await EtherToken.new('Token0', 'TKN0');
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
        let etherToken1 = await EtherToken.new('Token0', 'TKN0');
        await etherToken1.deposit({ value: 10000000 });
        let bancorNetwork1 = await BancorNetwork.new(contractRegistry.address);
        await bancorNetwork1.registerEtherToken(etherToken1.address, true);
        let validEtherToken = await bancorNetwork1.etherTokens.call(etherToken1.address);
        assert.isTrue(validEtherToken, 'registered etherToken address verification');
        await utils.catchRevert(bancorNetwork1.registerEtherToken(etherToken1.address, false, { from: accounts[1] }));
    });

    it('verifies that convertFor transfers the converted amount correctly', async () => {
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that convert transfers the converted amount correctly', async () => {
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convert(smartToken1BuyPath, 10000, 1, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies claimAndConvertFor with a path that starts with a smart token and ends with another smart token', async () => {
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

    it('should throw when calling convertFor with ether token but without sending ether', async () => {
        await utils.catchRevert(bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1]));
    });

    it('should throw when calling convertFor with ether amount different than the amount sent', async () => {
        await utils.catchRevert(bancorNetwork.convertFor.call(smartToken1BuyPath, 20000, 1, accounts[1], { value: 10000 }));
    });

    it('should throw when calling convertFor with invalid path', async () => {
        let invalidPath = [etherToken.address, smartToken1.address];
        await utils.catchRevert(bancorNetwork.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 }));
    });

    it('should throw when calling convertFor with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 100; ++i)
            longBuyPath.push(etherToken.address);

        await utils.catchRevert(bancorNetwork.convertFor(longBuyPath, 10000, 1, accounts[1], { value: 10000 }));
    });

    it('should throw when calling convert with ether token but without sending ether', async () => {
        await utils.catchRevert(bancorNetwork.convert(smartToken1BuyPath, 10000, 1, { from: accounts[1] }));
    });

    it('should throw when calling convert with ether amount different than the amount sent', async () => {
        await utils.catchRevert(bancorNetwork.convert.call(smartToken1BuyPath, 20000, 1, { from: accounts[1], value: 10000 }));
    });

    it('should throw when calling convert with invalid path', async () => {
        let invalidPath = [etherToken.address, smartToken1.address];
        await utils.catchRevert(bancorNetwork.convert(invalidPath, 10000, 1, { from: accounts[1], value: 10000 }));
    });

    it('should throw when calling convert with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 100; ++i)
            longBuyPath.push(etherToken.address);

        await utils.catchRevert(bancorNetwork.convert(longBuyPath, 10000, 1, { from: accounts[1], value: 10000 }));
    });

    it('verifies that claimAndConvertFor transfers the converted amount correctly', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.claimAndConvertFor(smartToken1BuyPath, 10000, 1, accounts[1]);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when calling claimAndConvertFor without approval', async () => {
        await utils.catchRevert(bancorNetwork.claimAndConvertFor(smartToken1BuyPath, 10000, 1, accounts[1]));
    });

    it('verifies that claimAndConvert transfers the converted amount correctly', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[0]);
        await bancorNetwork.claimAndConvert(smartToken1BuyPath, 10000, 1);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[0]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when calling claimAndConvert without approval', async () => {
        await utils.catchRevert(bancorNetwork.claimAndConvert(smartToken1BuyPath, 10000, 1));
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

    it('should throw when calling convertFor with a non whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await converter1.setConversionWhitelist(whitelist.address);

        await utils.catchRevert(bancorNetwork.convertFor(smartToken1BuyPath, 10000, 1, accounts[1], { value: 10000 }));
        await converter1.setConversionWhitelist(utils.zeroAddress);
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

    it('verifies that convert is allowed for a whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        await converter1.setConversionWhitelist(whitelist.address);

        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convert(smartToken1BuyPath, 10000, 1, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('should throw when calling convert with a non whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await converter1.setConversionWhitelist(whitelist.address);

        await utils.catchRevert(bancorNetwork.convert(smartToken1BuyPath, 10000, 1, { from: accounts[1], value: 10000 }));
        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken1BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convert(smartToken1BuyPath, 10000, 1, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token through multiple converters', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken2BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await bancorNetwork.convert(smartToken2BuyPath, 10000, 1, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for cross reserve conversion', async () => {
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

    it('verifies that getReturnByPath returns the same amount as getReturn when converting a reserve to the smart token', async () => {
        let getReturn = (await converter2.getReturn.call(smartToken1.address, smartToken2.address, 100))[0];
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken1.address, smartToken2.address, smartToken2.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    it('verifies that getReturnByPath returns the same amount as getReturn when converting from a token to a reserve', async () => {
        let getReturn = (await converter2.getReturn.call(smartToken2.address, smartToken1.address, 100))[0];
        let returnByPath = (await bancorNetwork.getReturnByPath.call([smartToken2.address, smartToken2.address, smartToken1.address], 100))[0];
        assert.equal(getReturn.toNumber(), returnByPath.toNumber());
    });

    it('should throw when attempting to call getReturnByPath on a path with fewer than 3 elements', async () => {
        let invalidPath = [etherToken.address, smartToken1.address];
        await utils.catchRevert(bancorNetwork.getReturnByPath.call(invalidPath, 1000));
    });

    it('should throw when attempting to call getReturnByPath on a path with an odd number of elements', async () => {
        let invalidPath = [etherToken.address, smartToken1.address, smartToken2.address, smartToken3.address];
        await utils.catchRevert(bancorNetwork.getReturnByPath.call(invalidPath, 1000));
    });

    it('should throw when attempting to get the return by path with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 103; ++i)
            longBuyPath.push(etherToken.address);

        await utils.catchRevert(bancorNetwork.getReturnByPath.call(longBuyPath, 1000));
    });

    it('verifies quickConvertPrioritized', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await converter1.quickConvertPrioritized(smartToken1BuyPath, 100, 1, 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when calling quickConvertPrioritized with wrong path', async () => {
        let wrongPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken1.address, smartToken1.address];

        await utils.catchRevert(converter1.quickConvertPrioritized(wrongPath, 100, 1, 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 }));
    });

    it('should throw when calling quickConvertPrioritized with wrong amount', async () => {
        await utils.catchRevert(converter1.quickConvertPrioritized(smartToken1BuyPath, 200, 1, 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 }));
    });

    it('verifies convertForPrioritized2', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await bancorNetwork.convertForPrioritized2(smartToken1BuyPath, 100, 1, accounts[1], 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when calling convertForPrioritized2 with wrong path', async () => {
        let wrongPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken1.address, smartToken1.address];

        await utils.catchRevert(bancorNetwork.convertForPrioritized2(wrongPath, 100, 1, accounts[1], 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 }));
    });

    it('should throw when calling convertForPrioritized2 with wrong amount', async () => {
        await utils.catchRevert(bancorNetwork.convertForPrioritized2(smartToken1BuyPath, 200, 1, accounts[1], 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 }));
    });

    it('verifies convertForPrioritized3', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await bancorNetwork.convertForPrioritized3(smartToken1BuyPath, 100, 1, accounts[1], 0, 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when calling convertForPrioritized3 with wrong path', async () => {
        let wrongPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken1.address, smartToken1.address];

        await utils.catchRevert(bancorNetwork.convertForPrioritized3(wrongPath, 100, 1, accounts[1], 100, 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 }));
    });

    it('should throw when calling convertForPrioritized3 with wrong amount', async () => {
        await utils.catchRevert(bancorNetwork.convertForPrioritized3(smartToken1BuyPath, 200, 1, accounts[1], 200, 0, 0, utils.zeroBytes32, utils.zeroBytes32, { from: accounts[1], value: 100 }));
    });

    it('verifies that convertFor2 transfers the converted amount correctly', async () => {
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that convert2 transfers the converted amount correctly', async () => {
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies claimAndConvertFor2 with a path that starts with a smart token and ends with another smart token', async () => {
        await smartToken4.approve(bancorNetwork.address, 10000);
        let path = [smartToken4.address, smartToken3.address, smartToken3.address, smartToken2.address, smartToken2.address];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await bancorNetwork.claimAndConvertFor2(path, 10000, 1, accounts[1], utils.zeroAddress, 0);
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that convertFor2 returns the valid converted amount', async () => {
        let amount = await bancorNetwork.convertFor2.call(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
        assert.isAbove(amount.toNumber(), 1, 'amount converted');
    });

    it('verifies that convert2 returns the valid converted amount', async () => {
        let amount = await bancorNetwork.convert2.call(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
        assert.isAbove(amount.toNumber(), 1, 'amount converted');
    });

    it('should throw when calling convertFor2 with ether token but without sending ether', async () => {
        await utils.catchRevert(bancorNetwork.convertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0));
    });

    it('should throw when calling convertFor2 with ether amount different than the amount sent', async () => {
        await utils.catchRevert(bancorNetwork.convertFor2.call(smartToken1BuyPath, 20000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
    });

    it('should throw when calling convertFor2 with invalid path', async () => {
        let invalidPath = [etherToken.address, smartToken1.address];
        await utils.catchRevert(bancorNetwork.convertFor2(invalidPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
    });

    it('should throw when calling convertFor2 with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 100; ++i)
            longBuyPath.push(etherToken.address);

        await utils.catchRevert(bancorNetwork.convertFor2(longBuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
    });

    it('should throw when calling convert2 with ether token but without sending ether', async () => {
        await utils.catchRevert(bancorNetwork.convert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1] }));
    });

    it('should throw when calling convert2 with ether amount different than the amount sent', async () => {
        await utils.catchRevert(bancorNetwork.convert2.call(smartToken1BuyPath, 20000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
    });

    it('should throw when calling convert2 with invalid path', async () => {
        let invalidPath = [etherToken.address, smartToken1.address];
        await utils.catchRevert(bancorNetwork.convert2(invalidPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
    });

    it('should throw when calling convert2 with invalid long path', async () => {
        let longBuyPath = [];
        for (let i = 0; i < 100; ++i)
            longBuyPath.push(etherToken.address);

        await utils.catchRevert(bancorNetwork.convert2(longBuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
    });

    it('verifies that claimAndConvertFor2 transfers the converted amount correctly', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.claimAndConvertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when calling claimAndConvertFor2 without approval', async () => {
        await utils.catchRevert(bancorNetwork.claimAndConvertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0));
    });

    it('verifies that claimAndConvert2 transfers the converted amount correctly', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[0]);
        await bancorNetwork.claimAndConvert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[0]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when calling claimAndConvert2 without approval', async () => {
        await utils.catchRevert(bancorNetwork.claimAndConvert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0));
    });

    it('verifies that convertFor2 is allowed for a whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        await converter1.setConversionWhitelist(whitelist.address);

        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('should throw when calling convertFor2 with a non whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await converter1.setConversionWhitelist(whitelist.address);

        await utils.catchRevert(bancorNetwork.convertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 }));
        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken1BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor2(smartToken1BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token through multiple converters', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken2BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await bancorNetwork.convertFor2(smartToken2BuyPath, 10000, 1, accounts[1], utils.zeroAddress, 0, { value: 10000 });
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that convert2 is allowed for a whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        await converter1.setConversionWhitelist(whitelist.address);

        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');

        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('should throw when calling convert2 with a non whitelisted account', async () => {
        let whitelist = await Whitelist.new();
        await converter1.setConversionWhitelist(whitelist.address);

        await utils.catchRevert(bancorNetwork.convert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 }));
        await converter1.setConversionWhitelist(utils.zeroAddress);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken1BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await bancorNetwork.convert2(smartToken1BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for buying the smart token through multiple converters', async () => {
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken2BuyPath, 10000))[0];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await bancorNetwork.convert2(smartToken2BuyPath, 10000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('should be able to quickConvert2 from a non compliant erc-20 to another token', async () => {
        await erc20Token.approve(converter4.address, 1000);
        let path = [erc20Token.address, smartToken4.address, smartToken4.address];
        let prevBalance = await smartToken4.balanceOf.call(accounts[0]);
        await converter4.quickConvert2(path, 1000, 1, utils.zeroAddress, 0);
        let postBalance = await smartToken4.balanceOf.call(accounts[0]);

        assert.isAbove(postBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should be able to quickConvert2 from a smart token to a non compliant erc-20', async () => {
        let path = [smartToken4.address, smartToken4.address, erc20Token.address];
        let prevBalance = await erc20Token.balanceOf.call(accounts[0]);
        await converter4.quickConvert2(path, 1000, 1, utils.zeroAddress, 0);
        let postBalance = await erc20Token.balanceOf.call(accounts[0]);

        assert.isAbove(postBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy with a single converter results in increased balance for the buyer', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        let res = await converter1.quickConvert2(smartToken1BuyPath, 100, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
        // console.log(`gas used for converting eth -> 1: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that quick buy with multiple converters results in increased balance for the buyer', async () => {
        let prevBalance = await smartToken2.balanceOf.call(accounts[1]);

        let res = await converter2.quickConvert2(smartToken2BuyPath, 100, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100 });
        let newBalance = await smartToken2.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
        // console.log(`gas used for converting eth -> 1 -> 2: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that quick buy with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
        let prevBalance = await smartToken2.balanceOf.call(accounts[0]);
        
        let token1Return = (await converter1.getPurchaseReturn(etherToken.address, 100000))[0];
        let token2Return = (await converter2.getPurchaseReturn(smartToken1.address, token1Return))[0];

        await converter2.quickConvert2(smartToken2BuyPath, 100000, token2Return, utils.zeroAddress, 0, { value: 100000 });
        let newBalance = await smartToken2.balanceOf.call(accounts[0]);

        assert.equal(token2Return.toNumber(), newBalance.toNumber() - prevBalance.toNumber(), "new balance isn't equal to the expected purchase return");
    });

    it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
        await utils.catchRevert(converter2.quickConvert2(smartToken2BuyPath, 100, 1000000, utils.zeroAddress, 0, { from: accounts[1], value: 100 }));
    });

    it('should throw when attempting to quick buy and passing an amount higher than the ETH amount sent with the request', async () => {
        await utils.catchRevert(converter2.quickConvert2(smartToken2BuyPath, 100001, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100000 }));
    });

    it('verifies the caller balances after selling directly for ether with a single converter', async () => {
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let res = await converter1.quickConvert2(smartToken1SellPath, 10000, 1, utils.zeroAddress, 0);
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

        let res = await converter2.quickConvert2(smartToken2SellPath, 10000, 1, utils.zeroAddress, 0);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('should throw when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
        await utils.catchRevert(converter2.quickConvert2(smartToken2SellPath, 10000, 20000, utils.zeroAddress, 0));
    });

    it('verifies the caller balances after converting from one token to another with multiple converters', async () => {

        let path = [smartToken1.address,
                    smartToken2.address, smartToken2.address,
                    smartToken2.address, smartToken3.address,
                    smartToken3.address, smartToken4.address];

        let prevToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let prevToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        await converter1.quickConvert2(path, 1000, 1, utils.zeroAddress, 0);
        let newToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let newToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        assert(newToken4Balance.greaterThan(prevToken4Balance), "bought token balance isn't higher than previous balance");
        assert(newToken1Balance.lessThan(prevToken1Balance), "sold token balance isn't lower than previous balance");
    });

    it('verifies that getReturnByPath returns the correct amount for cross reserve conversion', async () => {
        await converter2.quickConvert2([etherToken.address, smartToken1.address, smartToken1.address], 1000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 1000 });
        await smartToken1.approve(converter2.address, 100, { from: accounts[1] });
        let path = [smartToken1.address, smartToken2.address, smartToken3.address];
        let returnByPath = (await bancorNetwork.getReturnByPath.call(path, 100))[0];
        let balanceBeforeTransfer = await smartToken3.balanceOf.call(accounts[1]);
        await converter2.quickConvert2(path, 100, 1, utils.zeroAddress, 0, { from: accounts[1] });
        let balanceAfterTransfer = await smartToken3.balanceOf.call(accounts[1]);
        assert.equal(returnByPath, balanceAfterTransfer - balanceBeforeTransfer);
    });

    it('verifies that getReturnByPath returns the correct amount for selling the smart token', async () => {
        await converter1.quickConvert2(smartToken1BuyPath, 100, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100 });
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken1SellPath, 100))[0];
        let balanceBeforeTransfer = web3.eth.getBalance(accounts[1]);
        let res = await converter1.quickConvert2(smartToken1SellPath, 100, 1, utils.zeroAddress, 0, { from: accounts[1] });
        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        let balanceAfterTransfer = web3.eth.getBalance(accounts[1]);
        assert.equal(returnByPath.toNumber(), balanceAfterTransfer.minus(balanceBeforeTransfer).plus(transactionCost).toNumber());
    });

    it('verifies that getReturnByPath returns the correct amount for selling the smart token through multiple converters', async () => {
        await converter2.quickConvert2(smartToken2BuyPath, 100, 1, utils.zeroAddress, 0, { from: accounts[1], value: 100 });
        let returnByPath = (await bancorNetwork.getReturnByPath.call(smartToken2SellPath, 100))[0];
        let balanceBeforeTransfer = web3.eth.getBalance(accounts[1]);
        let res = await converter2.quickConvert2(smartToken2SellPath, 100, 1, utils.zeroAddress, 0, { from: accounts[1] });
        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        let balanceAfterTransfer = web3.eth.getBalance(accounts[1]);
        assert.equal(returnByPath.toNumber(), balanceAfterTransfer.minus(balanceBeforeTransfer).plus(transactionCost).toNumber());
        // console.log(`gas used for converting 2 -> 1 -> eth: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies that getReturnByPath returns the correct amount for selling the smart token with a long conversion path', async () => {
        await converter4.quickConvert2([etherToken.address, smartToken1.address, smartToken1.address, smartToken2.address, smartToken3.address], 1000, 1, utils.zeroAddress, 0, { from: accounts[1], value: 1000 });
        let path = [smartToken3.address, smartToken2.address, smartToken2.address, smartToken2.address, smartToken1.address, smartToken1.address, etherToken.address];
        let returnByPath = (await bancorNetwork.getReturnByPath.call(path, 100))[0];
        let balanceBeforeTransfer = web3.eth.getBalance(accounts[1]);
        let res = await converter3.quickConvert2(path, 100, 1, utils.zeroAddress, 0, { from: accounts[1] });
        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        let balanceAfterTransfer = web3.eth.getBalance(accounts[1]);
        assert.equal(returnByPath.toNumber(), balanceAfterTransfer.minus(balanceBeforeTransfer).plus(transactionCost).toNumber());
        // console.log(`gas used for converting 3 -> 2 -> 1 -> eth: ${res.receipt.cumulativeGasUsed}`);
    });

    it('verifies quickConvertPrioritized2', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await converter1.quickConvertPrioritized2(smartToken1BuyPath, 100, 1, [], utils.zeroAddress, 0, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when calling quickConvertPrioritized2 with wrong path', async () => {
        let wrongPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken1.address, smartToken1.address];

        await utils.catchRevert(converter1.quickConvertPrioritized2(wrongPath, 100, 1, [], utils.zeroAddress, 0, { from: accounts[1], value: 100 }));
    });

    it('should throw when calling quickConvertPrioritized2 with wrong amount', async () => {
        await utils.catchRevert(converter1.quickConvertPrioritized2(smartToken1BuyPath, 200, 1, [], utils.zeroAddress, 0, { from: accounts[1], value: 100 }));
    });

    it('verifies convertForPrioritized4', async () => {
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await bancorNetwork.convertForPrioritized4(smartToken1BuyPath, 100, 1, accounts[1], [], utils.zeroAddress, 0, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when calling convertForPrioritized4 with wrong path', async () => {
        let wrongPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken1.address, smartToken1.address];

        await utils.catchRevert(bancorNetwork.convertForPrioritized4(wrongPath, 100, 1, accounts[1], [], utils.zeroAddress, 0, { from: accounts[1], value: 100 }));
    });

    it('should throw when calling convertForPrioritized4 with wrong amount', async () => {
        await utils.catchRevert(bancorNetwork.convertForPrioritized4(smartToken1BuyPath, 200, 1, accounts[1], [], utils.zeroAddress, 0, { from: accounts[1], value: 100 }));
    });

    it('verifies that convertFor2 transfers the affiliate fee correctly', async () => {
        let path = smartToken1BuyPath;
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[2]);
        await bancorNetwork.convertFor2(path, 10000, 1, accounts[1], accounts[2], 10000, { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[2]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that convert2 transfers the affiliate fee correctly', async () => {
        let path = smartToken1BuyPath;
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[2]);
        await bancorNetwork.convert2(path, 10000, 1, accounts[2], 10000, { from: accounts[1], value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[2]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that claimAndConvert2 transfers the affiliate fee correctly', async () => {
        let path = smartToken1BuyPath;
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[2]);
        await bancorNetwork.claimAndConvert2(path, 10000, 1, accounts[2], 10000);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[2]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that claimAndConvertFor2 transfers the affiliate fee correctly', async () => {
        await etherToken.approve(bancorNetwork.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[2]);
        await bancorNetwork.claimAndConvertFor2(smartToken1BuyPath, 10000, 1, accounts[1], accounts[2], 10000);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[2]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies that setMaxAffiliateFee can set the maximum affiliate-fee', async () => {
        let oldMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
        await bancorNetwork.setMaxAffiliateFee(oldMaxAffiliateFee.plus(1));
        let newMaxAffiliateFee = await bancorNetwork.maxAffiliateFee.call();
        await bancorNetwork.setMaxAffiliateFee(oldMaxAffiliateFee);
        assert.equal(newMaxAffiliateFee.toString(), oldMaxAffiliateFee.plus(1));
    });

    it('should throw when calling setMaxAffiliateFee with a non-owner or an illegal value', async () => {
        await utils.catchRevert(bancorNetwork.setMaxAffiliateFee("1000000", { from: accounts[1] }));
        await utils.catchRevert(bancorNetwork.setMaxAffiliateFee("1000001", { from: accounts[0] }));
    });
});
