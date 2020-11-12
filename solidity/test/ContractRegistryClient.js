const { expect } = require('chai');
const { expectRevert } = require('@openzeppelin/test-helpers');

const { registry } = require('./helpers/Constants');

const ContractRegistry = artifacts.require('ContractRegistry');
const ContractRegistryClient = artifacts.require('TestContractRegistryClient');

contract('ContractRegistryClient', (accounts) => {
    let contractRegistry;
    let contractRegistryClient;
    const owner = accounts[0];
    const nonOwner = accounts[1];

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();
        contractRegistryClient = await ContractRegistryClient.new(contractRegistry.address);
    });

    it('should revert when attempting to update the registry when it points to the zero address', async () => {
        await expectRevert(contractRegistryClient.updateRegistry(), 'ERR_INVALID_REGISTRY');
    });

    it('should revert when attempting to update the registry when it points to the current registry', async () => {
        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, contractRegistry.address);

        await expectRevert(contractRegistryClient.updateRegistry(), 'ERR_INVALID_REGISTRY');
    });

    it('should revert when attempting to update the registry when it points to a new registry which points to the zero address', async () => {
        const newRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);

        await expectRevert(contractRegistryClient.updateRegistry(), 'ERR_INVALID_REGISTRY');
    });

    it('should allow anyone to update the registry address', async () => {
        const newRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);
        await newRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);

        await contractRegistryClient.updateRegistry({ from: nonOwner });

        expect(await contractRegistryClient.registry.call()).to.eql(newRegistry.address);
        expect(await contractRegistryClient.prevRegistry.call()).to.eql(contractRegistry.address);
    });

    it('should allow the owner to restore the previous registry and disable updates', async () => {
        const newRegistry = await ContractRegistry.new();

        await contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);
        await newRegistry.registerAddress(registry.CONTRACT_REGISTRY, newRegistry.address);
        await contractRegistryClient.updateRegistry({ from: nonOwner });

        await contractRegistryClient.restoreRegistry({ from: owner });

        expect(await contractRegistryClient.registry.call()).to.eql(contractRegistry.address);
        expect(await contractRegistryClient.prevRegistry.call()).to.eql(contractRegistry.address);

        await contractRegistryClient.restrictRegistryUpdate(true, { from: owner });
        await expectRevert(contractRegistryClient.updateRegistry({ from: nonOwner }), 'ERR_ACCESS_DENIED');

        await contractRegistryClient.updateRegistry({ from: owner });

        expect(await contractRegistryClient.registry.call()).to.eql(newRegistry.address);
        expect(await contractRegistryClient.prevRegistry.call()).to.eql(contractRegistry.address);
    });
});
