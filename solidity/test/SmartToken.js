/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const SmartToken = artifacts.require('SmartToken.sol');
const utils = require('./helpers/Utils');

const changerAddress1 = '0x32f0f93396f0865d7ce412695beb3c3ad9ccca75';
const changerAddress2 = '0x3f1a081f8b6093f480cb789f99903da4e87afaa1';

contract('SmartToken', (accounts) => {
    it('verifies the token name, symbol, decimal units and changer after construction', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let name = await token.name.call();
        assert.equal(name, 'Token1');
        let symbol = await token.symbol.call();
        assert.equal(symbol, 'TKN1');
        let decimals = await token.decimals.call();
        assert.equal(decimals, 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);
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

    it('verifies that the owner can set the token changer if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);
        await token.setChanger(changerAddress1);
        changer = await token.changer.call();
        assert.equal(changer, changerAddress1);
    });

    it('should throw when a non owner attempts to set the token changer if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);

        try {
            await token.setChanger(changerAddress1, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to set the token changer when a changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(changerAddress1);

        try {
            await token.setChanger(changerAddress2);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token changer can update the changer', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(accounts[1]);
        await token.setChanger(changerAddress1, { from: accounts[1] });
        let changer = await token.changer.call();
        assert.equal(changer, changerAddress1);
    });

    it('verifies that the token changer can remove itself from the token', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(accounts[1]);
        await token.setChanger('0x0', { from: accounts[1] });
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);
    });

    it('verifies that the owner can disable & re-enable transfers if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);
        await token.disableTransfers(true);
        let transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, false);
        await token.disableTransfers(false);
        transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, true);
    });

    it('should throw when a non owner attempts to disable transfers if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);

        try {
            await token.disableTransfers(true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to disable transfers when a changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(changerAddress1);

        try {
            await token.disableTransfers(true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token changer can disable & re-enable transfers', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(accounts[1]);
        await token.disableTransfers(true, { from: accounts[1] });
        let transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, false);
        await token.disableTransfers(false, { from: accounts[1] });
        transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, true);
    });

    it('verifies that issue tokens updates the target balance and the total supply', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        let totalSupply = await token.totalSupply.call();
        assert.equal(totalSupply, 100);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 100);
    });

    it('verifies that the owner can issue tokens if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 100);
    });

    it('verifies that the owner can issue tokens to his/her own account if no changer is set', async () => {
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

    it('should throw when the owner attempts to issue 0 tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);

        try {
            await token.issue(accounts[1], 0);
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

    it('should throw when a non owner attempts to issue tokens if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);

        try {
            await token.issue(accounts[1], 100, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to issue tokens when a changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(changerAddress1);

        try {
            await token.issue(accounts[1], 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token changer can issue tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.setChanger(accounts[1]);
        await token.issue(accounts[2], 100, { from: accounts[1] });
        let balance = await token.balanceOf.call(accounts[2]);
        assert.equal(balance, 100);
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

    it('verifies that the owner can destroy tokens if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        await token.destroy(accounts[1], 20);
        let balance = await token.balanceOf.call(accounts[1]);
        assert.equal(balance, 80);
    });

    it('verifies that the owner can destroy tokens from his/her own account no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[0], 100);
        await token.destroy(accounts[0], 20);
        let balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 80);
    });

    it('should throw when the owner attempts to destroy 0 tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);

        try {
            await token.destroy(accounts[1], 0);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to destroy tokens if no changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let changer = await token.changer.call();
        assert.equal(changer, utils.zeroAddress);
        await token.issue(accounts[1], 100);

        try {
            await token.destroy(accounts[1], 20, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner attempts to destroy tokens when a changer is set', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[1], 100);
        await token.setChanger(changerAddress1);

        try {
            await token.destroy(accounts[1], 20);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the token changer can destroy tokens', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        await token.issue(accounts[2], 100);
        await token.setChanger(accounts[1]);
        await token.destroy(accounts[2], 20, { from: accounts[1] });
        let balance = await token.balanceOf.call(accounts[2]);
        assert.equal(balance, 80);
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
