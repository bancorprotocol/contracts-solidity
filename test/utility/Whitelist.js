const { expect } = require('chai');
const { ethers } = require('hardhat');

const Contracts = require('../helpers/Contracts');

let whitelist;

let accounts;
let address1;
let address2;
let address3;
let nonOwner;

describe('Whitelist', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        address1 = accounts[1];
        address2 = accounts[2];
        address3 = accounts[3];
        nonOwner = accounts[8];
    });

    beforeEach(async () => {
        whitelist = await Contracts.Whitelist.deploy();
    });

    it('verifies that a given address is not whitelisted after construction', async () => {
        expect(await whitelist.isWhitelisted(address1.address)).to.be.false;
    });

    it('verifies that the owner can add an address to the whitelist', async () => {
        await whitelist.addAddress(address1.address);

        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;
    });

    it('should revert when a non owner tries to add an address to the whitelist', async () => {
        await expect(whitelist.connect(nonOwner).addAddress(address1.address)).to.be.revertedWith('ERR_ACCESS_DENIED');
    });

    it('should revert when the owner tries to add an invalid address to the whitelist', async () => {
        await expect(whitelist.addAddress(ethers.constants.AddressZero)).to.be.revertedWith('ERR_INVALID_ADDRESS');
    });

    it('verifies that the owner can add multiple addresses to the whitelist', async () => {
        await whitelist.addAddresses([address1.address, address2.address]);

        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;
        expect(await whitelist.isWhitelisted(address2.address)).to.be.true;
    });

    it('should revert when a non owner tries to add multiple addresses to the whitelist', async () => {
        await expect(whitelist.connect(nonOwner).addAddresses([address1.address, address2.address])).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
    });

    it('verifies that the owner can remove an address from the whitelist', async () => {
        await whitelist.addAddress(address1.address);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;

        await whitelist.removeAddress(address1.address);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.false;
    });

    it('should revert when a non owner tries to remove an address from the whitelist', async () => {
        await whitelist.addAddress(address1.address);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;

        await expect(whitelist.connect(nonOwner).removeAddress(address1.address)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
    });

    it('verifies that the owner can remove multiple addresses from the whitelist', async () => {
        await whitelist.addAddresses([address1.address, address2.address, address3.address]);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;
        expect(await whitelist.isWhitelisted(address2.address)).to.be.true;
        expect(await whitelist.isWhitelisted(address3.address)).to.be.true;

        await whitelist.removeAddresses([address1.address, address3.address]);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.false;
        expect(await whitelist.isWhitelisted(address2.address)).to.be.true;
        expect(await whitelist.isWhitelisted(address3.address)).to.be.false;
    });

    it('should revert when a non owner tries to remove multiple address from the whitelist', async () => {
        await whitelist.addAddresses([address1.address, address2.address, address3.address]);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;
        expect(await whitelist.isWhitelisted(address2.address)).to.be.true;
        expect(await whitelist.isWhitelisted(address3.address)).to.be.true;

        await expect(
            whitelist.connect(nonOwner).removeAddresses([address1.address, address3.address])
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
    });

    it('verifies that an address can be added unless it is already added and removed unless it is already removed', async () => {
        expect(await whitelist.isWhitelisted(address1.address)).to.be.false;

        await expect(await whitelist.addAddress(address1.address))
            .to.emit(whitelist, 'AddressAddition')
            .withArgs(address1.address);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;

        expect(await whitelist.addAddress(address1.address)).to.not.emit(whitelist, 'AddressAddition');
        expect(await whitelist.isWhitelisted(address1.address)).to.be.true;

        await expect(await whitelist.removeAddress(address1.address))
            .to.emit(whitelist, 'AddressRemoval')
            .withArgs(address1.address);
        expect(await whitelist.isWhitelisted(address1.address)).to.be.false;

        expect(await whitelist.removeAddress(address1.address)).to.not.emit(whitelist, 'AddressRemoval');
        expect(await whitelist.isWhitelisted(address1.address)).to.be.false;
    });
});
