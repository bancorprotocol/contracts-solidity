const { accounts, defaultSender, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers');
const { roles } = require('./helpers/Constants');
const { expect } = require('../../chai-local');

const LiquidityProtectionSystemStore = contract.fromArtifact('LiquidityProtectionSystemStore');

describe('LiquidityProtectionSystemStore', () => {
    let liquidityProtectionSystemStore;

    const owner = accounts[1];
    const seeder = accounts[2];
    const token = accounts[3];
    const anchor = accounts[4];

    beforeEach(async () => {
        liquidityProtectionSystemStore = await LiquidityProtectionSystemStore.new();
        await liquidityProtectionSystemStore.grantRole(roles.ROLE_OWNER, owner);
        await liquidityProtectionSystemStore.grantRole(roles.ROLE_SEEDER, seeder);
    });

    it('should revert when a non owner attempts to increase system balance', async () => {
        await expectRevert(liquidityProtectionSystemStore.incSystemBalance(token, 1), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('0');
    });

    it('should revert when a non owner attempts to decrease system balance', async () => {
        await liquidityProtectionSystemStore.incSystemBalance(token, 1, { from: owner });
        await expectRevert(liquidityProtectionSystemStore.decSystemBalance(token, 1), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('1');
    });

    it('should revert when a non seeder attempts to seed system balances', async () => {
        await expectRevert(liquidityProtectionSystemStore.seedSystemBalances([token], [1]), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('0');
    });

    it('should succeed when an owner attempts to increase system balance', async () => {
        const response = await liquidityProtectionSystemStore.incSystemBalance(token, 1, { from: owner });
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('1');
        expectEvent(response, 'SystemBalanceUpdated', { token: token, prevAmount: '0', newAmount: '1' });
    });

    it('should succeed when an owner attempts to decrease system balance', async () => {
        await liquidityProtectionSystemStore.incSystemBalance(token, 1, { from: owner });
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('1');
        const response = await liquidityProtectionSystemStore.decSystemBalance(token, 1, { from: owner });
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('0');
        expectEvent(response, 'SystemBalanceUpdated', { token: token, prevAmount: '1', newAmount: '0' });
    });

    it('should succeed when a seeder attempts to seed system balances', async () => {
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('0');
        await liquidityProtectionSystemStore.seedSystemBalances([token], [1], { from: seeder });
        expect(await liquidityProtectionSystemStore.systemBalance(token)).to.be.bignumber.equal('1');
    });

    it('should revert when a non owner attempts to increase network tokens minted', async () => {
        await expectRevert(liquidityProtectionSystemStore.incNetworkTokensMinted(anchor, 1), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('0');
    });

    it('should revert when a non owner attempts to decrease network tokens minted', async () => {
        await liquidityProtectionSystemStore.incNetworkTokensMinted(anchor, 1, { from: owner });
        await expectRevert(liquidityProtectionSystemStore.decNetworkTokensMinted(anchor, 1), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('1');
    });

    it('should revert when a non seeder attempts to seed network tokens minted', async () => {
        await expectRevert(liquidityProtectionSystemStore.seedNetworkTokensMinted([anchor], [1]), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('0');
    });

    it('should succeed when an owner attempts to increase network tokens minted', async () => {
        const response = await liquidityProtectionSystemStore.incNetworkTokensMinted(anchor, 1, { from: owner });
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('1');
        expectEvent(response, 'NetworkTokensMintedUpdated', { poolAnchor: anchor, prevAmount: '0', newAmount: '1' });
    });

    it('should succeed when an owner attempts to decrease network tokens minted', async () => {
        await liquidityProtectionSystemStore.incNetworkTokensMinted(anchor, 1, { from: owner });
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('1');
        const response = await liquidityProtectionSystemStore.decNetworkTokensMinted(anchor, 1, { from: owner });
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('0');
        expectEvent(response, 'NetworkTokensMintedUpdated', { poolAnchor: anchor, prevAmount: '1', newAmount: '0' });
    });

    it('should succeed when a seeder attempts to seed network tokens minted', async () => {
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('0');
        await liquidityProtectionSystemStore.seedNetworkTokensMinted([anchor], [1], { from: seeder });
        expect(await liquidityProtectionSystemStore.networkTokensMinted(anchor)).to.be.bignumber.equal('1');
    });
});
