const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { ZERO_ADDRESS } = require('./helpers/Constants');

const Contracts = require('../components/Contracts').default;

const portion1 = BigNumber.from(111);
const portion2 = BigNumber.from(222);
const invalidPortion = BigNumber.from(1000001);

let nonOwner;
let address1;
let address2;
let accounts;

describe('NetworkSettings', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        nonOwner = accounts[1];
        address1 = accounts[2];
        address2 = accounts[3];
    });

    const expectReturn = async (method, object) => {
        expect(JSON.stringify(await method)).to.equal(JSON.stringify(object));
    };

    describe('construction', () => {
        it('should revert when creating a contract with an invalid network fee wallet', async () => {
            await expect(Contracts.NetworkSettings.deploy(ZERO_ADDRESS, portion1)).to.be.revertedWith(
                'ERR_INVALID_ADDRESS'
            );
        });

        it('should revert when creating a contract with an invalid network fee', async () => {
            await expect(Contracts.NetworkSettings.deploy(address1.address, invalidPortion)).to.be.revertedWith(
                'ERR_INVALID_FEE'
            );
        });
    });

    describe('configuration', () => {
        let networkSettings;

        beforeEach(async () => {
            networkSettings = await Contracts.NetworkSettings.deploy(address1.address, portion1);
        });

        it('should revert when setting an invalid network fee wallet', async () => {
            await expect(networkSettings.setNetworkFeeWallet(ZERO_ADDRESS)).to.be.revertedWith('ERR_INVALID_ADDRESS');
            await expectReturn(networkSettings.networkFeeParams(), [address1.address, Number(portion1)]);
        });

        it('should revert when setting an invalid network fee', async () => {
            await expect(networkSettings.setNetworkFee(invalidPortion)).to.be.revertedWith('ERR_INVALID_FEE');
            await expectReturn(networkSettings.networkFeeParams(), [address1.address, Number(portion1)]);
        });

        it('should revert when a non-owner sets a valid network fee wallet', async () => {
            await expect(networkSettings.connect(nonOwner).setNetworkFeeWallet(address2.address)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
            await expectReturn(networkSettings.networkFeeParams(), [address1.address, Number(portion1)]);
        });

        it('should revert when a non-owner sets a valid network fee', async () => {
            await expect(networkSettings.connect(nonOwner).setNetworkFee(portion2)).to.be.revertedWith(
                'ERR_ACCESS_DENIED'
            );
            await expectReturn(networkSettings.networkFeeParams(), [address1.address, Number(portion1)]);
        });

        it('should suceed when creating a contract with a valid network fee wallet and a valid network fee', async () => {
            await expectReturn(networkSettings.networkFeeParams(), [address1.address, Number(portion1)]);
        });

        it('should suceed when setting a valid network fee wallet', async () => {
            const response = await networkSettings.setNetworkFeeWallet(address2.address);
            await expectReturn(networkSettings.networkFeeParams(), [address2.address, Number(portion1)]);
            await expect(response)
                .to.emit(networkSettings, 'NetworkFeeWalletUpdated')
                .withArgs(address1.address, address2.address);
        });

        it('should suceed when setting a valid network fee', async () => {
            const response = await networkSettings.setNetworkFee(portion2);
            await expectReturn(networkSettings.networkFeeParams(), [address1.address, Number(portion2)]);
            await expect(response).to.emit(networkSettings, 'NetworkFeeUpdated').withArgs(portion1, portion2);
        });
    });
});
