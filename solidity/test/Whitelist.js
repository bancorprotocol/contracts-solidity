const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { expectRevert, expectEvent, constants } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const Whitelist = contract.fromArtifact('Whitelist');

describe('Whitelist', () => {
    let whitelist;
    const address1 = accounts[1];
    const address2 = accounts[2];
    const address3 = accounts[3];
    const nonOwner = accounts[8];

    beforeEach(async () => {
        whitelist = await Whitelist.new();
    });

    it('verifies that a given address is not whitelisted after construction', async () => {
        expect(await whitelist.isWhitelisted.call(address1)).to.be.false();
    });

    it('verifies that the owner can add an address to the whitelist', async () => {
        await whitelist.addAddress(address1);

        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();
    });

    it('should revert when a non owner tries to add an address to the whitelist', async () => {
        await expectRevert(whitelist.addAddress(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('should revert when the owner tries to add an invalid address to the whitelist', async () => {
        await expectRevert(whitelist.addAddress(ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
    });

    it('verifies that the owner can add multiple addresses to the whitelist', async () => {
        await whitelist.addAddresses([address1, address2]);

        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();
        expect(await whitelist.isWhitelisted.call(address2)).to.be.true();
    });

    it('should revert when a non owner tries to add multiple addresses to the whitelist', async () => {
        await expectRevert(whitelist.addAddresses([address1, address2], { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that the owner can remove an address from the whitelist', async () => {
        await whitelist.addAddress(address1);
        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();

        await whitelist.removeAddress(address1);
        expect(await whitelist.isWhitelisted.call(address1)).to.be.false();
    });

    it('should revert when a non owner tries to remove an address from the whitelist', async () => {
        await whitelist.addAddress(address1);
        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();

        await expectRevert(whitelist.removeAddress(address1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that the owner can remove multiple addresses from the whitelist', async () => {
        await whitelist.addAddresses([address1, address2, address3]);
        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();
        expect(await whitelist.isWhitelisted.call(address2)).to.be.true();
        expect(await whitelist.isWhitelisted.call(address3)).to.be.true();

        await whitelist.removeAddresses([address1, address3]);
        expect(await whitelist.isWhitelisted.call(address1)).to.be.false();
        expect(await whitelist.isWhitelisted.call(address2)).to.be.true();
        expect(await whitelist.isWhitelisted.call(address3)).to.be.false();
    });

    it('should revert when a non owner tries to remove multiple address from the whitelist', async () => {
        await whitelist.addAddresses([address1, address2, address3]);
        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();
        expect(await whitelist.isWhitelisted.call(address2)).to.be.true();
        expect(await whitelist.isWhitelisted.call(address3)).to.be.true();

        await expectRevert(whitelist.removeAddresses([address1, address3], { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that an address can be added unless it is already added and removed unless it is already removed', async () => {
        expect(await whitelist.isWhitelisted.call(address1)).to.be.false();

        const res1 = await whitelist.addAddress(address1);
        expectEvent(res1, 'AddressAddition', { _address: address1 });
        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();

        const res2 = await whitelist.addAddress(address1);
        expectEvent.notEmitted(res2, 'AddressAddition');
        expect(await whitelist.isWhitelisted.call(address1)).to.be.true();

        const res3 = await whitelist.removeAddress(address1);
        expectEvent(res3, 'AddressRemoval', { _address: address1 });
        expect(await whitelist.isWhitelisted.call(address1)).to.be.false();

        const res4 = await whitelist.removeAddress(address1);
        expectEvent.notEmitted(res4, 'AddressRemoval');
        expect(await whitelist.isWhitelisted.call(address1)).to.be.false();
    });
});
