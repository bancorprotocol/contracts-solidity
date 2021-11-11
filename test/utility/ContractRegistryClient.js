const { expect } = require('chai');
const { ethers } = require('hardhat');

const { registry } = require('../helpers/Constants');

const Contracts = require('../../components/Contracts').default;

let accounts;
let owner;
let nonOwner;

let contractRegistry;
let contractRegistryClient;

describe('ContractRegistryClient', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        nonOwner = accounts[1];
    });

    beforeEach(async () => {
        contractRegistry = await Contracts.ContractRegistry.deploy();
        contractRegistryClient = await Contracts.TestContractRegistryClient.deploy(contractRegistry.address);
    });

    it('should revert when attempting to update the registry when it points to the zero address', async () => {
        await expect(contractRegistryClient.updateRegistry()).to.be.revertedWith('ERR_INVALID_REGISTRY');
    });

    it('should revert when attempting to update the registry when it points to the current registry', async () => {
        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, contractRegistry.address);

        await expect(contractRegistryClient.updateRegistry()).to.be.revertedWith('ERR_INVALID_REGISTRY');
    });

    it('should revert when attempting to update the registry when it points to a new registry which points to the zero address', async () => {
        const newRegistry = await Contracts.ContractRegistry.deploy();
        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);

        await expect(contractRegistryClient.updateRegistry()).to.be.revertedWith('ERR_INVALID_REGISTRY');
    });

    it('should allow anyone to update the registry address', async () => {
        const newRegistry = await Contracts.ContractRegistry.deploy();

        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);
        await newRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);

        await contractRegistryClient.connect(nonOwner).updateRegistry();

        expect(await contractRegistryClient.registry()).to.equal(newRegistry.address);
        expect(await contractRegistryClient.prevRegistry()).to.equal(contractRegistry.address);
    });

    it('should allow the owner to restore the previous registry and disable updates', async () => {
        const newRegistry = await Contracts.ContractRegistry.deploy();

        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);
        await newRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);
        await contractRegistryClient.connect(nonOwner).updateRegistry();

        await contractRegistryClient.connect(owner).restoreRegistry();

        expect(await contractRegistryClient.registry()).to.equal(contractRegistry.address);
        expect(await contractRegistryClient.prevRegistry()).to.equal(contractRegistry.address);

        await contractRegistryClient.connect(owner).restrictRegistryUpdate(true);
        await expect(contractRegistryClient.connect(nonOwner).updateRegistry()).to.be.revertedWith('ERR_ACCESS_DENIED');

        await contractRegistryClient.connect(owner).updateRegistry();

        expect(await contractRegistryClient.registry()).to.equal(newRegistry.address);
        expect(await contractRegistryClient.prevRegistry()).to.equal(contractRegistry.address);
    });
});
