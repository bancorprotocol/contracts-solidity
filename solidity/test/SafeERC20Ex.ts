import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

import Contracts from './helpers/Contracts';

const TOTAL_SUPPLY = BigNumber.from(1_000_000);

let safeERC20: any;
let token: any;

let accounts: any;
let sender: any;
let spender: any;

describe('SafeERC20Ex', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        spender = accounts[5];
    });

    beforeEach(async () => {
        safeERC20 = await Contracts.TestSafeERC20Ex.deploy();
        sender = safeERC20.address;

        token = await Contracts.TestStandardToken.deploy('ERC', 'ERC1', 18, TOTAL_SUPPLY);

        await token.transfer(safeERC20.address, TOTAL_SUPPLY.div(BigNumber.from(2)));
    });

    it('should set allowance', async () => {
        const amount = BigNumber.from(100);

        expect(await token.allowance(sender, spender.address)).to.be.equal(BigNumber.from(0));

        await safeERC20.ensureApprove(token.address, spender.address, amount);

        expect(await token.allowance(sender, spender.address)).to.be.equal(amount);
    });

    context('with existing allowance', () => {
        const allowance = BigNumber.from(1000);

        beforeEach(async () => {
            await safeERC20.ensureApprove(token.address, spender.address, allowance);
        });

        it('should ignore the request when the allowance is sufficient', async () => {
            await safeERC20.ensureApprove(token.address, spender.address, allowance.sub(BigNumber.from(10)));

            expect(await token.allowance(sender, spender.address)).to.be.equal(allowance);
        });

        it('should allow increasing the allowance', async () => {
            const newAllowance = allowance.add(BigNumber.from(100));

            await safeERC20.ensureApprove(token.address, spender.address, newAllowance);

            expect(await token.allowance(sender, spender.address)).to.be.equal(newAllowance);
        });

        it('should ignore the request when the allowance is zero', async () => {
            await safeERC20.ensureApprove(token.address, spender.address, BigNumber.from(0));

            expect(await token.allowance(sender, spender.address)).to.be.equal(allowance);
        });
    });
});
