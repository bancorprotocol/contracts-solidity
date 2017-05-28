/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const SmartToken = artifacts.require('SmartToken.sol');
const SmartTokenController = artifacts.require('SmartTokenController.sol');
const TestERC20Token = artifacts.require('TestERC20Token.sol');
const utils = require('./helpers/Utils');

let token;
let tokenAddress;

// initializes a new controller with a new token and optionally transfers ownership from the token to the controller
async function initController(accounts, activate) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    let controller = await SmartTokenController.new(token.address);

    if (activate) {
        await token.transferOwnership(controller.address);
        await controller.acceptTokenOwnership();
    }

    return controller;
}

contract('SmartTokenController', (accounts) => {
    before(async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        tokenAddress = token.address;
    });

    it('verifies the token address after construction', async () => {
        let controller = await SmartTokenController.new(tokenAddress);
        let token = await controller.token.call();
        assert.equal(token, tokenAddress);
    });

    it('should throw when attempting to construct a controller with no token', async () => {
        try {
            await SmartTokenController.new('0x0');
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can accept token ownership', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let controller = await SmartTokenController.new(token.address);
        await token.transferOwnership(controller.address);
        await controller.acceptTokenOwnership();
        let tokenOwner = await token.owner.call();
        assert.equal(tokenOwner, controller.address);
    });

    it('should throw when a non owner attempts to accept token ownership', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let controller = await SmartTokenController.new(token.address);
        await token.transferOwnership(controller.address);

        try {
            await controller.acceptTokenOwnership({ from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can transfer token ownership', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let controller = await SmartTokenController.new(token.address);
        await token.transferOwnership(controller.address);
        await controller.acceptTokenOwnership();

        let controller2 = await SmartTokenController.new(token.address);
        await controller.transferTokenOwnership(controller2.address);
        await controller2.acceptTokenOwnership();

        let tokenOwner = await token.owner.call();
        assert.equal(tokenOwner, controller2.address);
    });

    it('should throw when the owner attempts to transfer token ownership while the controller is not active', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let controller = await SmartTokenController.new(token.address);
        await token.transferOwnership(controller.address);

        let controller2 = await SmartTokenController.new(token.address);

        try {
            await controller.transferTokenOwnership(controller2.address);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to transfer token ownership', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let controller = await SmartTokenController.new(token.address);
        await token.transferOwnership(controller.address);
        await controller.acceptTokenOwnership();

        let controller2 = await SmartTokenController.new(token.address);

        try {
            await controller.transferTokenOwnership(controller2.address, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can disable / re-enable token transfers', async () => {
        let controller = await initController(accounts, true);

        await controller.disableTokenTransfers(true);
        let transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, false);

        await controller.disableTokenTransfers(false);
        transfersEnabled = await token.transfersEnabled.call();
        assert.equal(transfersEnabled, true);
    });

    it('should throw when the owner attempts to disable token transfers while the controller is not active', async () => {
        let controller = await initController(accounts, false);

        try {
            await controller.disableTokenTransfers(true);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to disable token transfers', async () => {
        let controller = await initController(accounts, true);

        try {
            await controller.disableTokenTransfers(true, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can issue new tokens', async () => {
        let controller = await initController(accounts, true);

        let prevSupply = await token.totalSupply.call();
        await controller.issueTokens(accounts[3], 100);
        let supply = await token.totalSupply.call();
        assert.equal(supply.toNumber(), prevSupply.plus(100).toNumber());
    });

    it('should throw when the owner attempts to issue new tokens while the controller is not active', async () => {
        let controller = await initController(accounts, false);

        try {
            await controller.issueTokens(accounts[3], 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to issue new tokens', async () => {
        let controller = await initController(accounts, true);

        try {
            await controller.issueTokens(accounts[3], 100, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can destroy tokens', async () => {
        let controller = await initController(accounts, true);

        await controller.issueTokens(accounts[3], 100);
        let prevSupply = await token.totalSupply.call();
        await controller.destroyTokens(accounts[3], 50);
        let supply = await token.totalSupply.call();
        assert.equal(supply.toNumber(), prevSupply.minus(50).toNumber());
    });

    it('should throw when the owner attempts to destroy tokens while the controller is not active', async () => {
        let controller = await initController(accounts, false);
        await token.issue(accounts[3], 100);

        try {
            await controller.destroyTokens(accounts[3], 50);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to destroy tokens', async () => {
        let controller = await initController(accounts, true);
        await controller.issueTokens(accounts[3], 100);

        try {
            await controller.destroyTokens(accounts[3], 50, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('verifies that the owner can withdraw other tokens from the token', async () => {
        let controller = await initController(accounts, true);
        let ercToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        const prevBalance = await ercToken.balanceOf.call(accounts[0]);
        await ercToken.transfer(token.address, 100);
        await controller.withdrawFromToken(ercToken.address, accounts[0], 100);
        const balance = await ercToken.balanceOf.call(accounts[0]);
        assert.equal(prevBalance.toNumber(), balance.toNumber());
    });

    it('should throw when the owner attempts to withdraw other tokens from the token while the controller is not active', async () => {
        let controller = await initController(accounts, false);
        let ercToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await ercToken.transfer(token.address, 100);

        try {
            await controller.withdrawFromToken(ercToken.address, accounts[0], 100);
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });

    it('should throw when a non owner attempts to withdraw other tokens from the token', async () => {
        let controller = await initController(accounts, true);
        let ercToken = await TestERC20Token.new('ERC Token 1', 'ERC1', 100000);
        await ercToken.transfer(token.address, 100);

        try {
            await controller.withdrawFromToken(ercToken.address, accounts[0], 100, { from: accounts[1] });
            assert(false, "didn't throw");
        }
        catch (error) {
            return utils.ensureException(error);
        }
    });
});
