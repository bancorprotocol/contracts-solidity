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
let smartToken1QuickBuyPath;
let smartToken2QuickBuyPath;
let smartToken3QuickBuyPath;
let smartToken4QuickBuyPath;
let erc20QuickBuyPath;
let smartToken1QuickSellPath;
let smartToken2QuickSellPath;

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
        let quickConverter = await BancorQuickConverter.new();
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
});
