/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const Whitelist = artifacts.require('Whitelist');
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

        await utils.catchRevert(whitelist.addAddress(accounts[1], { from: accounts[2] }));
    });

    it('should throw when the owner tries to add an invalid address to the whitelist', async () => {
        let whitelist = await Whitelist.new();

        await utils.catchRevert(whitelist.addAddress(invalidAccount));
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

        await utils.catchRevert(whitelist.addAddresses([accounts[1], accounts[2]], { from: accounts[2] }));
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

        await utils.catchRevert(whitelist.removeAddress(accounts[1], { from: accounts[2] }));
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

        await utils.catchRevert(whitelist.removeAddresses([accounts[1], accounts[3]], { from: accounts[2] }));
    });

    it('verifies that an address can be added unless it is already added and removed unless it is already removed', async () => {
        let whitelist = await Whitelist.new();
        let status0 = await whitelist.isWhitelisted.call(accounts[1]);
        let response1 = await whitelist.addAddress(accounts[1]);
        let status1 = await whitelist.isWhitelisted.call(accounts[1]);
        let response2 = await whitelist.addAddress(accounts[1]);
        let status2 = await whitelist.isWhitelisted.call(accounts[1]);
        let response3 = await whitelist.removeAddress(accounts[1]);
        let status3 = await whitelist.isWhitelisted.call(accounts[1]);
        let response4 = await whitelist.removeAddress(accounts[1]);
        let status4 = await whitelist.isWhitelisted.call(accounts[1]);
        assert(!status0 && status1 && status2 && !status3 && !status4);
        assert(response1.logs.length == 1 && response1.logs[0].event == "AddressAddition" && response1.logs[0].args._address == accounts[1]);
        assert(response2.logs.length == 0);
        assert(response3.logs.length == 1 && response3.logs[0].event == "AddressRemoval" && response3.logs[0].args._address == accounts[1]);
        assert(response4.logs.length == 0);
    });
});