/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const ContractRegistry = artifacts.require('ContractRegistry.sol');
const utils = require('./helpers/Utils');

let contractName = 'TestContract';

contract('ContractRegistry', accounts => {
    it('verifies that a given contract address is not set after construction', async () => {
        let contractRegistry = await ContractRegistry.new();
        let address = await contractRegistry.getAddress.call(contractName);
        assert.equal(address, utils.zeroAddress);
    });

    it('verifies that the owner can register a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName, accounts[1]);
        let address = await contractRegistry.getAddress.call(contractName);
        assert.equal(address, accounts[1]);
    });

    it('should throw when a non owner attempts to register a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();

        try {
            await contractRegistry.registerAddress(contractName, accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can unregister a contract address', async () => {
        let contractRegistry = await ContractRegistry.new();
        await contractRegistry.registerAddress(contractName, accounts[1]);
        let address = await contractRegistry.getAddress.call(contractName);
        assert.equal(address, accounts[1]);

        await contractRegistry.registerAddress(contractName, utils.zeroAddress);
        address = await contractRegistry.getAddress.call(contractName);
        assert.equal(address, utils.zeroAddress);
    });
});
