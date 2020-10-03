const { expect } = require('chai');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const SmartToken = artifacts.require('SmartToken');

contract('SmartToken', accounts => {
    let token;
    const name = 'Token1';
    const symbol = 'TKN1';
    const decimals = new BN(18);

    const owner = accounts[0];
    const receiver = accounts[1];
    const receiver2 = accounts[2];
    const nonOwner = accounts[3];

    beforeEach(async () => {
        token = await SmartToken.new(name, symbol, decimals);
    });

    it('verifies the token name, symbol and decimal units after construction', async () => {
        expect(await token.name.call()).to.eql(name);
        expect(await token.symbol.call()).to.eql(symbol);
        expect(await token.decimals.call()).to.be.bignumber.equal(decimals);
    });

    it('should revert when attempting to construct a token with no name', async () => {
        await expectRevert(SmartToken.new('', symbol, decimals), 'ERR_INVALID_NAME');
    });

    it('should revert when attempting to construct a token with no symbol', async () => {
        await expectRevert(SmartToken.new(name, '', decimals), 'ERR_INVALID_SYMBOL');
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

    it('verifies the balances after a transfer', async () => {
        const value = new BN(5666);
        await token.issue(owner, value);

        const value2 = new BN(666);
        await token.transfer(receiver, value2);

        const ownerBalance = await token.balanceOf.call(owner);
        expect(ownerBalance).to.be.bignumber.equal(value.sub(value2));

        const receiverBalance = await token.balanceOf.call(receiver);
        expect(receiverBalance).to.be.bignumber.equal(value2);
    });

    it('should revert when attempting to transfer while transfers are disabled', async () => {
        const value = new BN(1000);
        await token.issue(owner, value);

        const value2 = 100;
        await token.transfer(receiver, value2);

        await token.disableTransfers(true);
        await expectRevert(token.transfer(receiver, new BN(1)), 'ERR_TRANSFERS_DISABLED');
    });

    it('verifies the allowance after an approval', async () => {
        const value = new BN(1000);
        await token.issue(owner, value);

        const value2 = new BN(200);
        await token.approve(receiver, value2);

        const allowance = await token.allowance.call(owner, receiver);
        expect(allowance).to.be.bignumber.equal(value2);
    });

    it('should revert when attempting to transfer from while transfers are disabled', async () => {
        const value = new BN(1000);
        await token.issue(owner, value);

        const value2 = new BN(888);
        await token.approve(receiver, value2);

        const allowance = await token.allowance.call(owner, receiver);
        expect(allowance).to.be.bignumber.equal(value2);

        const value3 = new BN(50);
        await token.transferFrom(owner, receiver2, value3, { from: receiver });

        await token.disableTransfers(true);
        await expectRevert(token.transfer(receiver, new BN(1), { from: receiver }), 'ERR_TRANSFERS_DISABLED');
    });
});
