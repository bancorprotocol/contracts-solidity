/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const ContractRegistry = artifacts.require('ContractRegistry.sol');
const utils = require('./helpers/Utils');

let contractName1 = 'red';
let contractName2 = 'blue';
let contractName3 = 'black';

contract('ContractRegistry', accounts => {
    it('verifies that a given contract address is not set after construction', async () => {
        let contractRegistry = await ContractRegistry.new();
        let address = await contractRegistry.addressOf.call(contractName1);
        assert.equal(address, utils.zeroAddress);
    });

    it('verifies that the owner can register a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName1, accounts[1]);
        let address = await contractRegistry.addressOf.call(contractName1);
        assert.equal(address, accounts[1]);
    });

    it('should throw when a non owner attempts to register a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();

        try {
            await contractRegistry.registerAddress(contractName1, accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the contract name list gets updated correctly when registering addresses', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName1, accounts[1]);
        await contractRegistry.registerAddress(contractName2, accounts[2]);

        let itemCount = await contractRegistry.itemCount.call();
        assert.equal(itemCount, 2);
        let name = await contractRegistry.contractNames.call(0);
        assert.equal(name, contractName1);
        name = await contractRegistry.contractNames.call(1);
        assert.equal(name, contractName2);
    });

    it('verifies that the owner can unregister a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName1, accounts[1]);
        let address = await contractRegistry.addressOf.call(contractName1);
        assert.equal(address, accounts[1]);

        await contractRegistry.unregisterAddress(contractName1);
        address = await contractRegistry.addressOf.call(contractName1);
        assert.equal(address, utils.zeroAddress);
    });

    it('should throw when a non owner attempts to unregister a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName1, accounts[1]);
        let address = await contractRegistry.addressOf.call(contractName1);
        assert.equal(address, accounts[1]);

        try {
            await contractRegistry.unregisterAddress(contractName1, { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the contract name list gets updated correctly when unregistering addresses', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName1, accounts[1]);
        await contractRegistry.registerAddress(contractName2, accounts[2]);
        await contractRegistry.registerAddress(contractName3, accounts[3]);
        
        let itemCount = await contractRegistry.itemCount.call();
        assert.equal(itemCount, 3);
        let name = await contractRegistry.contractNames.call(0);
        assert.equal(name, contractName1);
        name = await contractRegistry.contractNames.call(1);
        assert.equal(name, contractName2);
        name = await contractRegistry.contractNames.call(2);
        assert.equal(name, contractName3);

        await contractRegistry.unregisterAddress(contractName1);
        itemCount = await contractRegistry.itemCount.call();
        assert.equal(itemCount, 2);
        name = await contractRegistry.contractNames.call(0);
        assert.equal(name, contractName3);
        name = await contractRegistry.contractNames.call(1);
        assert.equal(name, contractName2);
    });
});
