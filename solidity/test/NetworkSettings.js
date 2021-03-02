const { contract, accounts } = require('@openzeppelin/test-environment');
const { BN, constants, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const NetworkSettings = contract.fromArtifact('NetworkSettings');

const PPM_RESOLUTION = new BN(1000000);

describe('NetworkSettings', () => {
    let networkSettings;

    const owner = accounts[1];
    const nonOwner = accounts[2];

    const validFeeWallet1 = accounts[3];
    const validFeeWallet2 = accounts[4];

    const validFeePortion1 = new BN(111);
    const validFeePortion2 = new BN(222);

    const invalidFeeWallet = constants.ZERO_ADDRESS;
    const tooSmallFeePortion = new BN(0);
    const tooLargeFeePortion = PPM_RESOLUTION.addn(1);

    const expectReturn = async (method, object) => {
        expect(JSON.stringify(await method)).to.be.equal(JSON.stringify(object));
    };

    it('should revert when creating a contract with an invalid fee wallet', async () => {
        await expectRevert(NetworkSettings.new(invalidFeeWallet, validFeePortion1), 'ERR_INVALID_ADDRESS');
    });

    it('should revert when creating a contract with a too-small fee portion', async () => {
        await expectRevert(NetworkSettings.new(validFeeWallet1, tooSmallFeePortion), 'ERR_INVALID_PORTION');
    });

    it('should revert when creating a contract with a too-large fee portion', async () => {
        await expectRevert(NetworkSettings.new(validFeeWallet1, tooLargeFeePortion), 'ERR_INVALID_PORTION');
    });

    it('should revert when setting an invalid fee wallet', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion1);
        await expectRevert(networkSettings.setFeeWallet(invalidFeeWallet), 'ERR_INVALID_ADDRESS');
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion1});
    });

    it('should revert when setting a too-small fee portion', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion1);
        await expectRevert(networkSettings.setFeePortion(tooSmallFeePortion), 'ERR_INVALID_PORTION');
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion1});
    });

    it('should revert when setting a too-large fee portion', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion1);
        await expectRevert(networkSettings.setFeePortion(tooLargeFeePortion), 'ERR_INVALID_PORTION');
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion1});
    });

    it('should revert when a non-owner sets a valid fee wallet', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion1);
        await expectRevert(networkSettings.setFeeWallet(validFeeWallet2, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion1});
    });

    it('should revert when a non-owner sets a valid fee portion', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion2);
        await expectRevert(networkSettings.setFeePortion(validFeePortion1, { from: nonOwner }), 'ERR_ACCESS_DENIED');
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion2});
    });

    it('should suceed when creating a contract with a valid fee wallet and a valid fee portion', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion1);
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion1});
    });

    it('should suceed when setting a valid fee wallet', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion1);
        await networkSettings.setFeeWallet(validFeeWallet2);
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet2, 1: validFeePortion1});
    });

    it('should suceed when setting a valid fee portion', async () => {
        let networkSettings = await NetworkSettings.new(validFeeWallet1, validFeePortion2);
        await networkSettings.setFeePortion(validFeePortion2);
        await expectReturn(networkSettings.feeParams(), {0: validFeeWallet1, 1: validFeePortion2});
    });
});
