const { expect } = require('chai');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const DSToken = artifacts.require('DSToken');

contract('DSToken', (accounts) => {
    let token;
    const name = 'Token1';
    const symbol = 'TKN1';
    const decimals = new BN(18);

    const owner = accounts[0];
    const receiver = accounts[1];
    const receiver2 = accounts[2];
    const nonOwner = accounts[3];

    beforeEach(async () => {
        token = await DSToken.new(name, symbol, decimals);
    });

    it('verifies the token name, symbol and decimal units after construction', async () => {
        expect(await token.name.call()).to.eql(name);
        expect(await token.symbol.call()).to.eql(symbol);
        expect(await token.decimals.call()).to.be.bignumber.equal(decimals);
    });

    it('should revert when attempting to construct a token with no name', async () => {
        await expectRevert(DSToken.new('', symbol, decimals), 'ERR_INVALID_NAME');
    });

    it('should revert when attempting to construct a token with no symbol', async () => {
        await expectRevert(DSToken.new(name, '', decimals), 'ERR_INVALID_SYMBOL');
    });

    it('verifies that issue tokens updates the target balance and the total supply', async () => {
        const value = new BN(100);
        await token.issue(receiver, value);

        const balance = await token.balanceOf.call(receiver);
        expect(balance).to.be.bignumber.equal(value);

        const totalSupply = await token.totalSupply.call();
        expect(totalSupply).to.be.bignumber.equal(value);
    });

    it('verifies that the owner can issue tokens to his/her own account', async () => {
        const value = new BN(10000);
        await token.issue(owner, value);

        const balance = await token.balanceOf.call(owner);
        expect(balance).to.be.bignumber.equal(value);
    });

    it('should revert when the owner attempts to issue tokens to an invalid address', async () => {
        await expectRevert(token.issue(ZERO_ADDRESS, new BN(1)), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when the owner attempts to issue tokens to the token address', async () => {
        await expectRevert(token.issue(token.address, new BN(1)), 'ERR_ADDRESS_IS_SELF');
    });

    it('should revert when a non owner attempts to issue tokens', async () => {
        await expectRevert(token.issue(receiver, new BN(1), { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that destroy tokens updates the target balance and the total supply', async () => {
        const value = new BN(123);
        await token.issue(receiver, value);

        const value2 = new BN(50);
        await token.destroy(receiver, value2);

        const balance = await token.balanceOf.call(receiver);
        expect(balance).to.be.bignumber.equal(value.sub(value2));

        const totalSupply = await token.totalSupply.call();
        expect(totalSupply).to.be.bignumber.equal(value.sub(value2));
    });

    it('verifies that the owner can destroy tokens from his/her own account', async () => {
        const value = new BN(500);
        await token.issue(owner, value);

        const value2 = new BN(499);
        await token.destroy(owner, value2);

        const balance = await token.balanceOf.call(owner);
        expect(balance).to.be.bignumber.equal(value.sub(value2));
    });

    it('should revert when a non owner attempts to destroy tokens', async () => {
        const value = new BN(100);
        await token.issue(receiver, value);

        await expectRevert(token.destroy(receiver, new BN(1), { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });
});
