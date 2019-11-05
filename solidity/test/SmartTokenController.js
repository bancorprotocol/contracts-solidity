/* global artifacts, contract, before, it, assert */
/* eslint-disable prefer-reflect */

const SmartToken = artifacts.require('SmartToken');
const SmartTokenController = artifacts.require('SmartTokenController');
const ERC20Token = artifacts.require('ERC20Token');
const utils = require('./helpers/Utils');

let token;
let tokenAddress;

// initializes a new controller with a new token and optionally transfers ownership from the token to the controller
async function initController(accounts, activate) {
    token = await SmartToken.new('Token1', 'TKN1', 2);
    await token.issue(accounts[0], 20000);
    let controller = await SmartTokenController.new(token.address);

    if (activate) {
        await token.transferOwnership(controller.address);
        await controller.acceptTokenOwnership();
    }

    return controller;
}

contract('SmartTokenController', accounts => {
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
        await utils.catchRevert(SmartTokenController.new('0x0'));
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

        await utils.catchRevert(controller.acceptTokenOwnership({ from: accounts[1] }));
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

        await utils.catchRevert(controller.transferTokenOwnership(controller2.address));
    });

    it('should throw when a non owner attempts to transfer token ownership', async () => {
        let token = await SmartToken.new('Token1', 'TKN1', 2);
        let controller = await SmartTokenController.new(token.address);
        await token.transferOwnership(controller.address);
        await controller.acceptTokenOwnership();

        let controller2 = await SmartTokenController.new(token.address);

        await utils.catchRevert(controller.transferTokenOwnership(controller2.address, { from: accounts[1] }));
    });

    it('verifies that the owner can withdraw other tokens from the token', async () => {
        let controller = await initController(accounts, true);
        let ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
        const prevBalance = await ercToken.balanceOf.call(accounts[0]);
        await ercToken.transfer(token.address, 100);
        await controller.withdrawFromToken(ercToken.address, accounts[0], 100);
        const balance = await ercToken.balanceOf.call(accounts[0]);
        assert.equal(prevBalance.toNumber(), balance.toNumber());
    });

    it('should throw when the owner attempts to withdraw other tokens from the token while the controller is not active', async () => {
        let controller = await initController(accounts, false);
        let ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
        await ercToken.transfer(token.address, 100);

        await utils.catchRevert(controller.withdrawFromToken(ercToken.address, accounts[0], 100));
    });

    it('should throw when a non owner attempts to withdraw other tokens from the token', async () => {
        let controller = await initController(accounts, true);
        let ercToken = await ERC20Token.new('ERC Token 1', 'ERC1', 0, 100000);
        await ercToken.transfer(token.address, 100);

        await utils.catchRevert(controller.withdrawFromToken(ercToken.address, accounts[0], 100, { from: accounts[1] }));
    });

    it('should allow to claim tokens if caller is set as BancorX in the controller', async () => {
        let bancorX = accounts[2];
        let controller = await initController(accounts, true);
        await controller.setBancorX(bancorX);
        await token.transfer(accounts[1], 100);
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 100);
        await controller.claimTokens(accounts[1], 100, {from: bancorX});
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 0);
    });

    it('should not allow to claim tokens if caller is not set as BancorX in the controller', async () => {
        let bancorX = accounts[2];
        let controller = await initController(accounts, true);
        await token.transfer(accounts[1], 100);
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 100);
        await utils.catchRevert(controller.claimTokens(accounts[1], 100, {from: bancorX}));
        assert.equal((await token.balanceOf(accounts[1])).toNumber(), 100);
    });
});