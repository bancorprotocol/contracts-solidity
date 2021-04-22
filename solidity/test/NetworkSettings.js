const { contract, accounts } = require('@openzeppelin/test-environment');
const { BN, constants, expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const NetworkSettings = contract.fromArtifact('NetworkSettings');

describe('NetworkSettings', () => {
    const nonOwner = accounts[1];
    const address1 = accounts[2];
    const address2 = accounts[3];
    const portion1 = new BN(111);
    const portion2 = new BN(222);
    const invalidAddress = constants.ZERO_ADDRESS;
    const invalidPortion = new BN(1000001);

    const expectReturn = async (method, object) => {
        expect(JSON.stringify(await method)).to.be.equal(JSON.stringify(object));
    };

    describe('construction', () => {
        it('should revert when creating a contract with an invalid network fee wallet', async () => {
            await expectRevert(NetworkSettings.new(invalidAddress, portion1), 'ERR_INVALID_ADDRESS');
        });

        it('should revert when creating a contract with an invalid network fee', async () => {
            await expectRevert(NetworkSettings.new(address1, invalidPortion), 'ERR_INVALID_FEE');
        });
    });

    describe('configuration', () => {
        let networkSettings;

        beforeEach(async () => {
            networkSettings = await NetworkSettings.new(address1, portion1);
        });

        it('should revert when setting an invalid network fee wallet', async () => {
            await expectRevert(networkSettings.setNetworkFeeWallet(invalidAddress), 'ERR_INVALID_ADDRESS');
            await expectReturn(networkSettings.networkFeeParams(), { 0: address1, 1: portion1 });
        });

        it('should revert when setting an invalid network fee', async () => {
            await expectRevert(networkSettings.setNetworkFee(invalidPortion), 'ERR_INVALID_FEE');
            await expectReturn(networkSettings.networkFeeParams(), { 0: address1, 1: portion1 });
        });

        it('should revert when a non-owner sets a valid network fee wallet', async () => {
            await expectRevert(networkSettings.setNetworkFeeWallet(address2, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            await expectReturn(networkSettings.networkFeeParams(), { 0: address1, 1: portion1 });
        });

        it('should revert when a non-owner sets a valid network fee', async () => {
            await expectRevert(networkSettings.setNetworkFee(portion2, { from: nonOwner }), 'ERR_ACCESS_DENIED');
            await expectReturn(networkSettings.networkFeeParams(), { 0: address1, 1: portion1 });
        });

        it('should suceed when creating a contract with a valid network fee wallet and a valid network fee', async () => {
            await expectReturn(networkSettings.networkFeeParams(), { 0: address1, 1: portion1 });
        });

        it('should suceed when setting a valid network fee wallet', async () => {
            const response = await networkSettings.setNetworkFeeWallet(address2);
            await expectReturn(networkSettings.networkFeeParams(), { 0: address2, 1: portion1 });
            expectEvent(response, 'NetworkFeeWalletUpdated', {
                prevNetworkFeeWallet: address1,
                newNetworkFeeWallet: address2
            });
        });

        it('should suceed when setting a valid network fee', async () => {
            const response = await networkSettings.setNetworkFee(portion2);
            await expectReturn(networkSettings.networkFeeParams(), { 0: address1, 1: portion2 });
            expectEvent(response, 'NetworkFeeUpdated', { prevNetworkFee: portion1, newNetworkFee: portion2 });
        });
    });
});
