const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { ZERO_ADDRESS } = constants;

const ERC20Token = contract.fromArtifact('ERC20Token');

describe('ERC20Token', () => {
    let token;
    const name = 'Token1';
    const symbol = 'TKN1';
    const decimals = new BN(18);
    const totalSupply = new BN(10000);
    const sender = defaultSender;
    const receiver = accounts[1];
    const receiver2 = accounts[2];

    beforeEach(async () => {
        token = await ERC20Token.new(name, symbol, decimals, totalSupply);
    });

    it('verifies the token name after construction', async () => {
        expect(await token.name.call()).to.eql(name);
    });

    it('verifies the token symbol after construction', async () => {
        expect(await token.symbol.call()).to.eql(symbol);
    });

    it('verifies the token decimals after construction', async () => {
        expect(await token.decimals.call()).to.be.bignumber.equal(decimals);
    });

    it('verifies the balances after a transfer', async () => {
        const value = new BN(500);
        await token.transfer(receiver, value);

        const senderBalance = await token.balanceOf.call(sender);
        expect(senderBalance).to.be.bignumber.equal(totalSupply.sub(value));

        const receiverBalance = await token.balanceOf.call(receiver);
        expect(receiverBalance).to.be.bignumber.equal(value);
    });

    it('verifies that a transfer fires a Transfer event', async () => {
        const value = new BN(100);
        const res = await token.transfer(receiver, value);
        expectEvent(res, 'Transfer', { _from: sender, _to: receiver, _value: value });
    });

    it('should revert when attempting to transfer more than the balance', async () => {
        const initialTotalSupply = new BN(100);
        const token2 = await ERC20Token.new(name, symbol, decimals, initialTotalSupply);

        await expectRevert(token2.transfer(receiver, initialTotalSupply.add(new BN(1))), 'ERR_UNDERFLOW');
    });

    it('should revert when attempting to transfer to an invalid address', async () => {
        await expectRevert(token.transfer(ZERO_ADDRESS, new BN(1)), 'ERR_INVALID_ADDRESS');
    });

    it('verifies the allowance after an approval', async () => {
        const value = new BN(500);
        await token.approve(receiver, value);

        const allowance = await token.allowance.call(sender, receiver);
        expect(allowance).to.be.bignumber.equal(value);
    });

    it('verifies that an approval fires an Approval event', async () => {
        const value = new BN(5000);
        const res = await token.approve(receiver, value);
        expectEvent(res, 'Approval', { _owner: sender, _spender: receiver, _value: value });
    });

    it('should revert when attempting to define allowance for an invalid address', async () => {
        await expectRevert(token.approve(ZERO_ADDRESS, new BN(1)), 'ERR_INVALID_ADDRESS');
    });

    it('verifies the balances after transferring from another account', async () => {
        const receiver2 = accounts[2];
        const value = new BN(345);
        const value2 = new BN(15);
        await token.approve(receiver, value);
        await token.transferFrom(sender, receiver2, value2, { from: receiver });

        const senderBalance = await token.balanceOf.call(sender);
        expect(senderBalance).to.be.bignumber.equal(totalSupply.sub(value2));

        const receiverBalance = await token.balanceOf.call(receiver);
        expect(receiverBalance).to.be.bignumber.equal(new BN(0));

        const receiver2Balance = await token.balanceOf.call(receiver2);
        expect(receiver2Balance).to.be.bignumber.equal(value2);
    });

    it('verifies that transferring from another account fires a Transfer event', async () => {
        const value = new BN(623);
        const value2 = new BN(12);
        await token.approve(receiver, value);

        const res = await token.transferFrom(sender, receiver2, value2, { from: receiver });
        expectEvent(res, 'Transfer', { _from: sender, _to: receiver2, _value: value2 });
    });

    it('verifies the new allowance after transferring from another account', async () => {
        const value = new BN(105);
        const value2 = new BN(50);
        await token.approve(receiver, value);
        await token.transferFrom(sender, receiver2, value2, { from: receiver });

        const allowance = await token.allowance.call(sender, receiver);
        expect(allowance).to.be.bignumber.equal(value.sub(value2));
    });

    it('should revert when attempting to transfer from another account more than the allowance', async () => {
        const value = new BN(200);
        await token.approve(receiver, value);

        await expectRevert(
            token.transferFrom(sender, receiver2, value.add(new BN(1)), { from: receiver }),
            'ERR_UNDERFLOW'
        );
    });

    it('should revert when attempting to transfer from an invalid account', async () => {
        const value = new BN(10);
        await token.approve(receiver, value);

        await expectRevert(
            token.transferFrom(ZERO_ADDRESS, receiver2, new BN(0), { from: receiver }),
            'ERR_INVALID_ADDRESS'
        );
    });

    it('should revert when attempting to transfer from to an invalid account', async () => {
        const value = new BN(111);
        await token.approve(receiver, value);

        await expectRevert(
            token.transferFrom(sender, ZERO_ADDRESS, new BN(0), { from: receiver }),
            'ERR_INVALID_ADDRESS'
        );
    });
});
