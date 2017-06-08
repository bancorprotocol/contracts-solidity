/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const SmartToken = artifacts.require('SmartToken.sol');
const utils = require('./helpers/Utils');

contract('SmartToken', (accounts) => {
    it('verifies the token name, symbol and decimal units after construction', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let name = await token.name.call();
        assert.equal(name, 'Token1');
        let symbol = await token.symbol.call();
        assert.equal(symbol, 'TKN1');
        let decimals = await token.decimals.call();
        assert.equal(decimals, 2);
    });

    it('should throw when attempting to construct a token with no name', async () => {
        try {
            await SmartToken.new('', 'TKN1', 2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when attempting to construct a token with no symbol', async () => {
        try {
            await SmartToken.new('Token1', '', 2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can disable & re-enable transfers', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.disableTransfers(true);
        let transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, false);
        await token.disableTransfers(false);
        transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, true);
    });

    it('should throw when a non owner attempts to disable transfers', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);

        try {
            await token.disableTransfers(true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that issue tokens updates the target balance and the total supply', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 100);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 100);
    });

    it('verifies that the owner can issue tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 100);
    });

    it('verifies that the owner can issue tokens to his/her own account', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 100);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 100);
    });

    it('should throw when the owner attempts to issue tokens to an invalid address', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);

        try {
            await token.issue('0x0', 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to issue tokens to the token address', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);

        try {
            await token.issue(token.address, 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to issue tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);

        try {
            await token.issue(accounts[1], 100, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that destroy tokens updates the target balance and the total supply', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        await token.destroy(accounts[1], 20);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 80);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 80);
    });

    it('verifies that the owner can destroy tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        await token.destroy(accounts[1], 20);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 80);
    });

    it('verifies that the owner can destroy tokens from his/her own account', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 100);
        await token.destroy(accounts[0], 20);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 80);
    });

    it('should throw when a non owner attempts to destroy tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);

        try {
            await token.destroy(accounts[1], 20, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies the balances after a transfer', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 10000);
        await token.transfer(accounts[1], 500);
        let balance;
        balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 9500);
        balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 500);
    });

    it('should throw when attempting to transfer while transfers are disabled', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 1000);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 1000);
        await token.transfer(accounts[1], 100);
        await token.disableTransfers(true);
        let transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, false);

        try {
            await token.transfer(accounts[1], 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that a transfer to the token address destroys tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 10000);
        await token.transfer(token.address, 500);
        let balance = await token.balanceOf.call(token.address);
        assert.equal(balance, 0);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 9500);
    });

    it('verifies the allowance after an approval', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 10000);
        await token.approve(accounts[1], 500);
        let allowance = await token.allowance.call(accounts[0], accounts[1]);
        assert.equal(allowance, 500);
    });

    it('should throw when attempting to transfer from while transfers are disabled', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 1000);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 1000);
        await token.approve(accounts[1], 500);
        let allowance = await token.allowance.call(accounts[0], accounts[1]);
        assert.equal(allowance, 500);
        await token.transferFrom(accounts[0], accounts[2], 50, { from: accounts[1] });
        await token.disableTransfers(true);
        let transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, false);

        try {
            await token.transferFrom(accounts[0], accounts[2], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that a transfer from to the token address destroys tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 10000);
        await token.approve(accounts[1], 500);
        await token.transferFrom(accounts[0], token.address, 100, { from: accounts[1] });
        let balance = await token.balanceOf.call(token.address);
        assert.equal(balance, 0);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 9900);
    });
});
