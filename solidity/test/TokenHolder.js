import { expect } from 'chai';
import { expectRevert, constants, BN } from '@openzeppelin/test-helpers';

const TokenHolder = artifacts.require('TokenHolder');
const ERC20Token = artifacts.require('ERC20Token');

contract('TokenHolder', accounts => {
    let holder;
    let erc20Token;
    const receiver = accounts[2];
    const nonOwner = accounts[8];

    beforeEach(async () => {
        holder = await TokenHolder.new();
        erc20Token = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
        await erc20Token.transfer(holder.address, 1000);
    });

    it('verifies that the owner can withdraw tokens', async () => {
        const prevBalance = await erc20Token.balanceOf.call(receiver);

        const value = new BN(100);
        await holder.withdrawTokens(erc20Token.address, receiver, value);

        const balance = await erc20Token.balanceOf.call(receiver);
        expect(balance).to.be.bignumber.equal(prevBalance.add(value));
    });

    it('should revert when a non owner attempts to withdraw tokens', async () => {
        await expectRevert(holder.withdrawTokens(erc20Token.address, receiver, new BN(1), { from: nonOwner }),
            'ERR_ACCESS_DENIED');
    });

    it('should revert when attempting to withdraw tokens from an invalid ERC20 token address', async () => {
        await expectRevert(holder.withdrawTokens(constants.ZERO_ADDRESS, receiver, new BN(1)), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
        await expectRevert(holder.withdrawTokens(erc20Token.address, constants.ZERO_ADDRESS, new BN(1)),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to withdraw tokens to the holder address', async () => {
        await expectRevert(holder.withdrawTokens(erc20Token.address, holder.address, new BN(1)), 'ERR_ADDRESS_IS_SELF');
    });

    it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
        const balance = await erc20Token.balanceOf.call(holder.address);

        await expectRevert.unspecified(holder.withdrawTokens(erc20Token.address, receiver, balance.add(new BN(1))));
    });
});
