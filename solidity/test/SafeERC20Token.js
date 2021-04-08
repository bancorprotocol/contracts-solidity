const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { BN } = require('@openzeppelin/test-helpers');

const SafeERC20Token = contract.fromArtifact('TestSafeERC20Token');
const TestStandardToken = contract.fromArtifact('TestStandardToken');

const TOTAL_SUPPLY = new BN(1_000_000);

describe('SafeERC20Token', () => {
    let safeERC20;
    let token;

    let sender;
    const recipient = accounts[2];

    beforeEach(async () => {
        safeERC20 = await SafeERC20Token.new();
        sender = safeERC20.address;

        token = await TestStandardToken.new('ERC', 'ERC1', 18, TOTAL_SUPPLY);

        await token.transfer(safeERC20.address, TOTAL_SUPPLY.div(new BN(2)));
    });

    describe('delegated operations', () => {
        it('should allow transferring a token', async () => {
            const prevSenderBalance = await token.balanceOf.call(sender);
            const prevRecipientBalance = await token.balanceOf.call(recipient);

            const amount = new BN(1);
            await safeERC20.safeTransfer(token.address, recipient, amount);

            expect(await token.balanceOf.call(sender)).to.be.bignumber.equal(prevSenderBalance.sub(amount));
            expect(await token.balanceOf.call(recipient)).to.be.bignumber.equal(prevRecipientBalance.add(amount));
        });

        it('should allow transferring a token on behalf of a different account', async () => {
            const prevSenderBalance = await token.balanceOf.call(sender);
            const prevRecipientBalance = await token.balanceOf.call(recipient);

            const amount = new BN(100);
            await safeERC20.safeApprove(token.address, sender, amount);
            await safeERC20.safeTransferFrom(token.address, sender, recipient, amount);

            expect(await token.balanceOf.call(sender)).to.be.bignumber.equal(prevSenderBalance.sub(amount));
            expect(await token.balanceOf.call(recipient)).to.be.bignumber.equal(prevRecipientBalance.add(amount));
        });
    });

    describe('ensure allowance', () => {
        const spender = accounts[5];

        it('should set allowance', async () => {
            const amount = new BN(100);

            expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(new BN(0));

            await safeERC20.ensureAllowance(token.address, spender, amount);

            expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(amount);
        });

        context('with existing allowance', () => {
            const allowance = new BN(1000);

            beforeEach(async () => {
                await safeERC20.ensureAllowance(token.address, spender, allowance);
            });

            it('should ignore the request when the allowance is sufficient', async () => {
                await safeERC20.ensureAllowance(token.address, spender, allowance.sub(new BN(10)));

                expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(allowance);
            });

            it('should allow increasing the allowance', async () => {
                const newAllowance = allowance.add(new BN(100));

                await safeERC20.ensureAllowance(token.address, spender, newAllowance);

                expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(newAllowance);
            });

            it('should ignore the request when the allowance is zero', async () => {
                await safeERC20.ensureAllowance(token.address, spender, new BN(0));

                expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(allowance);
            });
        });
    });
});
