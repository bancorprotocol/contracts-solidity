const { accounts, contract } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { BN } = require('@openzeppelin/test-helpers');

const SafeERC20Ex = contract.fromArtifact('TestSafeERC20Ex');
const TestStandardToken = contract.fromArtifact('TestStandardToken');

const TOTAL_SUPPLY = new BN(1_000_000);

describe('SafeERC20Ex', () => {
    let safeERC20;
    let token;

    let sender;
    const spender = accounts[5];

    beforeEach(async () => {
        safeERC20 = await SafeERC20Ex.new();
        sender = safeERC20.address;

        token = await TestStandardToken.new('ERC', 'ERC1', 18, TOTAL_SUPPLY);

        await token.transfer(safeERC20.address, TOTAL_SUPPLY.div(new BN(2)));
    });

    it('should set allowance', async () => {
        const amount = new BN(100);

        expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(new BN(0));

        await safeERC20.ensureApprove(token.address, spender, amount);

        expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(amount);
    });

    context('with existing allowance', () => {
        const allowance = new BN(1000);

        beforeEach(async () => {
            await safeERC20.ensureApprove(token.address, spender, allowance);
        });

        it('should ignore the request when the allowance is sufficient', async () => {
            await safeERC20.ensureApprove(token.address, spender, allowance.sub(new BN(10)));

            expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(allowance);
        });

        it('should allow increasing the allowance', async () => {
            const newAllowance = allowance.add(new BN(100));

            await safeERC20.ensureApprove(token.address, spender, newAllowance);

            expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(newAllowance);
        });

        it('should ignore the request when the allowance is zero', async () => {
            await safeERC20.ensureApprove(token.address, spender, new BN(0));

            expect(await token.allowance.call(sender, spender)).to.be.bignumber.equal(allowance);
        });
    });
});
