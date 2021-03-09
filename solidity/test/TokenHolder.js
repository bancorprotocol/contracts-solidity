const { expect } = require('chai');

const { BigNumber } = require('ethers');

const TokenHolder = ethers.getContractFactory('TokenHolder');
const TestStandardToken = ethers.getContractFactory('TestStandardToken');

let holder;
let erc20Token;

let receiver;
let nonOwner;

describe('TokenHolder', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        receiver = accounts[2];
        nonOwner = accounts[8];
    });

    beforeEach(async () => {
        holder = await (await TokenHolder).deploy();
        erc20Token = await (await TestStandardToken).deploy('ERC Token 1', 'ERC1', 18, 100000);
        await erc20Token.transfer(holder.address, 1000);
    });

    it('verifies that the owner can withdraw tokens', async () => {
        const prevBalance = await erc20Token.balanceOf(receiver.address);

        const value = BigNumber.from(100);
        await holder.withdrawTokens(erc20Token.address, receiver.address, value);

        const balance = await erc20Token.balanceOf(receiver.address);
        expect(balance).to.be.equal(prevBalance.add(value));
    });

    it('should revert when a non owner attempts to withdraw tokens', async () => {
        await expect(
            holder.connect(nonOwner).withdrawTokens(erc20Token.address, receiver.address, BigNumber.from(1))
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
    });

    it('should revert when attempting to withdraw tokens from an invalid ERC20 token address', async () => {
        await expect(
            holder.withdrawTokens(ethers.constants.AddressZero, receiver.address, BigNumber.from(1))
        ).to.be.revertedWith('ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
        await expect(
            holder.withdrawTokens(erc20Token.address, ethers.constants.AddressZero, BigNumber.from(1))
        ).to.be.revertedWith('ERR_INVALID_ADDRESS');
    });

    it('should revert when attempting to withdraw tokens to the holder address', async () => {
        await expect(holder.withdrawTokens(erc20Token.address, holder.address, BigNumber.from(1))).to.be.revertedWith(
            'ERR_ADDRESS_IS_SELF'
        );
    });

    it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
        const balance = await erc20Token.balanceOf(holder.address);

        await expect(holder.withdrawTokens(erc20Token.address, receiver.address, balance.add(BigNumber.from(1)))).to.be
            .reverted;
    });
});
