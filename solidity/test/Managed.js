/* global artifacts, contract, it, assert */
/* eslint-disable prefer-reflect */

const Managed = artifacts.require('Managed.sol');
const utils = require('./helpers/Utils');

contract('Managed', (accounts) => {
    it('verifies the manager after construction', async () => {
        let contract = await Managed.new();
        let manager = await contract.manager.call();
        assert.equal(manager, accounts[0]);
    });

    it('verifies the new manager after management transfer', async () => {
        let contract = await Managed.new();
        await contract.transferManagement(accounts[1]);
        await contract.acceptManagement({ from: accounts[1] });
        let manager = await contract.manager.call();
        assert.equal(manager, accounts[1]);
    });

    it('verifies that management transfer fires an ManagerUpdate event', async () => {
        let contract = await Managed.new();
        await contract.transferManagement(accounts[1]);
        let res = await contract.acceptManagement({ from: accounts[1] });
        assert(res.logs.length > 0 && res.logs[0].event == 'ManagerUpdate');
    });

    it('verifies that newManager is cleared after management transfer', async () => {
        let contract = await Managed.new();
        await contract.transferManagement(accounts[1]);
        await contract.acceptManagement({ from: accounts[1] });
        let newManager = await contract.newManager.call();
        assert.equal(newManager, utils.zeroAddress);
    });

    it('verifies that no management transfer takes places before the new manager accepted it', async () => {
        let contract = await Managed.new();
        await contract.transferManagement(accounts[1]);
        let manager = await contract.manager.call();
        assert.equal(manager, accounts[0]);
    });

    it('verifies that only the manager can initiate management transfer', async () => {
        let contract = await Managed.new();

        try {
            await contract.transferManagement(accounts[1], { from: accounts[2] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the manager can cancel management transfer before the new manager accepted it', async () => {
        let contract = await Managed.new();
        await contract.transferManagement(accounts[1]);
        await contract.transferManagement('0x0');
        let newManager = await contract.newManager.call();
        assert.equal(newManager, utils.zeroAddress);
    });
});
