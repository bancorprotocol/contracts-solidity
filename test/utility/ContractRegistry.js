const { expect } = require('chai');
const { ethers } = require('hardhat');
const { BigNumber } = require('ethers');

const { registry } = require('../helpers/Constants');
const Contracts = require('../../components/Contracts').default;

const contractName1 = 'red';
const contractName2 = 'blue';
const contractName3 = 'black';
const contractName1bytes = ethers.utils.formatBytes32String(contractName1);
const contractName2bytes = ethers.utils.formatBytes32String(contractName2);
const contractName3bytes = ethers.utils.formatBytes32String(contractName3);

let contractRegistry;

let accounts;
let address1;
let address2;
let address3;
let nonOwner;

const trimNull = (str) => {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\u0000*$/, '');
};

describe('ContractRegistry', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        address1 = accounts[1];
        address2 = accounts[2];
        address3 = accounts[3];
        nonOwner = accounts[4];
    });

    beforeEach(async () => {
        contractRegistry = await Contracts.ContractRegistry.deploy();
    });

    it('verifies that a given contract address is not set after construction', async () => {
        const address = await contractRegistry.addressOf(contractName1bytes);
        expect(address).to.equal(ethers.constants.AddressZero);
    });

    it('verifies that the owner can register a contract address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);

        const address = await contractRegistry.addressOf(contractName1bytes);
        expect(address).to.equal(address1.address);
    });

    it('should revert when attempting to register the registry to the zero address', async () => {
        await expect(
            contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, ethers.constants.AddressZero)
        ).to.be.revertedWith('ERR_INVALID_ADDRESS');
    });

    it('should revert when a non owner attempts to register a contract address', async () => {
        await expect(
            contractRegistry.connect(nonOwner).registerAddress(contractName1bytes, address1.address)
        ).to.be.revertedWith('ERR_ACCESS_DENIED');
    });

    it('verifies that the contract name list gets updated correctly when registering addresses', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);
        await contractRegistry.registerAddress(contractName2bytes, address2.address);

        const itemCount = await contractRegistry.itemCount();
        expect(itemCount).to.equal(BigNumber.from(2));

        const name1 = trimNull(await contractRegistry.contractNames(0));
        expect(name1).to.equal(contractName1);

        const name2 = trimNull(await contractRegistry.contractNames(1));
        expect(name2).to.equal(contractName2);
    });

    it('verifies that the owner can unregister a contract address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);

        let address = await contractRegistry.addressOf(contractName1bytes);
        expect(address).to.equal(address1.address);

        await contractRegistry.unregisterAddress(contractName1bytes);

        address = await contractRegistry.addressOf(contractName1bytes);
        expect(address).to.equal(ethers.constants.AddressZero);
    });

    it('should revert when a non owner attempts to unregister a contract address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);

        const address = await contractRegistry.addressOf(contractName1bytes);
        expect(address).to.equal(address1.address);

        await expect(contractRegistry.connect(nonOwner).unregisterAddress(contractName1bytes)).to.be.revertedWith(
            'ERR_ACCESS_DENIED'
        );
    });

    it('verifies that the contract name list gets updated correctly when unregistering addresses', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);
        await contractRegistry.registerAddress(contractName2bytes, address2.address);
        await contractRegistry.registerAddress(contractName3bytes, address3.address);

        let itemCount = await contractRegistry.itemCount();
        expect(itemCount).to.equal(BigNumber.from(3));

        let name1 = trimNull(await contractRegistry.contractNames(0));
        expect(name1).to.equal(contractName1);

        let name2 = trimNull(await contractRegistry.contractNames(1));
        expect(name2).to.equal(contractName2);

        const name3 = trimNull(await contractRegistry.contractNames(2));
        expect(name3).to.equal(contractName3);

        await contractRegistry.unregisterAddress(contractName1bytes);

        itemCount = await contractRegistry.itemCount();
        expect(itemCount).to.equal(BigNumber.from(2));

        name1 = trimNull(await contractRegistry.contractNames(0));
        expect(name1).to.equal(contractName3);

        name2 = trimNull(await contractRegistry.contractNames(1));
        expect(name2).to.equal(contractName2);
    });

    it('verifies that a registry item can be unregistered and reregistered properly', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);
        await contractRegistry.registerAddress(contractName2bytes, address2.address);

        await contractRegistry.unregisterAddress(contractName1bytes);
        await contractRegistry.registerAddress(contractName1bytes, address3.address);

        const name2 = trimNull(await contractRegistry.contractNames(0));
        expect(name2).to.equal(contractName2);

        const name1 = trimNull(await contractRegistry.contractNames(1));
        expect(name1).to.equal(contractName1);

        const address = await contractRegistry.addressOf(contractName1bytes);
        expect(address).to.equal(address3.address);
    });

    it('should revert when unregistering non registered address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);

        await expect(contractRegistry.unregisterAddress(contractName2bytes)).to.be.revertedWith('ERR_INVALID_NAME');
    });

    it('verifies that the deprecated function getAddress works correctly', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1.address);
        await contractRegistry.registerAddress(contractName2bytes, address2.address);
        await contractRegistry.registerAddress(contractName3bytes, address3.address);

        expect(await contractRegistry.getAddress(contractName1bytes)).to.equal(
            await contractRegistry.addressOf(contractName1bytes)
        );
        expect(await contractRegistry.getAddress(contractName2bytes)).to.equal(
            await contractRegistry.addressOf(contractName2bytes)
        );
        expect(await contractRegistry.getAddress(contractName3bytes)).to.equal(
            await contractRegistry.addressOf(contractName3bytes)
        );
    });
});
