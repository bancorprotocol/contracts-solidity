/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const Whitelist = artifacts.require('Whitelist.sol');
const utils = require('./helpers/Utils');

const invalidAccount = '0x0';

contract('Whitelist', accounts => {
    it('verifies that a given address is not whitelisted after construction', async () => {
        let whitelist = await Whitelist.new();
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(!isWhitelisted);
    });

    it('verifies that the owner can add an address to the whitelist', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(isWhitelisted);
    });

    it('should throw when a non owner tries to add an address to the whitelist', async () => {
        let whitelist = await Whitelist.new();

        try {
            await whitelist.addAddress(accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when the owner tries to add an invalid address to the whitelist', async () => {
        let whitelist = await Whitelist.new();

        try {
            await whitelist.addAddress(invalidAccount);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can add multiple addresses to the whitelist', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddresses([accounts[1], accounts[2]]);
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[2]);
        assert(isWhitelisted);
    });

    it('should throw when a non owner tries to add multiple addresses to the whitelist', async () => {
        let whitelist = await Whitelist.new();

        try {
            await whitelist.addAddresses([accounts[1], accounts[2]], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can remove an address from the whitelist', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(isWhitelisted);

        await whitelist.removeAddress(accounts[1]);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(!isWhitelisted);
    });

    it('should throw when a non owner tries to remove an address from the whitelist', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddress(accounts[1]);
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(isWhitelisted);

        try {
            await whitelist.removeAddress(accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can remove multiple addresses from the whitelist', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddresses([accounts[1], accounts[2], accounts[3]]);
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[2]);
        assert(isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[3]);
        assert(isWhitelisted);

        await whitelist.removeAddresses([accounts[1], accounts[3]]);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(!isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[2]);
        assert(isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[3]);
        assert(!isWhitelisted);
    });

    it('should throw when a non owner tries to remove multiple address from the whitelist', async () => {
        let whitelist = await Whitelist.new();
        await whitelist.addAddresses([accounts[1], accounts[2], accounts[3]]);
        let isWhitelisted = await whitelist.isWhitelisted.call(accounts[1]);
        assert(isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[2]);
        assert(isWhitelisted);
        isWhitelisted = await whitelist.isWhitelisted.call(accounts[3]);
        assert(isWhitelisted);

        try {
            await whitelist.removeAddresses([accounts[1], accounts[3]], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
