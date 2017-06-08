/* global artifacts, contract, it, assert, web3 */
/* eslint-disable prefer-reflect */

const EtherToken = artifacts.require('EtherToken.sol');
const utils = require('./helpers/Utils');

contract('EtherToken', (accounts) => {
    it('verifies the token name after construction', async () => {
        let token = await EtherToken.new();
        let name = await token.name.call();
        assert.equal(name, 'Ether Token');
    });

    it('verifies the token symbol after construction', async () => {
        let token = await EtherToken.new();
        let symbol = await token.symbol.call();
        assert.equal(symbol, 'ETH');
    });

    it('verifies the balance and supply after a deposit through the deposit function', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 1000 });
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 1000);
        let supply = await token.totalSupply.call();
        assert.equal(supply, 1000);
    });

    it('verifies the balance and supply after a deposit through the fallback function', async () => {
        let token = await EtherToken.new();
        await token.send(1000);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 1000);
        let supply = await token.totalSupply.call();
        assert.equal(supply, 1000);
    });

    it('verifies the balance and supply after a withdrawal', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 100 });
        await token.withdraw(20);
        let tokenBalance = await token.balanceOf.call(accounts[0]);
        assert.equal(tokenBalance, 80);
        let supply = await token.totalSupply.call();
        assert.equal(supply, 80);
    });

    it('verifies the ether balance after a withdrawal', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 100 });
        let prevBalance = web3.eth.getBalance(accounts[0]);
        let res = await token.withdraw(20);
        let transaction = web3.eth.getTransaction(res.tx);
        let newBalance = web3.eth.getBalance(accounts[0]);
        prevBalance = web3.toBigNumber(prevBalance);
        newBalance = web3.toBigNumber(newBalance);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert.equal(newBalance.toString(), prevBalance.minus(transactionCost).plus(20).toString());
    });

    it('verifies the ether balance after a withdrawal', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 100 });
        let prevBalance = web3.eth.getBalance(accounts[0]);
        let res = await token.withdraw(20);
        let transaction = web3.eth.getTransaction(res.tx);
        let newBalance = web3.eth.getBalance(accounts[0]);
        prevBalance = web3.toBigNumber(prevBalance);
        newBalance = web3.toBigNumber(newBalance);
        let transactionCost = transaction.gasPrice.times(res.receipt.cumulativeGasUsed);
        assert.equal(newBalance.toString(), prevBalance.minus(transactionCost).plus(20).toString());
    });

    it('verifies the balances after a transfer', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 100 });
        await token.transfer(accounts[1], 10);
        let balance;
        balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 90);
        balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 10);
    });

    it('should throw when attempting to transfer to the token address', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 100 });

        try {
            await token.transfer(token.address, 10);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to transferFrom to the token address', async () => {
        let token = await EtherToken.new();
        await token.deposit({ value: 100 });
        await token.approve(accounts[1], 50);

        try {
            await token.transferFrom(accounts[0], token.address, 10, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
