const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { expectRevert, constants, BN, balance } = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

const { NATIVE_TOKEN_ADDRESS } = require('./helpers/Constants');

const TokenHolder = contract.fromArtifact('TokenHolder');
const TestStandardToken = contract.fromArtifact('TestStandardToken');

describe('TokenHolder', () => {
    const getBalance = async (tokenAddress, account) => {
        if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
            return await balance.current(account);
        }

        return await (await TestStandardToken.at(tokenAddress)).balanceOf.call(account);
    };

    const getBalances = async (tokenAddresses, account) => {
        const balances = {};
        for (const tokenAddress of tokenAddresses) {
            balances[tokenAddress] = await getBalance(tokenAddress, account);
        }

        return balances;
    };

    let holder;
    let token;
    let token2;
    const receiver = accounts[2];
    const nonOwner = accounts[8];

    beforeEach(async () => {
        holder = await TokenHolder.new();

        token = await TestStandardToken.new('ERC', 'ERC1', 18, 100000);
        token2 = await TestStandardToken.new('ERC', 'ERC2', 18, 100000);

        await holder.send(5000);
        await token.transfer(holder.address, new BN(1000));
        await token2.transfer(holder.address, new BN(1000));
    });

    describe('withdraw asset', () => {
        for (const isETH of [true, false]) {
            context(isETH ? 'ETH' : 'ERC20', async () => {
                let tokenAddress;

                beforeEach(async () => {
                    tokenAddress = isETH ? NATIVE_TOKEN_ADDRESS : token.address;
                });

                it('should allow the owner to withdraw', async () => {
                    const prevBalance = await getBalance(tokenAddress, receiver);

                    const amount = new BN(100);
                    await holder.withdrawTokens(tokenAddress, receiver, amount);

                    const balance = await getBalance(tokenAddress, receiver);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(amount));
                });

                it('should not revert when withdrawing zero amount', async () => {
                    const prevBalance = await getBalance(tokenAddress, receiver);

                    await holder.withdrawTokens(tokenAddress, receiver, new BN(0));

                    const balance = await getBalance(tokenAddress, receiver);
                    expect(balance).to.be.bignumber.equal(prevBalance);
                });

                it('should revert when a non-owner attempts to withdraw', async () => {
                    await expectRevert(
                        holder.withdrawTokens(tokenAddress, receiver, new BN(1), { from: nonOwner }),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when attempting to withdraw from an invalid asset address', async () => {
                    await expectRevert(
                        holder.withdrawTokens(ZERO_ADDRESS, receiver, new BN(1)),
                        'Address: call to non-contract'
                    );
                });

                it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
                    await expectRevert(
                        holder.withdrawTokens(tokenAddress, ZERO_ADDRESS, new BN(1)),
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
                    const balance = await getBalance(tokenAddress, holder.address);
                    const amount = balance.add(new BN(1));

                    if (isETH) {
                        await expectRevert.unspecified(holder.withdrawTokens(tokenAddress, receiver, amount));
                    } else {
                        await expectRevert(
                            holder.withdrawTokens(tokenAddress, receiver, amount),
                            'SafeMath: subtraction overflow'
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
                amounts[tokenAddress] = new BN(100 * (i + 1));
            }
        });

        it('should allow the owner to withdraw', async () => {
            const prevBalances = await getBalances(tokenAddresses, receiver);

            await holder.withdrawTokensMultiple(tokenAddresses, receiver, Object.values(amounts));

            const newBalances = await getBalances(tokenAddresses, receiver);
            for (const [tokenAddress, prevBalance] of Object.entries(prevBalances)) {
                expect(newBalances[tokenAddress]).to.be.bignumber.equal(prevBalance.add(amounts[tokenAddress]));
            }
        });

        it('should revert when a non-owner attempts to withdraw', async () => {
            await expectRevert(
                holder.withdrawTokensMultiple(tokenAddresses, receiver, Object.values(amounts), { from: nonOwner }),
                'ERR_ACCESS_DENIED'
            );
        });

        it('should revert when attempting to withdraw from an invalid asset address', async () => {
            await expectRevert(
                holder.withdrawTokensMultiple([token.address, ZERO_ADDRESS], receiver, [new BN(1), new BN(1)]),
                'Address: call to non-contract'
            );

            await expectRevert(
                holder.withdrawTokensMultiple([ZERO_ADDRESS, token.address], receiver, [new BN(1), new BN(1)]),
                'Address: call to non-contract'
            );
        });

        it('should revert when attempting to withdraw tokens to an invalid account address', async () => {
            await expectRevert(
                holder.withdrawTokensMultiple(tokenAddresses, ZERO_ADDRESS, Object.values(amounts)),
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert when attempting to withdraw an amount greater than the holder balance', async () => {
            let balances = await getBalances(tokenAddresses, holder.address);
            balances[NATIVE_TOKEN_ADDRESS] = balances[NATIVE_TOKEN_ADDRESS].add(new BN(1));
            await expectRevert.unspecified(
                holder.withdrawTokensMultiple(tokenAddresses, receiver, Object.values(balances))
            );

            balances = await getBalances(tokenAddresses, holder.address);
            balances[token2.address] = balances[token2.address].add(new BN(1));
            await expectRevert(
                holder.withdrawTokensMultiple(tokenAddresses, receiver, Object.values(balances)),
                'SafeMath: subtraction overflow'
            );
        });
    });
});
