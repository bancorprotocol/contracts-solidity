const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { ZERO_ADDRESS } = require('../helpers/Constants');

const Contracts = require('../../components/Contracts').default;

const name = 'Token1';
const symbol = 'TKN1';
const decimals = BigNumber.from(18);

let token;

let owner;
let receiver;
let nonOwner;
let accounts;

describe('DSToken', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        receiver = accounts[1];
        nonOwner = accounts[3];
    });

    beforeEach(async () => {
        token = await Contracts.DSToken.deploy(name, symbol, decimals);
    });

    it('verifies the token name, symbol and decimal units after construction', async () => {
        expect(await token.name()).to.equal(name);
        expect(await token.symbol()).to.equal(symbol);
        expect(await token.decimals()).to.equal(decimals);
    });

    it('verifies that issue tokens updates the target balance and the total supply', async () => {
        const value = BigNumber.from(100);
        await token.issue(receiver.address, value);

        const balance = await token.balanceOf(receiver.address);
        expect(balance).to.equal(value);

        const totalSupply = await token.totalSupply();
        expect(totalSupply).to.equal(value);
    });

    it('verifies that the owner can issue tokens to his/her own account', async () => {
        const value = BigNumber.from(10000);
        await token.issue(owner.address, value);

        const balance = await token.balanceOf(owner.address);
        expect(balance).to.equal(value);
    });

    it('should revert when the owner attempts to issue tokens to an invalid address', async () => {
        await expect(token.issue(ZERO_ADDRESS, BigNumber.from(1))).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');
    });

    it('should revert when the owner attempts to issue tokens to the token address', async () => {
        await expect(token.issue(token.address, BigNumber.from(1))).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');
    });

    it('should revert when a non owner attempts to issue tokens', async () => {
        await expect(token.connect(nonOwner).issue(receiver.address, BigNumber.from(1))).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
    });

    it('verifies that destroy tokens updates the target balance and the total supply', async () => {
        const value = BigNumber.from(123);
        await token.issue(receiver.address, value);

        const value2 = BigNumber.from(50);
        await token.destroy(receiver.address, value2);

        const balance = await token.balanceOf(receiver.address);
        expect(balance).to.equal(value.sub(value2));

        const totalSupply = await token.totalSupply();
        expect(totalSupply).to.equal(value.sub(value2));
    });

    it('verifies that the owner can destroy tokens from his/her own account', async () => {
        const value = BigNumber.from(500);
        await token.issue(owner.address, value);

        const value2 = BigNumber.from(499);
        await token.destroy(owner.address, value2);

        const balance = await token.balanceOf(owner.address);
        expect(balance).to.equal(value.sub(value2));
    });

    it('should revert when a non owner attempts to destroy tokens', async () => {
        const value = BigNumber.from(100);
        await token.issue(receiver.address, value);

        await expect(token.connect(nonOwner).destroy(receiver.address, BigNumber.from(1))).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
    });
});
