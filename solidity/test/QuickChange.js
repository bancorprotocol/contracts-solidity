/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const BancorChanger = artifacts.require('BancorChanger.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const BancorGasPriceLimit = artifacts.require('BancorGasPriceLimit.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./helpers/Utils');

let etherToken;
let smartToken1;
let smartToken2;
let smartToken3;
let smartToken4;
let erc20Token;
let formulaAddress;
let gasPriceLimitAddress;
let changer1;
let changer2;
let changer3;
let changer4;
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

contract('BancorChanger', (accounts) => {
    before(async () => {
        let formula = await BancorFormula.new();
        formulaAddress = formula.address;

        let gasPriceLimit = await BancorGasPriceLimit.new(22000000000);
        gasPriceLimitAddress = gasPriceLimit.address;

        etherToken = await EtherToken.new();
        await etherToken.deposit({ value: 1000000 });

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        await smartToken1.issue(accounts[0], 1000000);

        smartToken2 = await SmartToken.new('Token2', 'TKN2', 2);
        await smartToken2.issue(accounts[0], 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        await smartToken3.issue(accounts[0], 3000000);

        smartToken4 = await SmartToken.new('Token4', 'TKN4', 2);
        await smartToken4.issue(accounts[0], 2500000);

        erc20Token = await TestERC20Token.new('ERC20Token', 'ERC5', 1000000);

        changer1 = await BancorChanger.new(smartToken1.address, formulaAddress, gasPriceLimitAddress, 0, etherToken.address, 250000);
        changer1.address = changer1.address;

        changer2 = await BancorChanger.new(smartToken2.address, formulaAddress, gasPriceLimitAddress, 0, smartToken1.address, 300000);
        changer2.address = changer2.address;
        await changer2.addReserve(smartToken3.address, 150000, false);

        changer3 = await BancorChanger.new(smartToken3.address, formulaAddress, gasPriceLimitAddress, 0, smartToken4.address, 350000);
        changer3.address = changer3.address;

        changer4 = await BancorChanger.new(smartToken4.address, formulaAddress, gasPriceLimitAddress, 0, etherToken.address, 150000);
        changer4.address = changer4.address;
        await changer4.addReserve(erc20Token.address, 220000, false);

        await etherToken.transfer(changer1.address, 50000);
        await smartToken1.transfer(changer2.address, 40000);
        await smartToken3.transfer(changer2.address, 25000);
        await smartToken4.transfer(changer3.address, 30000);
        await etherToken.transfer(changer4.address, 20000);
        await erc20Token.transfer(changer4.address, 35000);

        await smartToken1.transferOwnership(changer1.address);
        await changer1.acceptTokenOwnership();

        await smartToken2.transferOwnership(changer2.address);
        await changer2.acceptTokenOwnership();

        await smartToken3.transferOwnership(changer3.address);
        await changer3.acceptTokenOwnership();

        await smartToken4.transferOwnership(changer4.address);
        await changer4.acceptTokenOwnership();

        smartToken1QuickBuyPath = [etherToken.address, smartToken1.address, smartToken1.address];
        smartToken2QuickBuyPath = [etherToken.address, smartToken1.address, smartToken1.address, smartToken2.address, smartToken2.address];
        smartToken3QuickBuyPath = [etherToken.address, smartToken4.address, smartToken4.address, smartToken3.address, smartToken4.address];
        smartToken4QuickBuyPath = [etherToken.address, smartToken4.address, smartToken4.address];
        erc20QuickBuyPath = [etherToken.address, smartToken4.address, erc20Token.address];

        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);
        await changer3.setQuickBuyPath(smartToken3QuickBuyPath);
        await changer4.setQuickBuyPath(smartToken4QuickBuyPath);

        smartToken1QuickSellPath = [smartToken1.address, smartToken1.address, etherToken.address];
        smartToken2QuickSellPath = [smartToken2.address, smartToken2.address, smartToken1.address, smartToken1.address, etherToken.address];
    });

    it('verifies that the owner can set the quick buy path', async () => {
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);

        let quickBuyPathLength = await changer1.getQuickBuyPathLength.call();
        assert.equal(quickBuyPathLength, smartToken1QuickBuyPath.length);
    });

    it('verifies that the owner can clear the quick buy path', async () => {
        await changer1.clearQuickBuyPath();

        let prevQuickBuyPathLength = await changer1.getQuickBuyPathLength.call();
        assert.equal(prevQuickBuyPathLength, 0);
    });

    it('verifies that the correct quick buy path length is returned', async () => {
        await changer1.clearQuickBuyPath();

        let prevQuickBuyPathLength = await changer1.getQuickBuyPathLength.call();
        assert.equal(prevQuickBuyPathLength, 0);

        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        let newQuickBuyPathLength = await changer1.getQuickBuyPathLength.call();
        assert.equal(newQuickBuyPathLength, smartToken1QuickBuyPath.length);
    });

    it('verifies the quick buy path values after the owner sets one', async () => {
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);

        let newQuickBuyPathLength = await changer1.getQuickBuyPathLength.call();
        assert.equal(newQuickBuyPathLength, smartToken1QuickBuyPath.length);

        for (let i = 0; i < newQuickBuyPathLength; ++i) {
            let quickBuyPathElement = await changer1.quickBuyPath.call(i);
            assert.equal(quickBuyPathElement, smartToken1QuickBuyPath[i]);
        }
    });

    it('should throw when a non owner attempts to set the quick buy path', async () => {
        try {
            await changer1.setQuickBuyPath(smartToken1QuickBuyPath, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set an invalid short quick buy path', async () => {
        try {
            await changer1.setQuickBuyPath([etherToken.address]);
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
            await changer1.setQuickBuyPath(longQuickBuyPath);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set a quick buy path with an invalid length', async () => {
        try {
            await changer1.setQuickBuyPath([etherToken.address, smartToken1.address]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to clear the quick buy path', async () => {
        try {
            await changer1.clearQuickBuyPath({ from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the quick buy ether token existence check returns true if one exists', async () => {
        await changer1.clearQuickBuyPath();
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        let exists = await changer1.hasQuickBuyEtherToken.call();
        assert(exists);
    });

    it('verifies that the quick buy ether token existence check returns false if one does not exist', async () => {
        await changer1.clearQuickBuyPath();
        let exists = await changer1.hasQuickBuyEtherToken.call();
        assert(!exists);
    });

    it('verifies that ether token address is returned correctly', async () => {
        await changer1.clearQuickBuyPath();
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        let quickBuyEtherToken = await changer1.getQuickBuyEtherToken.call();
        assert.equal(quickBuyEtherToken, etherToken.address);
    });

    it('show throw when requesting the quick buy ether token when no quick buy path is set', async () => {
        await changer1.clearQuickBuyPath();

        try {
            await changer1.getQuickBuyEtherToken.call();
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that quick buy with a single changer results in increased balance for the buyer', async () => {
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevBalance = await smartToken1.balanceOf.call(accounts[1]);

        await changer1.quickBuy(1, { from: accounts[1], value: 100 });
        let newBalance = await smartToken1.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy with multiple changers results in increased balance for the buyer', async () => {
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevBalance = await smartToken2.balanceOf.call(accounts[1]);

        await changer2.quickBuy(1, { from: accounts[1], value: 100 });
        let newBalance = await smartToken2.balanceOf.call(accounts[1]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy through the fallback function results in increased balance for the buyer', async () => {
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevBalance = await smartToken2.balanceOf.call(accounts[0]);

        await changer2.send(100);
        let newBalance = await smartToken2.balanceOf.call(accounts[0]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('verifies that quick buy of an ERC20 token through the fallback function results in increased balance for the buyer', async () => {
        await changer4.setQuickBuyPath(erc20QuickBuyPath);
        let prevBalance = await erc20Token.balanceOf.call(accounts[0]);

        await changer4.send(100);
        let newBalance = await erc20Token.balanceOf.call(accounts[0]);

        assert.isAbove(newBalance.toNumber(), prevBalance.toNumber(), "new balance isn't higher than previous balance");
    });

    it('should throw when attempting to quick buy and the return amount is lower than the given minimum', async () => {
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);

        try {
            await changer2.quickBuy(1000000, { from: accounts[1], value: 100 });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the caller balances after selling directly for ether with a single changer', async () => {
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let res = await changer1.quickChange(smartToken1QuickSellPath, 10000, 1);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken1.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('verifies the caller balances after selling directly for ether with multiple changers', async () => {
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);
        let prevETHBalance = web3.eth.getBalance(accounts[0]);
        let prevTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let res = await changer2.quickChange(smartToken2QuickSellPath, 10000, 1);
        let newETHBalance = web3.eth.getBalance(accounts[0]);
        let newTokenBalance = await smartToken2.balanceOf.call(accounts[0]);

        let transaction = web3.eth.getTransaction(res.tx);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert(newETHBalance.greaterThan(prevETHBalance.minus(transactionCost)), "new ETH balance isn't higher than previous balance");
        assert(newTokenBalance.lessThan(prevTokenBalance), "new token balance isn't lower than previous balance");
    });

    it('should throw when attempting to sell directly for ether and the return amount is lower than the given minimum', async () => {
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);

        try {
            await changer2.quickChange(smartToken2QuickSellPath, 10000, 20000);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the caller balances after changing from one token to another with multiple changers', async () => {
        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);

        let path = [smartToken1.address,
                    smartToken2.address, smartToken2.address,
                    smartToken2.address, smartToken3.address,
                    smartToken3.address, smartToken4.address];

        let prevToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let prevToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        await changer1.quickChange(path, 1000, 1);
        let newToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let newToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        assert(newToken4Balance.greaterThan(prevToken4Balance), "bought token balance isn't higher than previous balance");
        assert(newToken1Balance.lessThan(prevToken1Balance), "sold token balance isn't lower than previous balance");
    });
});
