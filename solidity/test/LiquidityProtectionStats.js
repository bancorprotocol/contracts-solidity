const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { roles } = require('./helpers/Constants');
const { expect } = require('../../chai-local');

const LiquidityProtectionStats = contract.fromArtifact('LiquidityProtectionStats');

describe('LiquidityProtectionStats', () => {
    let liquidityProtectionStats;

    const owner = accounts[1];
    const seeder = accounts[2];
    const provider = accounts[3];
    const poolToken = accounts[4];
    const reserveToken = accounts[5];

    beforeEach(async () => {
        liquidityProtectionStats = await LiquidityProtectionStats.new();
        await liquidityProtectionStats.grantRole(roles.ROLE_OWNER, owner);
        await liquidityProtectionStats.grantRole(roles.ROLE_SEEDER, seeder);
    });

    it('should revert when a non owner attempts to increase total amounts', async () => {
        await expectRevert(
            liquidityProtectionStats.increaseTotalAmounts(provider, poolToken, reserveToken, 1, 2),
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('0');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('0');
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('0');
    });

    it('should revert when a non owner attempts to decrease total amounts', async () => {
        await liquidityProtectionStats.increaseTotalAmounts(provider, poolToken, reserveToken, 1, 2, { from: owner });
        await expectRevert(
            liquidityProtectionStats.decreaseTotalAmounts(provider, poolToken, reserveToken, 1, 2),
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('1');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('2');
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('2');
    });

    it('should revert when a non owner attempts to add a provider pool', async () => {
        await expectRevert(liquidityProtectionStats.addProviderPool(provider, poolToken), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([]);
    });

    it('should revert when a non owner attempts to remove a provider pool', async () => {
        await liquidityProtectionStats.addProviderPool(provider, poolToken, { from: owner });
        await expectRevert(liquidityProtectionStats.removeProviderPool(provider, poolToken), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([poolToken]);
    });

    it('should revert when a non seeder attempts to seed pool amounts', async () => {
        await expectRevert(liquidityProtectionStats.seedPoolAmounts([poolToken], [1]), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('0');
    });

    it('should revert when a non seeder attempts to seed reserve amounts', async () => {
        await expectRevert(
            liquidityProtectionStats.seedReserveAmounts([poolToken], [reserveToken], [1]),
            'ERR_ACCESS_DENIED'
        );
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('0');
    });

    it('should revert when a non seeder attempts to seed provider amounts', async () => {
        await expectRevert(
            liquidityProtectionStats.seedProviderAmounts([provider], [poolToken], [reserveToken], [1]),
            'ERR_ACCESS_DENIED'
        );
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('0');
    });

    it('should revert when a non seeder attempts to seed provider pools', async () => {
        await expectRevert(liquidityProtectionStats.seedProviderPools([provider], [poolToken]), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([]);
    });

    it('should revert when a non seeder attempts to seed pool amounts', async () => {
        await expectRevert(liquidityProtectionStats.seedPoolAmounts([poolToken], [1]), 'ERR_ACCESS_DENIED');
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('0');
    });

    it('should succeed when the owner attempts to increase total amounts', async () => {
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('0');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('0');
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('0');
        await liquidityProtectionStats.increaseTotalAmounts(provider, poolToken, reserveToken, 1, 2, { from: owner });
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('1');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('2');
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('2');
    });

    it('should succeed when the owner attempts to decrease total amounts', async () => {
        await liquidityProtectionStats.increaseTotalAmounts(provider, poolToken, reserveToken, 1, 2, { from: owner });
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('1');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('2');
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('2');
        await liquidityProtectionStats.decreaseTotalAmounts(provider, poolToken, reserveToken, 1, 2, { from: owner });
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('0');
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('0');
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('0');
    });

    it('should succeed when the owner attempts to add a provider pool', async () => {
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([]);
        await liquidityProtectionStats.addProviderPool(provider, poolToken, { from: owner });
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([poolToken]);
    });

    it('should succeed when the owner attempts to remove a provider pool', async () => {
        await liquidityProtectionStats.addProviderPool(provider, poolToken, { from: owner });
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([poolToken]);
        await liquidityProtectionStats.removeProviderPool(provider, poolToken, { from: owner });
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([]);
    });

    it('should succeed when a seeder attempts to seed pool amounts', async () => {
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('0');
        await liquidityProtectionStats.seedPoolAmounts([poolToken], [1], { from: seeder });
        expect(await liquidityProtectionStats.totalPoolAmount(poolToken)).to.be.bignumber.equal('1');
    });

    it('should succeed when a seeder attempts to seed reserve amounts', async () => {
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('0');
        await liquidityProtectionStats.seedReserveAmounts([poolToken], [reserveToken], [1], { from: seeder });
        expect(await liquidityProtectionStats.totalReserveAmount(poolToken, reserveToken)).to.be.bignumber.equal('1');
    });

    it('should succeed when a seeder attempts to seed provider amounts', async () => {
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('0');
        await liquidityProtectionStats.seedProviderAmounts([provider], [poolToken], [reserveToken], [1], {
            from: seeder
        });
        expect(
            await liquidityProtectionStats.totalProviderAmount(provider, poolToken, reserveToken)
        ).to.be.bignumber.equal('1');
    });

    it('should succeed when a seeder attempts to seed provider pools', async () => {
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([]);
        await liquidityProtectionStats.seedProviderPools([provider], [poolToken], { from: seeder });
        expect(await liquidityProtectionStats.providerPools(provider)).to.be.deep.equal([poolToken]);
    });
});
