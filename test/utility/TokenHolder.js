const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS } = require('../helpers/Constants');

const Contracts = require('../../components/Contracts').default;

let holder;
let token;
let token2;
let receiver;
let nonOwner;
let accounts;

describe('TokenHolder', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        receiver = accounts[2];
        nonOwner = accounts[8];
    });

    const getBalance = async (tokenAddress, account) => {
        if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
            return ethers.provider.getBalance(account);
        }

        return await (await Contracts.TestStandardToken.attach(tokenAddress)).balanceOf(account);
    };

    const getBalances = async (tokenAddresses, account) => {
        const balances = {};
        for (const tokenAddress of tokenAddresses) {
            balances[tokenAddress] = await getBalance(tokenAddress, account);
        }

        return balances;
    };

    beforeEach(async () => {
        holder = await Contracts.TokenHolder.deploy();

        token = await Contracts.TestStandardToken.deploy('ERC', 'ERC1', 100000);
        token2 = await Contracts.TestStandardToken.deploy('ERC', 'ERC2', 100000);

        await accounts[0].sendTransaction({ to: holder.address, value: 5000 });
        await token.transfer(holder.address, BigNumber.from(1000));
        await token2.transfer(holder.address, BigNumber.from(1000));
    });

    describe('withdraw asset', () => {
        for (const isETH of [true, false]) {
            context(isETH ? 'ETH' : 'ERC20', async () => {
                let tokenAddress;

                beforeEach(async () => {
                    tokenAddress = isETH ? NATIVE_TOKEN_ADDRESS : token.address;
                });

                it('should allow the owner to withdraw', async () => {
                    const prevBalance = await getBalance(tokenAddress, receiver.address);

                    const amount = BigNumber.from(100);
                    await holder.withdrawTokens(tokenAddress, receiver.address, amount);

                    const balance = await getBalance(tokenAddress, receiver.address);
                    expect(balance).to.equal(prevBalance.add(amount));
                });

                it('should not revert when withdrawing zero amount', async () => {
                    const prevBalance = await getBalance(tokenAddress, receiver.address);

                    await holder.withdrawTokens(tokenAddress, receiver.address, BigNumber.from(0));

                    const balance = await getBalance(tokenAddress, receiver.address);
                    expect(balance).to.equal(prevBalance);
                });

                it('should revert when a non-owner attempts to withdraw', async () => {
                    await expect(
                        holder.connect(nonOwner).withdrawTokens(tokenAddress, receiver.address, BigNumber.from(1))
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to withdraw from an invalid asset address', async () => {
                    await expect(
                        holder.withdrawTokens(ZERO_ADDRESS, receiver.address, BigNumber.from(1))
                    ).to.be.revertedWith('Address: call to non-contract');
                });

                it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
                    await expect(
                        holder.withdrawTokens(tokenAddress, ZERO_ADDRESS, BigNumber.from(1))
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
                    const balance = await getBalance(tokenAddress, holder.address);
                    const amount = balance.add(BigNumber.from(1));

                    if (isETH) {
                        await expect(holder.withdrawTokens(tokenAddress, receiver.address, amount)).to.be.reverted;
                    } else {
                        await expect(holder.withdrawTokens(tokenAddress, receiver.address, amount)).to.be.revertedWith(
                            'ERC20: transfer amount exceeds balance'
                        );
                    }
                });
            });
        }
    });

    describe('withdraw multiple assets', () => {
        let tokenAddresses;
        let amounts;

        beforeEach(async () => {
            tokenAddresses = [NATIVE_TOKEN_ADDRESS, token.address, token2.address];
            amounts = {};

            for (let i = 0; i < tokenAddresses.length; ++i) {
                const tokenAddress = tokenAddresses[i];
                amounts[tokenAddress] = BigNumber.from(100 * (i + 1));
            }
        });

        it('should allow the owner to withdraw', async () => {
            const prevBalances = await getBalances(tokenAddresses, receiver.address);

            await holder.withdrawTokensMultiple(tokenAddresses, receiver.address, Object.values(amounts));

            const newBalances = await getBalances(tokenAddresses, receiver.address);
            for (const [tokenAddress, prevBalance] of Object.entries(prevBalances)) {
                expect(newBalances[tokenAddress]).to.equal(prevBalance.add(amounts[tokenAddress]));
            }
        });

        it('should revert when a non-owner attempts to withdraw', async () => {
            await expect(
                holder
                    .connect(nonOwner)
                    .withdrawTokensMultiple(tokenAddresses, receiver.address, Object.values(amounts))
            ).to.be.revertedWith('ERR_ACCESS_DENIED');
        });

        it('should revert when attempting to withdraw from an invalid asset address', async () => {
            await expect(
                holder.withdrawTokensMultiple([token.address, ZERO_ADDRESS], receiver.address, [
                    BigNumber.from(1),
                    BigNumber.from(1)
                ])
            ).to.be.revertedWith('Address: call to non-contract');

            await expect(
                holder.withdrawTokensMultiple([ZERO_ADDRESS, token.address], receiver.address, [
                    BigNumber.from(1),
                    BigNumber.from(1)
                ])
            ).to.be.revertedWith('Address: call to non-contract');
        });

        it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
            await expect(
                holder.withdrawTokensMultiple(tokenAddresses, ZERO_ADDRESS, Object.values(amounts))
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
            let balances = await getBalances(tokenAddresses, holder.address);
            balances[NATIVE_TOKEN_ADDRESS] = balances[NATIVE_TOKEN_ADDRESS].add(BigNumber.from(1));
            await expect(holder.withdrawTokensMultiple(tokenAddresses, receiver.address, Object.values(balances))).to.be
                .reverted;

            balances = await getBalances(tokenAddresses, holder.address);
            balances[token2.address] = balances[token2.address].add(BigNumber.from(1));
            await expect(
                holder.withdrawTokensMultiple(tokenAddresses, receiver.address, Object.values(balances))
            ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        });
    });
});
