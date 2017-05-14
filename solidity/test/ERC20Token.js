/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./Utils');

const account1 = '0x3ff2d2a0aaaf44c34f99353dd48ffb3b0c4c179b';
const account2 = '0x65682695b6873106daa16c80d3f3ec660fe85f03';
const invalidAccount = '0x0';

contract('ERC20Token', (accounts) => {
    it('verifies the token name after construction', async () => {
        let token = await TestERC20Token.new('Token1', 'TKN1', 0);
        let name = await token.name.call();
        assert.equal(name, 'Token1');
    });

    it('verifies the token symbol after construction', async () => {
        let token = await TestERC20Token.new('Token1', 'TKN1', 0);
        let symbol = await token.symbol.call();
        assert.equal(symbol, 'TKN1');
    });

    it('verifies the balances after a transfer', async () => {
        let token = await TestERC20Token.new('Token1', 'TKN1', 10000);
        await token.transfer(account1, 500);
        let balance;
        balance = await token.balanceOf.call(accounts[0]);
        assert.equal(balance, 9500);
        balance = await token.balanceOf.call(account1);
        assert.equal(balance, 500);
    });

    it('should throw when trying to transfer more than the balance', async () => {
        let token = await TestERC20Token.new('Token1', 'TKN1', 100);

        try {
            await token.transfer(account1, 500);
        }
        catch (error) {
            return utils.ensureException(error);
        }

        assert(false, "didn't thrown");
    });

    it('should throw when trying to transfer to an invalid address', async () => {
        let token = await TestERC20Token.new('Token1', 'TKN1', 100);

        try {
            await token.transfer(invalidAccount, 10);
        }
        catch (error) {
            return utils.ensureException(error);
        }

        assert(false, "didn't thrown");
    });
});
