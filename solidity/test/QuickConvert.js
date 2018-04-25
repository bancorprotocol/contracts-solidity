/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const BancorConverter = artifacts.require('BancorConverter.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const BancorQuickConverter = artifacts.require('BancorQuickConverter.sol');
const BancorConverterExtensions = artifacts.require('BancorConverterExtensions.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./helpers/Utils');
const leftPad = require('left-pad');
const ethUtil = require('ethereumjs-util');
const sha256 = require('js-sha256').sha256;

const accountPrivateKey = '52ca545cf0e7bde7357e2d4a752106bf995a4703d92c448859cef7c67fb7957f';
const untrustedPrivateKey = '0156f5d7ef74552352abbde8db173f69336d5623e7dd4a9dc7b524feb2d4826f';

let etherToken;
let smartToken1;
let smartToken2;
let smartToken3;
let smartToken4;
let erc20Token;
let converterExtensionsAddress;
let converter1;
let converter2;
let converter3;
let converter4;
let quickConverter;
let smartToken1QuickBuyPath;
let smartToken2QuickBuyPath;
let smartToken3QuickBuyPath;
let smartToken4QuickBuyPath;
let erc20QuickBuyPath;
let smartToken1QuickSellPath;
let smartToken2QuickSellPath;

async function prepareData(data) {
    let padedData = '';
    data.forEach((item) => {
        if (typeof (item.value) === 'string' && item.value.substring(0, 2) === '0x') {
            if (item.value.substring(0, 2) === '0x')
                item.value = item.value.substring(2);
            padedData += leftPad((item.value).toString(16), item.length / 4, '0');
        }
        else if (typeof (item.value) === 'number') {
            padedData += leftPad((item.value).toString(16), item.length / 4, '0');
        }
    });
    return padedData;
}

function prefixMessage(msgIn) {
    let msg = msgIn;
    msg = new Buffer(msg.slice(2), 'hex');
    msg = Buffer.concat([
        new Buffer(`\x19Ethereum Signed Message:\n${msg.length.toString()}`),
        msg]);
    msg = web3.sha3(`0x${msg.toString('hex')}`, { encoding: 'hex' });
    msg = new Buffer(msg.slice(2), 'hex');
    return `0x${msg.toString('hex')}`;
}

function sign(msgToSign, privateKey) {
    if (msgToSign.substring(0, 2) !== '0x')
        msgToSign = `0x${msgToSign}`;
    if (privateKey.substring(0, 2) === '0x')
        privateKey = privateKey.substring(2, privateKey.length);

    msgToSign = prefixMessage(msgToSign);

    try {
        const sig = ethUtil.ecsign(
            new Buffer(msgToSign.slice(2), 'hex'),
            new Buffer(privateKey, 'hex'));
        const r = `0x${sig.r.toString('hex')}`;
        const s = `0x${sig.s.toString('hex')}`;
        const v = sig.v;

        return { v: v, r: r, s: s };
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

contract('BancorConverter', (accounts) => {
    before(async () => {
        let formula = await BancorFormula.new();
        let gasPriceLimit = await BancorGasPriceLimit.new(22000000000);
        quickConverter = await BancorQuickConverter.new();
        await quickConverter.setGasPriceLimit(gasPriceLimit.address);
        await quickConverter.setSignerAddress(accounts[3]);
        let converterExtensions = await BancorConverterExtensions.new(formula.address, gasPriceLimit.address, quickConverter.address);
        converterExtensionsAddress = converterExtensions.address;

        etherToken = await EtherToken.new();
        await etherToken.deposit({ value: 10000000 });

        await quickConverter.registerEtherToken(etherToken.address, true);

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        await smartToken1.issue(accounts[0], 1000000);

        smartToken2 = await SmartToken.new('Token2', 'TKN2', 2);
        await smartToken2.issue(accounts[0], 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        await smartToken3.issue(accounts[0], 3000000);

        smartToken4 = await SmartToken.new('Token4', 'TKN4', 2);
        await smartToken4.issue(accounts[0], 2500000);

        erc20Token = await TestERC20Token.new('ERC20Token', 'ERC5', 1000000);

        converter1 = await BancorConverter.new(smartToken1.address, converterExtensionsAddress, 0, etherToken.address, 250000);
        converter1.address = converter1.address;

        converter2 = await BancorConverter.new(smartToken2.address, converterExtensionsAddress, 0, smartToken1.address, 300000);
        converter2.address = converter2.address;
        await converter2.addConnector(smartToken3.address, 150000, false);

        converter3 = await BancorConverter.new(smartToken3.address, converterExtensionsAddress, 0, smartToken4.address, 350000);
        converter3.address = converter3.address;

        converter4 = await BancorConverter.new(smartToken4.address, converterExtensionsAddress, 0, etherToken.address, 150000);
        converter4.address = converter4.address;
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

        smartToken1QuickBuyPath = [etherToken.address, smartToken1.address, smartToken1.address];
        smartToken2QuickBuyPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken2.address, smartToken2.address];
        smartToken3QuickBuyPath = [etherToken.address, smartToken4.address, smartToken4.address, smartToken3.address, smartToken4.address];
        smartToken4QuickBuyPath = [etherToken.address, smartToken4.address, smartToken4.address];
        erc20QuickBuyPath = [etherToken.address, smartToken4.address, erc20Token.address];

        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);
        await converter3.setQuickBuyPath(smartToken3QuickBuyPath);
        await converter4.setQuickBuyPath(smartToken4QuickBuyPath);

        smartToken1QuickSellPath = [smartToken1.address, smartToken1.address, etherToken.address];
        smartToken2QuickSellPath = [smartToken2.address, smartToken2.address, smartToken1.address, smartToken1.address, etherToken.address];
    });

    it('verifies that the owner can set the quick buy path', async () => {
        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);

        let quickBuyPathLength = await converter1.getQuickBuyPathLength.call();
        assert.equal(quickBuyPathLength, smartToken1QuickBuyPath.length);
    });

    it('verifies that the owner can clear the quick buy path', async () => {
        await converter1.clearQuickBuyPath();

        let prevQuickBuyPathLength = await converter1.getQuickBuyPathLength.call();
        assert.equal(prevQuickBuyPathLength, 0);
    });

    it('verifies that the correct quick buy path length is returned', async () => {
        await converter1.clearQuickBuyPath();

        let prevQuickBuyPathLength = await converter1.getQuickBuyPathLength.call();
        assert.equal(prevQuickBuyPathLength, 0);

        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
        let newQuickBuyPathLength = await converter1.getQuickBuyPathLength.call();
        assert.equal(newQuickBuyPathLength, smartToken1QuickBuyPath.length);
    });

    it('verifies the quick buy path values after the owner sets one', async () => {
        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);

        let newQuickBuyPathLength = await converter1.getQuickBuyPathLength.call();
        assert.equal(newQuickBuyPathLength, smartToken1QuickBuyPath.length);

        for (let i = 0; i < newQuickBuyPathLength; ++i) {
            let quickBuyPathElement = await converter1.quickBuyPath.call(i);
            assert.equal(quickBuyPathElement, smartToken1QuickBuyPath[i]);
        }
    });

    it('should throw when a non owner attempts to set the quick buy path', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set an invalid short quick buy path', async () => {
        try {
            await converter1.setQuickBuyPath([etherToken.address]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set an invalid long quick buy path', async () => {
        let longQuickBuyPath = [];
        for (let i = 0; i < 51; ++i)
            longQuickBuyPath.push(etherToken.address);

        try {
            await converter1.setQuickBuyPath(longQuickBuyPath);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set a quick buy path with an invalid length', async () => {
        try {
            await converter1.setQuickBuyPath([etherToken.address, smartToken1.address]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to clear the quick buy path', async () => {
        try {
            await converter1.clearQuickBuyPath({ from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that quick buy with a single converter results in increased balance for the buyer', async () => {
        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await converter1.quickConvert(smartToken1QuickBuyPath, 100, 1, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy with multiple converters results in increased balance for the buyer', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevBalance = await smartToken2.balanceOf.call(accounts[1]);

        await converter2.quickConvert(smartToken2QuickBuyPath, 100, 1, { from: accounts[1], value: 100 });
        let newBalance = await smartToken2.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy through the fallback function results in increased balance for the buyer', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevBalance = await smartToken2.balanceOf.call(accounts[0]);

        await converter2.send(100);
        let newBalance = await smartToken2.balanceOf.call(accounts[0]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy of an ERC20 token through the fallback function results in increased balance for the buyer', async () => {
        await converter4.setQuickBuyPath(erc20QuickBuyPath);
        let prevBalance = await erc20Token.balanceOf.call(accounts[0]);

        await converter4.send(100);
        let newBalance = await erc20Token.balanceOf.call(accounts[0]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy with minimum return equal to the full expected return amount results in the exact increase in balance for the buyer', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevBalance = await smartToken2.balanceOf.call(accounts[0]);

        let token1Return = await converter1.getPurchaseReturn(etherToken.address, 100000);
        let token2Return = await converter2.getPurchaseReturn(smartToken1.address, token1Return);

        await converter2.quickConvert(smartToken2QuickBuyPath, 100000, token2Return, { value: 100000 });
        let newBalance = await smartToken2.balanceOf.call(accounts[0]);

        assert.equal(token2Return.toNumber(), newBalance.toNumber() - prevBalance.toNumber(), "new balance isn't equal to the expected purchase return");
    });

    it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);

        try {
            await converter2.quickConvert(smartToken2QuickBuyPath, 100, 1000000, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to quick buy and passing an amount higher than the ETH amount sent with the request', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);

        try {
            await converter2.quickConvert(smartToken2QuickBuyPath, 100001, 1, { from: accounts[1], value: 100000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the caller balances after selling directly for ether with a single converter', async () => {
        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let res = await converter1.quickConvert(smartToken1QuickSellPath, 10000, 1);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('verifies the caller balances after selling directly for ether with multiple converters', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let res = await converter2.quickConvert(smartToken2QuickSellPath, 10000, 1);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('should throw when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
        await converter2.setQuickBuyPath(smartToken2QuickBuyPath);

        try {
            await converter2.quickConvert(smartToken2QuickSellPath, 10000, 20000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the caller balances after converting from one token to another with multiple converters', async () => {
        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);

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
        let quickConverter1 = await BancorQuickConverter.new();
        await quickConverter1.registerEtherToken(etherToken1.address, true);
        let validEtherToken = await quickConverter1.etherTokens.call(etherToken1.address);
        assert.isTrue(validEtherToken, 'registered etherToken address verification');
    });

    it('should throw when attempting register ether token with invalid address', async () => {
        try {
            let quickConverter1 = await BancorQuickConverter.new();
            await quickConverter1.registerEtherToken('0x0', true);
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
            let quickConverter1 = await BancorQuickConverter.new();
            await quickConverter1.registerEtherToken(etherToken1.address, true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies valid ether token unregistration', async () => {
        let etherToken1 = await EtherToken.new();
        await etherToken1.deposit({ value: 10000000 });
        let quickConverter1 = await BancorQuickConverter.new();
        await quickConverter1.registerEtherToken(etherToken1.address, true);
        let validEtherToken = await quickConverter1.etherTokens.call(etherToken1.address);
        assert.isTrue(validEtherToken, 'registered etherToken address verification');
        await quickConverter1.registerEtherToken(etherToken1.address, false);
        let validEtherToken2 = await quickConverter1.etherTokens.call(etherToken1.address);
        assert.isNotTrue(validEtherToken2, 'unregistered etherToken address verification');
    });

    it('should throw when non owner attempting to unregister ether token', async () => {
        try {
            let etherToken1 = await EtherToken.new();
            await etherToken1.deposit({ value: 10000000 });
            let quickConverter1 = await BancorQuickConverter.new();
            await quickConverter1.registerEtherToken(etherToken1.address, true);
            let validEtherToken = await quickConverter1.etherTokens.call(etherToken1.address);
            assert.isTrue(validEtherToken, 'registered etherToken address verification');
            await quickConverter1.registerEtherToken(etherToken1.address, false, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies convertFor transfer converted amount correctly', async () => {
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await quickConverter.convertFor(smartToken1QuickBuyPath, 10000, 1, accounts[1], { value: 10000 });
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies converting process which recieve a path that starts with a smart token and ends with another smart token', async () => {
        await smartToken4.approve(quickConverter.address, 10000);
        let path = [smartToken4.address, smartToken3.address, smartToken3.address, smartToken2.address, smartToken2.address];
        let balanceBeforeTransfer = await smartToken2.balanceOf.call(accounts[1]);
        await quickConverter.claimAndConvertFor(path, 10000, 1, accounts[1]);
        let balanceAfterTransfer = await smartToken2.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('verifies convertFor return valid converted amount', async () => {
        let amount = await quickConverter.convertFor.call(smartToken1QuickBuyPath, 10000, 1, accounts[1], { value: 10000 });
        assert.isAbove(amount.toNumber(), 1, 'amount converted');
    });

    it('verifies convert return valid converted amount', async () => {
        let amount = await quickConverter.convert.call(smartToken1QuickBuyPath, 10000, 1, { from: accounts[1], value: 10000 });
        assert.isAbove(amount.toNumber(), 1, 'amount converted');
    });

    it('should throw when trying convert ether token without sending ether', async () => {
        try {
            await quickConverter.convertFor(smartToken1QuickBuyPath, 10000, 1, accounts[1], { });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when ether is different than the amount sent ', async () => {
        try {
            let amount = await quickConverter.convertFor.call(smartToken1QuickBuyPath, 20000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when trying convert with invalid path', async () => {
        try {
            let invalidPath = [etherToken.address, smartToken1.address];
            await quickConverter.convertFor(invalidPath, 10000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when trying convert with invalid long path', async () => {
        let longQuickBuyPath = [];
        for (let i = 0; i < 100; ++i)
            longQuickBuyPath.push(etherToken.address);

        try {
            await quickConverter.convertFor(longQuickBuyPath, 10000, 1, accounts[1], { value: 10000 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies convert for transfer converted amount correctly', async () => {
        await etherToken.approve(quickConverter.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[1]);
        await quickConverter.claimAndConvertFor(smartToken1QuickBuyPath, 10000, 1, accounts[1]);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when trying claim and convert without approval', async () => {
        try {
            await quickConverter.claimAndConvertFor(smartToken1QuickBuyPath, 10000, 1, accounts[1]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies convert for transfer converted amount correctly with claimAndConvert', async () => {
        await etherToken.approve(quickConverter.address, 10000);
        let balanceBeforeTransfer = await smartToken1.balanceOf.call(accounts[0]);
        await quickConverter.claimAndConvert(smartToken1QuickBuyPath, 10000, 1);
        let balanceAfterTransfer = await smartToken1.balanceOf.call(accounts[0]);
        assert.isAbove(balanceAfterTransfer.toNumber(), balanceBeforeTransfer.toNumber(), 'amount transfered');
    });

    it('should throw when trying claim and convert without approval with claimAndConvert', async () => {
        try {
            await quickConverter.claimAndConvert(smartToken1QuickBuyPath, 10000, 1);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies quick buy prioritized with trusted signature', async () => {
        await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        let block = await web3.eth.blockNumber;
        let maximumBlock = block + 100;
        let gasPrice = 22000000000;
        let nonce = await web3.eth.getTransactionCount(accounts[1]);

        let data = [
            { value: maximumBlock, length: 256 },
            { value: gasPrice, length: 256 },
            { value: accounts[1], length: 160 },
            { value: nonce, length: 256 }
        ];

        const condensed = await prepareData(data);
        const hash = sha256(new Buffer(condensed, 'hex'));
        let result = sign(hash, accountPrivateKey);

        await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, nonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);
        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when attempts to call quick converter prioritized with untrusted signature', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = 22000000000;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, untrustedPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, nonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with higher block number than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let wrongBlockNumber = maximumBlock + 100;
            let gasPrice = 22000000000;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, wrongBlockNumber, nonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with lower block number than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let wrongBlockNumber = maximumBlock - 1;
            let gasPrice = 22000000000;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, wrongBlockNumber, nonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with higher gas price than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = 21999999999;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, nonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with lower gas price than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = 22000000001;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, nonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with higher nonce than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = 22000000000;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);
            let wrongNonce = nonce + 1;

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, wrongNonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with lower nonce than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = 22000000000;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);
            let wrongNonce = nonce - 1;

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, wrongNonce, result.v, result.r, result.s, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempts to call quick converter prioritized with different address than what appears in the signing data', async () => {
        try {
            await converter1.setQuickBuyPath(smartToken1QuickBuyPath);
            let block = await web3.eth.blockNumber;
            let maximumBlock = block + 100;
            let gasPrice = 22000000000;
            let nonce = await web3.eth.getTransactionCount(accounts[1]);
            let wrongNonce = nonce - 1;

            let data = [
                { value: maximumBlock, length: 256 },
                { value: gasPrice, length: 256 },
                { value: accounts[1], length: 160 },
                { value: nonce, length: 256 }
            ];

            const condensed = await prepareData(data);
            const hash = sha256(new Buffer(condensed, 'hex'));
            let result = sign(hash, accountPrivateKey);

            await converter1.quickConvertPrioritized(smartToken1QuickBuyPath, 100, 1, maximumBlock, wrongNonce, result.v, result.r, result.s, { from: accounts[2], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
