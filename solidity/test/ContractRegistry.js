const { expect } = require('chai');
const { expectRevert, constants, BN } = require('@openzeppelin/test-helpers');

const { registry } = require('./helpers/Constants');

const { ZERO_ADDRESS } = constants;

const ContractRegistry = artifacts.require('ContractRegistry');

const trimNull = (str) => {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\u0000*$/, '');
};

contract('ContractRegistry', accounts => {
    let contractRegistry;
    const contractName1 = 'red';
    const contractName2 = 'blue';
    const contractName3 = 'black';
    const contractName1bytes = web3.utils.asciiToHex(contractName1);
    const contractName2bytes = web3.utils.asciiToHex(contractName2);
    const contractName3bytes = web3.utils.asciiToHex(contractName3);
    const address1 = accounts[1];
    const address2 = accounts[2];
    const address3 = accounts[3];
    const nonOwner = accounts[4];

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();
    });

    it('verifies that a given contract address is not set after construction', async () => {
        const address = await contractRegistry.addressOf.call(contractName1bytes);
        expect(address).to.eql(ZERO_ADDRESS);
    });

    it('verifies that the owner can register a contract address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);

        const address = await contractRegistry.addressOf.call(contractName1bytes);
        expect(address).to.eql(address1);
    });

    it('should revert when attempting to register the registry to the zero address', async () => {
        await expectRevert(contractRegistry.registerAddress(registry.CONTRACT_REGISTRY, ZERO_ADDRESS),
            'ERR_INVALID_ADDRESS');
    });

    it('should revert when a non owner attempts to register a contract address', async () => {
        await expectRevert(contractRegistry.registerAddress(contractName1bytes, address1, { from: nonOwner }),
            'ERR_ACCESS_DENIED');
    });

    it('verifies that the contract name list gets updated correctly when registering addresses', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);
        await contractRegistry.registerAddress(contractName2bytes, address2);

        const itemCount = await contractRegistry.itemCount.call();
        expect(itemCount).to.be.bignumber.equal(new BN(2));

        const name1 = trimNull(await contractRegistry.contractNames.call(0));
        expect(name1).to.eql(contractName1);

        const name2 = trimNull(await contractRegistry.contractNames.call(1));
        expect(name2).to.eql(contractName2);
    });

    it('verifies that the owner can unregister a contract address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);

        let address = await contractRegistry.addressOf.call(contractName1bytes);
        expect(address).to.eql(address1);

        await contractRegistry.unregisterAddress(contractName1bytes);

        address = await contractRegistry.addressOf.call(contractName1bytes);
        expect(address).to.eql(ZERO_ADDRESS);
    });

    it('should revert when a non owner attempts to unregister a contract address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);

        const address = await contractRegistry.addressOf.call(contractName1bytes);
        expect(address).to.eql(address1);

        await expectRevert(contractRegistry.unregisterAddress(contractName1bytes, { from: nonOwner }), 'ERR_ACCESS_DENIED');
    });

    it('verifies that the contract name list gets updated correctly when unregistering addresses', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);
        await contractRegistry.registerAddress(contractName2bytes, address2);
        await contractRegistry.registerAddress(contractName3bytes, address3);

        let itemCount = await contractRegistry.itemCount.call();
        expect(itemCount).to.be.bignumber.equal(new BN(3));

        let name1 = trimNull(await contractRegistry.contractNames.call(0));
        expect(name1).to.eql(contractName1);

        let name2 = trimNull(await contractRegistry.contractNames.call(1));
        expect(name2).to.eql(contractName2);

        const name3 = trimNull(await contractRegistry.contractNames.call(2));
        expect(name3).to.eql(contractName3);

        await contractRegistry.unregisterAddress(contractName1bytes);

        itemCount = await contractRegistry.itemCount.call();
        expect(itemCount).to.be.bignumber.equal(new BN(2));

        name1 = trimNull(await contractRegistry.contractNames.call(0));
        expect(name1).to.eql(contractName3);

        name2 = trimNull(await contractRegistry.contractNames.call(1));
        expect(name2).to.eql(contractName2);
    });

    it('verifies that a registry item can be unregistered and reregistered properly', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);
        await contractRegistry.registerAddress(contractName2bytes, address2);

        await contractRegistry.unregisterAddress(contractName1bytes);
        await contractRegistry.registerAddress(contractName1bytes, address3);

        const name2 = trimNull(await contractRegistry.contractNames.call(0));
        expect(name2).to.eql(contractName2);

        const name1 = trimNull(await contractRegistry.contractNames.call(1));
        expect(name1).to.eql(contractName1);

        const address = await contractRegistry.addressOf.call(contractName1bytes);
        expect(address).to.eql(address3);
    });

    it('should revert when unregistering non registered address', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);

        await expectRevert(contractRegistry.unregisterAddress(contractName2bytes), 'ERR_INVALID_NAME');
    });

    it('verifies that the deprecated function getAddress works correctly', async () => {
        await contractRegistry.registerAddress(contractName1bytes, address1);
        await contractRegistry.registerAddress(contractName2bytes, address2);
        await contractRegistry.registerAddress(contractName3bytes, address3);

        expect(await contractRegistry.getAddress.call(contractName1bytes)).to
            .eql(await contractRegistry.addressOf.call(contractName1bytes));
        expect(await contractRegistry.getAddress.call(contractName2bytes)).to
            .eql(await contractRegistry.addressOf.call(contractName2bytes));
        expect(await contractRegistry.getAddress.call(contractName3bytes)).to
            .eql(await contractRegistry.addressOf.call(contractName3bytes));
    });
});
