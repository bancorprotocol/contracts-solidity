const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, BN, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const EtherToken = contract.fromArtifact('EtherToken');

describe('EtherToken', () => {
    let token;
    const name = 'Ether Token';
    const symbol = 'ETH';
    const sender = accounts[0];
    const receiver = accounts[1];

    beforeEach(async () => {
        token = await EtherToken.new(name, symbol);
    });

    it('verifies the token name after construction', async () => {
        expect(await token.name.call()).to.eql(name);
    });

    it('verifies the token symbol after construction', async () => {
        expect(await token.symbol.call()).to.eql(symbol);
    });

    it('verifies the balance and supply after a deposit through the deposit function', async () => {
        const value = new BN(1000);
        await token.deposit({ value });

        const balance = await token.balanceOf.call(sender);
        expect(balance).to.be.bignumber.equal(value);

        const supply = await token.totalSupply.call();
        expect(supply).to.be.bignumber.equal(value);
    });

    it('verifies the balance and supply after a deposit through the fallback function', async () => {
        const value = new BN(122);
        await token.send(value);

        const balance = await token.balanceOf.call(sender);
        expect(balance).to.be.bignumber.equal(value);

        const supply = await token.totalSupply.call();
        expect(supply).to.be.bignumber.equal(value);
    });

    it('verifies the balance and supply after a deposit through the depositTo function', async () => {
        const value = new BN(4);
        await token.depositTo(receiver, { value });

        const balance = await token.balanceOf.call(receiver);
        expect(balance).to.be.bignumber.equal(value);

        const supply = await token.totalSupply.call();
        expect(supply).to.be.bignumber.equal(value);
    });

    it('verifies the balance and supply after a withdrawal', async () => {
        const value = new BN(100);
        await token.deposit({ value });

        const value2 = new BN(20);
        await token.withdraw(value2);

        const balance = await token.balanceOf.call(sender);
        expect(balance).to.be.bignumber.equal(value.sub(value2));

        const supply = await token.totalSupply.call();
        expect(supply).to.be.bignumber.equal(value.sub(value2));
    });

    it('verifies the ether balance after a withdrawal', async () => {
        const value = new BN(500);
        await token.deposit({ value });

        const prevBalance = await balance.current(sender);

        const value2 = new BN(200);
        const res = await token.withdraw(value2);
        const transaction = await web3.eth.getTransaction(res.tx);

        const newBalance = await balance.current(sender);
        const transactionCost = new BN(transaction.gasPrice).mul(new BN(res.receipt.cumulativeGasUsed));
        expect(newBalance).to.be.bignumber.equal(prevBalance.sub(transactionCost).add(value2));
    });

    it('verifies the ether balance after a withdrawal to target account', async () => {
        const value = new BN(800);
        await token.deposit({ value });

        const prevBalance = await balance.current(receiver);

        const value2 = new BN(56);
        await token.withdrawTo(receiver, value2);

        const newBalance = await balance.current(receiver);
        expect(newBalance).to.be.bignumber.equal(prevBalance.add(value2));
    });

    it('verifies the balances after a transfer', async () => {
        const value = new BN(300);
        await token.deposit({ value });

        const value2 = new BN(10);
        await token.transfer(receiver, value2);

        const senderBalance = await token.balanceOf.call(sender);
        expect(senderBalance).to.be.bignumber.equal(value.sub(value2));

        const receiverBalance = await token.balanceOf.call(receiver);
        expect(receiverBalance).to.be.bignumber.equal(value2);

        const supply = await token.totalSupply.call();
        expect(supply).to.be.bignumber.equal(value);
    });

    it('should revert when attempting to transfer to the token address', async () => {
        const value = new BN(500);
        await token.deposit({ value });

        await expectRevert(token.transfer(token.address, new BN(1)), 'ERR_ADDRESS_IS_SELF');
    });

    it('should revert when attempting to transferFrom to the token address', async () => {
        const value = new BN(111);
        await token.deposit({ value: value });

        const value2 = new BN(10);
        await token.approve(receiver, value2);

        await expectRevert(
            token.transferFrom(sender, token.address, new BN(1), { from: receiver }),
            'ERR_ADDRESS_IS_SELF'
        );
    });
});
