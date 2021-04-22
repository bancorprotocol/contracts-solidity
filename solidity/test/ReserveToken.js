const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { BN, balance } = require('@openzeppelin/test-helpers');

const { NATIVE_TOKEN_ADDRESS } = require('./helpers/Constants');

const ReserveToken = contract.fromArtifact('TestReserveToken');
const TestStandardToken = contract.fromArtifact('TestStandardToken');

const TOTAL_SUPPLY = new BN(1_000_000);

describe('ReserveToken', () => {
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

    let reserveToken;
    let sender;

    beforeEach(async () => {
        reserveToken = await ReserveToken.new();
        sender = reserveToken.address;
    });

    for (const hasETH of [true, false]) {
        let token;
        const recipient = accounts[2];

        context(`${hasETH ? 'ETH' : 'ERC20'} reserve token`, () => {
            beforeEach(async () => {
                if (hasETH) {
                    token = { address: NATIVE_TOKEN_ADDRESS };

                    await reserveToken.send(TOTAL_SUPPLY.div(new BN(2)));
                } else {
                    token = await TestStandardToken.new('ERC', 'ERC1', 18, TOTAL_SUPPLY);

                    await token.transfer(sender, TOTAL_SUPPLY.div(new BN(2)));
                }
            });

            it('should properly check if the reserve token is a native token', async () => {
                expect(await reserveToken.isNativeToken.call(token.address)).to.be.eql(hasETH);
            });

            it('should properly get the right balance', async () => {
                expect(await reserveToken.balanceOf.call(token.address, sender)).to.be.bignumber.equal(
                    await getBalance(token, sender)
                );
            });

            for (const amount of [new BN(0), new BN(10000)]) {
                it('should properly transfer the reserve token', async () => {
                    const prevSenderBalance = await getBalance(token, sender);
                    const prevRecipientBalance = await getBalance(token, recipient);

                    await reserveToken.safeTransfer(token.address, recipient, amount);

                    expect(await getBalance(token, sender)).to.be.bignumber.equal(prevSenderBalance.sub(amount));
                    expect(await getBalance(token, recipient)).to.be.bignumber.equal(prevRecipientBalance.add(amount));
                });
            }

            if (hasETH) {
                it('should ignore the request to transfer the reserve token on behalf of a different account', async () => {
                    const prevSenderBalance = await getBalance(token, sender);
                    const prevRecipientBalance = await getBalance(token, recipient);

                    const amount = new BN(100000);
                    await reserveToken.ensureApprove(token.address, sender, amount);
                    await reserveToken.safeTransferFrom(token.address, sender, recipient, amount);

                    expect(await getBalance(token, sender)).to.be.bignumber.equal(prevSenderBalance);
                    expect(await getBalance(token, recipient)).to.be.bignumber.equal(prevRecipientBalance);
                });
            } else {
                for (const amount of [new BN(0), new BN(10000)]) {
                    it('should properly transfer the reserve token on behalf of a different account', async () => {
                        const prevSenderBalance = await getBalance(token, sender);
                        const prevRecipientBalance = await getBalance(token, recipient);

                        await reserveToken.ensureApprove(token.address, sender, amount);
                        await reserveToken.safeTransferFrom(token.address, sender, recipient, amount);

                        expect(await getBalance(token, sender)).to.be.bignumber.equal(prevSenderBalance.sub(amount));
                        expect(await getBalance(token, recipient)).to.be.bignumber.equal(
                            prevRecipientBalance.add(amount)
                        );
                    });

                    it('should setting the allowance', async () => {
                        const allowance = new BN(1000000);
                        const spender = accounts[5];

                        await reserveToken.ensureApprove(token.address, spender, allowance);

                        expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(allowance);
                    });
                }
            }
        });
    }
});
