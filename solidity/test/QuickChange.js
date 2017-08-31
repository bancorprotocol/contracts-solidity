/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const BancorChanger = artifacts.require('BancorChanger.sol');
const SmartToken = artifacts.require('SmartToken.sol');
const BancorFormula = artifacts.require('BancorFormula.sol');
const EtherToken = artifacts.require('EtherToken.sol');
const utils = require('./helpers/Utils');

let zeroAddress = '0x0000000000000000000000000000000000000000';
let etherToken;
let etherTokenAddress;
let smartToken1;
let smartToken1Address;
let smartToken2;
let smartToken2Address;
let smartToken3;
let smartToken3Address;
let smartToken4;
let smartToken4Address;
let formulaAddress;
let changer1;
let changer1Address;
let changer2;
let changer2Address;
let changer3;
let changer3Address;
let changer4;
let changer4Address;
let smartToken1QuickBuyPath;
let smartToken2QuickBuyPath;
let smartToken3QuickBuyPath;
let smartToken4QuickBuyPath;
let smartToken1QuickSellPath;
let smartToken2QuickSellPath;

/*
Token network structure:

         SmartToken2
         /         \
    SmartToken1   SmartToken3
          \          \
           \        SmartToken4
            \        /
            EtherToken

*/

contract('BancorChanger', (accounts) => {
    before(async () => {
        let formula = await BancorFormula.new();
        formulaAddress = formula.address;

        etherToken = await EtherToken.new();
        etherTokenAddress = etherToken.address;
        await etherToken.deposit({ value: 1000000 });

        smartToken1 = await SmartToken.new('Token1', 'TKN1', 2);
        smartToken1Address = smartToken1.address;
        await smartToken1.issue(accounts[0], 1000000);

        smartToken2 = await SmartToken.new('Token2', 'TKN2', 2);
        smartToken2Address = smartToken2.address;
        await smartToken2.issue(accounts[0], 2000000);

        smartToken3 = await SmartToken.new('Token3', 'TKN3', 2);
        smartToken3Address = smartToken3.address;
        await smartToken3.issue(accounts[0], 3000000);

        smartToken4 = await SmartToken.new('Token4', 'TKN4', 2);
        smartToken4Address = smartToken4.address;
        await smartToken4.issue(accounts[0], 2500000);

        changer1 = await BancorChanger.new(smartToken1Address, formulaAddress, 0, etherTokenAddress, 250000);
        changer1Address = changer1.address;

        changer2 = await BancorChanger.new(smartToken2Address, formulaAddress, 0, smartToken1Address, 300000);
        changer2Address = changer2.address;
        await changer2.addReserve(smartToken3Address, 150000, false);

        changer3 = await BancorChanger.new(smartToken3Address, formulaAddress, 0, smartToken4Address, 350000);
        changer3Address = changer3.address;

        changer4 = await BancorChanger.new(smartToken4Address, formulaAddress, 0, etherTokenAddress, 150000);
        changer4Address = changer4.address;

        await etherToken.transfer(changer1Address, 50000);
        await smartToken1.transfer(changer2Address, 40000);
        await smartToken3.transfer(changer2Address, 25000);
        await smartToken4.transfer(changer3Address, 30000);
        await etherToken.transfer(changer4Address, 20000);

        await smartToken1.transferOwnership(changer1Address);
        await changer1.acceptTokenOwnership();

        await smartToken2.transferOwnership(changer2Address);
        await changer2.acceptTokenOwnership();

        await smartToken3.transferOwnership(changer3Address);
        await changer3.acceptTokenOwnership();

        await smartToken4.transferOwnership(changer4Address);
        await changer4.acceptTokenOwnership();

        smartToken1QuickBuyPath = [etherTokenAddress, smartToken1Address, smartToken1Address];
        smartToken2QuickBuyPath = [etherTokenAddress, smartToken1Address, smartToken1Address, smartToken2Address, smartToken2Address];
        smartToken3QuickBuyPath = [etherTokenAddress, smartToken4Address, smartToken4Address, smartToken3Address, smartToken4Address];
        smartToken4QuickBuyPath = [etherTokenAddress, smartToken4Address, smartToken4Address];

        await changer1.setQuickBuyPath(smartToken1QuickBuyPath);
        await changer2.setQuickBuyPath(smartToken2QuickBuyPath);
        await changer3.setQuickBuyPath(smartToken3QuickBuyPath);
        await changer4.setQuickBuyPath(smartToken4QuickBuyPath);

        smartToken1QuickSellPath = [smartToken1Address, smartToken1Address, etherTokenAddress];
        smartToken2QuickSellPath = [smartToken2Address, smartToken2Address, smartToken1Address, smartToken1Address, etherTokenAddress];
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
            await changer1.setQuickBuyPath([etherTokenAddress]);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set an invalid long quick buy path', async () => {
        let longQuickBuyPath = [];
        for (let i = 0; i < 51; ++i)
            longQuickBuyPath.push(etherTokenAddress);

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
            await changer1.setQuickBuyPath([etherTokenAddress, smartToken1Address]);
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
        assert.equal(quickBuyEtherToken, etherTokenAddress);
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

        let path = [smartToken1Address,
                    smartToken2Address, smartToken2Address,
                    smartToken2Address, smartToken3Address,
                    smartToken3Address, smartToken4Address];

        let prevToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let prevToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        await changer1.quickChange(path, 1000, 1);
        let newToken1Balance = await smartToken1.balanceOf.call(accounts[0]);
        let newToken4Balance = await smartToken4.balanceOf.call(accounts[0]);

        assert(newToken4Balance.greaterThan(prevToken4Balance), "bought token balance isn't higher than previous balance");
        assert(newToken1Balance.lessThan(prevToken1Balance), "sold token balance isn't lower than previous balance");
    });
});
