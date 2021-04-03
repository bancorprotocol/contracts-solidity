import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import Constants from './helpers/Constants';
import Contracts from './helpers/Contracts';
import Utils from './helpers/Utils';

let holder: any;
let token: any;
let token2: any;
let receiver: any;
let nonOwner: any;
let accounts: any;

describe('TokenHolder', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        receiver = accounts[2];
        nonOwner = accounts[8];
    });

    const getBalances = async (tokenAddresses: any, account: any): Promise<any> => {
        const balances: any = {};
        for (const tokenAddress of tokenAddresses) {
            balances[tokenAddress] = await Utils.getBalance(tokenAddress, account);
        }

        return balances;
    };

    beforeEach(async () => {
        holder = await Contracts.TokenHolder.deploy();

        token = await Contracts.TestStandardToken.deploy('ERC', 'ERC1', 18, 100000);
        token2 = await Contracts.TestStandardToken.deploy('ERC', 'ERC2', 18, 100000);

        await accounts[0].sendTransaction({ to: holder.address, value: 5000 });
        await token.transfer(holder.address, BigNumber.from(1000));
        await token2.transfer(holder.address, BigNumber.from(1000));
    });

    describe('withdraw asset', () => {
        for (const isETH of [true, false]) {
            context(isETH ? 'ETH' : 'ERC20', async () => {
                let tokenAddress: any;

                beforeEach(async () => {
                    tokenAddress = isETH ? Constants.NATIVE_TOKEN_ADDRESS : token.address;
                });

                it('should allow the owner to withdraw', async () => {
                    const prevBalance = await Utils.getBalance(tokenAddress, receiver.address);

                    const amount = BigNumber.from(100);
                    await holder.withdrawTokens(tokenAddress, receiver.address, amount);

                    const balance = await Utils.getBalance(tokenAddress, receiver.address);
                    expect(balance).to.be.equal(prevBalance.add(amount));
                });

                it('should not revert when withdrawing zero amount', async () => {
                    const prevBalance = await Utils.getBalance(tokenAddress, receiver.address);

                    await holder.withdrawTokens(tokenAddress, receiver.address, BigNumber.from(0));

                    const balance = await Utils.getBalance(tokenAddress, receiver.address);
                    expect(balance).to.be.equal(prevBalance);
                });

                it('should revert when a non-owner attempts to withdraw', async () => {
                    await expect(
                        holder.connect(nonOwner).withdrawTokens(tokenAddress, receiver.address, BigNumber.from(1))
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to withdraw from an invalid asset address', async () => {
                    await expect(
                        holder.withdrawTokens(Constants.ZERO_ADDRESS, receiver.address, BigNumber.from(1))
                    ).to.be.revertedWith('Address: call to non-contract');
                });

                it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
                    await expect(
                        holder.withdrawTokens(tokenAddress, Constants.ZERO_ADDRESS, BigNumber.from(1))
                    ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
                    const balance = await Utils.getBalance(tokenAddress, holder.address);
                    const amount = balance.add(BigNumber.from(1));

                    if (isETH) {
                        await expect(holder.withdrawTokens(tokenAddress, receiver.address, amount)).to.be.reverted;
                    } else {
                        await expect(holder.withdrawTokens(tokenAddress, receiver.address, amount)).to.be.revertedWith(
                            'SafeMath: subtraction overflow'
                        );
                    }
                });
            });
        }
    });

    describe('withdraw multiple assets', () => {
        let tokenAddresses: any;
        let amounts: any;

        beforeEach(async () => {
            tokenAddresses = [Constants.NATIVE_TOKEN_ADDRESS, token.address, token2.address];
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
                expect(newBalances[tokenAddress]).to.be.equal((prevBalance as any).add(amounts[tokenAddress]));
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
                holder.withdrawTokensMultiple([token.address, Constants.ZERO_ADDRESS], receiver.address, [
                    BigNumber.from(1),
                    BigNumber.from(1)
                ])
            ).to.be.revertedWith('Address: call to non-contract');

            await expect(
                holder.withdrawTokensMultiple([Constants.ZERO_ADDRESS, token.address], receiver.address, [
                    BigNumber.from(1),
                    BigNumber.from(1)
                ])
            ).to.be.revertedWith('Address: call to non-contract');
        });

        it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
            await expect(
                holder.withdrawTokensMultiple(tokenAddresses, Constants.ZERO_ADDRESS, Object.values(amounts))
            ).to.be.revertedWith('ERR_INVALID_ADDRESS');
        });

        it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
            let balances = await getBalances(tokenAddresses, holder.address);
            balances[Constants.NATIVE_TOKEN_ADDRESS] = balances[Constants.NATIVE_TOKEN_ADDRESS].add(BigNumber.from(1));
            await expect(holder.withdrawTokensMultiple(tokenAddresses, receiver.address, Object.values(balances))).to.be
                .reverted;

            balances = await getBalances(tokenAddresses, holder.address);
            balances[token2.address] = balances[token2.address].add(BigNumber.from(1));
            await expect(
                holder.withdrawTokensMultiple(tokenAddresses, receiver.address, Object.values(balances))
            ).to.be.revertedWith('SafeMath: subtraction overflow');
        });
    });
});
