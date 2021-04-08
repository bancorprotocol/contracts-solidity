const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { BN, balance } = require('@openzeppelin/test-helpers');

const { NATIVE_TOKEN_ADDRESS } = require('./helpers/Constants');

const SafeReserveToken = contract.fromArtifact('TestSafeReserveToken');
const TestStandardToken = contract.fromArtifact('TestStandardToken');

const TOTAL_SUPPLY = new BN(1_000_000);

describe('SafeReserveToken', () => {
    const getBalance = async (reserveToken, account) => {
        const reserveTokenAddress = reserveToken.address || reserveToken;
        const address = account.address || account;

        if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
            return balance.current(address);
        }

        if (typeof reserveToken === 'string') {
            const token = await TestStandardToken.at(reserveToken);
            return await token.balanceOf.call(address);
        }

        return reserveToken.balanceOf.call(address);
    };

    let safeReserveToken;
    let sender;

    beforeEach(async () => {
        safeReserveToken = await SafeReserveToken.new();
        sender = safeReserveToken.address;
    });

    for (const hasETH of [true, false]) {
        let reserveToken;
        const recipient = accounts[2];

        context(`${hasETH ? 'ETH' : 'ERC20'} reserve token`, () => {
            beforeEach(async () => {
                if (hasETH) {
                    reserveToken = { address: NATIVE_TOKEN_ADDRESS };

                    await safeReserveToken.send(TOTAL_SUPPLY.div(new BN(2)));
                } else {
                    reserveToken = await TestStandardToken.new('ERC', 'ERC1', 18, TOTAL_SUPPLY);

                    await reserveToken.transfer(sender, TOTAL_SUPPLY.div(new BN(2)));
                }
            });

            it('should properly check if the reserve token is a native token', async () => {
                expect(await safeReserveToken.isNativeToken.call(reserveToken.address)).to.be.eql(hasETH);
            });

            it('should properly get the right balance', async () => {
                expect(await safeReserveToken.balanceOf.call(reserveToken.address, sender)).to.be.bignumber.equal(
                    await getBalance(reserveToken, sender)
                );
            });

            for (const amount of [new BN(0), new BN(10000)]) {
                it('should properly transfer the reserve token', async () => {
                    const prevSenderBalance = await getBalance(reserveToken, sender);
                    const prevRecipientBalance = await getBalance(reserveToken, recipient);

                    await safeReserveToken.safeTransfer(reserveToken.address, recipient, amount);

                    expect(await getBalance(reserveToken, sender)).to.be.bignumber.equal(prevSenderBalance.sub(amount));
                    expect(await getBalance(reserveToken, recipient)).to.be.bignumber.equal(
                        prevRecipientBalance.add(amount)
                    );
                });
            }

            it('should properly transfer all of the reserve token', async () => {
                const prevSenderBalance = await getBalance(reserveToken, sender);
                const prevRecipientBalance = await getBalance(reserveToken, recipient);

                await safeReserveToken.safeTransferAll(reserveToken.address, recipient);

                expect(await getBalance(reserveToken, sender)).to.be.bignumber.equal(new BN(0));
                expect(await getBalance(reserveToken, recipient)).to.be.bignumber.equal(
                    prevRecipientBalance.add(prevSenderBalance)
                );
            });

            if (hasETH) {
                it('should ignore the request to transfer the reserve token on behalf of a different account', async () => {
                    const prevSenderBalance = await getBalance(reserveToken, sender);
                    const prevRecipientBalance = await getBalance(reserveToken, recipient);

                    const amount = new BN(100000);
                    await safeReserveToken.ensureAllowance(reserveToken.address, sender, amount);
                    await safeReserveToken.safeTransferFrom(reserveToken.address, sender, recipient, amount);

                    expect(await getBalance(reserveToken, sender)).to.be.bignumber.equal(prevSenderBalance);
                    expect(await getBalance(reserveToken, recipient)).to.be.bignumber.equal(prevRecipientBalance);
                });
            } else {
                for (const amount of [new BN(0), new BN(10000)]) {
                    it('should properly transfer the reserve token on behalf of a different account', async () => {
                        const prevSenderBalance = await getBalance(reserveToken, sender);
                        const prevRecipientBalance = await getBalance(reserveToken, recipient);

                        await safeReserveToken.ensureAllowance(reserveToken.address, sender, amount);
                        await safeReserveToken.safeTransferFrom(reserveToken.address, sender, recipient, amount);

                        expect(await getBalance(reserveToken, sender)).to.be.bignumber.equal(
                            prevSenderBalance.sub(amount)
                        );
                        expect(await getBalance(reserveToken, recipient)).to.be.bignumber.equal(
                            prevRecipientBalance.add(amount)
                        );
                    });

                    it('should setting the allowance', async () => {
                        const allowance = new BN(1000000);
                        const spender = accounts[5];

                        await safeReserveToken.ensureAllowance(reserveToken.address, spender, allowance);

                        expect(await reserveToken.allowance.call(sender, spender)).to.be.bignumber.equal(allowance);
                    });
                }
            }
        });
    }
});
