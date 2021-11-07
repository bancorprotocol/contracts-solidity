const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { NATIVE_TOKEN_ADDRESS } = require('../helpers/Constants');

const Contracts = require('../../components/Contracts').default;

const TOTAL_SUPPLY = BigNumber.from(1_000_000);

let reserveToken;
let sender;
let accounts;

const getBalance = async (reserveToken, account) => {
    const reserveTokenAddress = reserveToken.address || reserveToken;
    const address = account.address || account;

    if (reserveTokenAddress === NATIVE_TOKEN_ADDRESS) {
        return ethers.provider.getBalance(address);
    }

    if (typeof reserveToken === 'string') {
        const token = await Contracts.TestStandardToken.attach(reserveToken);
        return await token.balanceOf(address);
    }

    return reserveToken.balanceOf(address);
};

describe('ReserveToken', () => {
    before(async () => {
        accounts = await ethers.getSigners();
    });

    beforeEach(async () => {
        reserveToken = await Contracts.TestReserveToken.deploy();
        sender = reserveToken.address;
    });

    for (const hasETH of [true, false]) {
        let token;
        let recipient;

        context(`${hasETH ? 'ETH' : 'ERC20'} reserve token`, () => {
            beforeEach(async () => {
                recipient = accounts[2];
                if (hasETH) {
                    token = { address: NATIVE_TOKEN_ADDRESS };

                    await accounts[9].sendTransaction({
                        to: reserveToken.address,
                        value: TOTAL_SUPPLY.div(BigNumber.from(2))
                    });
                } else {
                    token = await Contracts.TestStandardToken.deploy('ERC', 'ERC1', TOTAL_SUPPLY);

                    await token.transfer(sender, TOTAL_SUPPLY.div(BigNumber.from(2)));
                }
            });

            it('should properly check if the reserve token is a native token', async () => {
                expect(await reserveToken.isNativeToken(token.address)).to.equal(hasETH);
            });

            it('should properly get the right balance', async () => {
                expect(await reserveToken.balanceOf(token.address, sender)).to.equal(await getBalance(token, sender));
            });

            for (const amount of [BigNumber.from(0), BigNumber.from(10000)]) {
                it('should properly transfer the reserve token', async () => {
                    const prevSenderBalance = await getBalance(token, sender);
                    const prevRecipientBalance = await getBalance(token, recipient);

                    await reserveToken.safeTransfer(token.address, recipient.address, amount);

                    expect(await getBalance(token, sender)).to.equal(prevSenderBalance.sub(amount));
                    expect(await getBalance(token, recipient)).to.equal(prevRecipientBalance.add(amount));
                });
            }

            if (hasETH) {
                it('should ignore the request to transfer the reserve token on behalf of a different account', async () => {
                    const prevSenderBalance = await getBalance(token, sender);
                    const prevRecipientBalance = await getBalance(token, recipient);

                    const amount = BigNumber.from(100000);
                    await reserveToken.ensureApprove(token.address, sender, amount);
                    await reserveToken.safeTransferFrom(token.address, sender, recipient.address, amount);

                    expect(await getBalance(token, sender)).to.equal(prevSenderBalance);
                    expect(await getBalance(token, recipient)).to.equal(prevRecipientBalance);
                });
            } else {
                for (const amount of [BigNumber.from(0), BigNumber.from(10000)]) {
                    it('should properly transfer the reserve token on behalf of a different account', async () => {
                        const prevSenderBalance = await getBalance(token, sender);
                        const prevRecipientBalance = await getBalance(token, recipient);

                        await reserveToken.ensureApprove(token.address, sender, amount);
                        await reserveToken.safeTransferFrom(token.address, sender, recipient.address, amount);

                        expect(await getBalance(token, sender)).to.equal(prevSenderBalance.sub(amount));
                        expect(await getBalance(token, recipient)).to.equal(prevRecipientBalance.add(amount));
                    });

                    it('should setting the allowance', async () => {
                        const allowance = BigNumber.from(1000000);
                        const spender = accounts[5];

                        await reserveToken.ensureApprove(token.address, spender.address, allowance);

                        expect(await token.allowance(sender, spender.address)).to.equal(allowance);
                    });
                }
            }
        });
    }
});
