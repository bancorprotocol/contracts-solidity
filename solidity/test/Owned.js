import { expect } from 'chai';
import { constants } from '@openzeppelin/test-helpers';
import { expectRevert, expectEvent } from '@openzeppelin/test-helpers';

const Owned = artifacts.require('Owned');

contract('Owned', accounts => {
    let contract;
    const owner = accounts[0];
    const newOwner = accounts[1];

    beforeEach(async () => {
        contract = await Owned.new();
    });

    it('verifies the owner after construction', async () => {
        expect(await contract.owner.call()).to.be.eql(accounts[0]);
    });

    it('verifies the new owner after ownership transfer', async () => {
        await contract.transferOwnership(newOwner);
        await contract.acceptOwnership({ from: newOwner });

        expect(await contract.owner.call()).to.be.eql(newOwner);
    });

    it('verifies that ownership transfer fires an OwnerUpdate event', async () => {
        await contract.transferOwnership(newOwner);
        const res = await contract.acceptOwnership({ from: newOwner });
        expectEvent(res, 'OwnerUpdate', { _prevOwner: owner, _newOwner: newOwner });
    });

    it('verifies that newOwner is cleared after ownership transfer', async () => {
        await contract.transferOwnership(newOwner);
        await contract.acceptOwnership({ from: newOwner });

        expect(await contract.newOwner.call()).to.be.eql(constants.ZERO_ADDRESS);
    });

    it('verifies that no ownership transfer takes places before the new owner accepted it', async () => {
        await contract.transferOwnership(newOwner);

        expect(await contract.owner.call()).to.be.eql(owner);
    });

    it('verifies that only the owner can initiate ownership transfer', async () => {
        const nonOwner = accounts[2];

        await expectRevert(contract.transferOwnership(newOwner, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that the owner can cancel ownership transfer before the new owner accepted it', async () => {
        await contract.transferOwnership(newOwner);
        await contract.transferOwnership(constants.ZERO_ADDRESS);

        expect(await contract.newOwner.call()).to.be.eql(constants.ZERO_ADDRESS);
    });
});
