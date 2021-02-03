const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { roles } = require('./helpers/Constants');

const { ROLE_OWNER } = roles;

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionSettingsMigrator = contract.fromArtifact('LiquidityProtectionSettingsMigrator');

describe('LiquidityProtectionSettingsMigrator', () => {
    const migratorOwner = accounts[1];

    let sourceSettings;
    let targetSettings;
    let migrator;

    before(async () => {
        sourceSettings = await LiquidityProtectionSettings.new(accounts[0], accounts[0]);
        targetSettings = await LiquidityProtectionSettings.new(accounts[0], accounts[0]);
        migrator = await LiquidityProtectionSettingsMigrator.new({ from: migratorOwner });
        for (let i = 1; i <= 9; i++) {
            const pool = '0x'.padEnd(42, `${i}`);
            await sourceSettings.addPoolToWhitelist(pool);
            await sourceSettings.setNetworkTokenMintingLimit(pool, i);
        }
    });

    it('should revert when attempting to migrate without migrator ownership', async () => {
        await expectRevert(migrator.migrate(targetSettings.address, [accounts[0]], [0], { from: defaultSender }), 'ERR_ACCESS_DENIED');
        expect(await targetSettings.poolWhitelist.call()).to.be.deep.equal([]);
    });

    it('should revert when attempting to migrate with migrator ownership but without targetent settings ownership', async () => {
        await expectRevert(migrator.migrate(targetSettings.address, [accounts[0]], [0], { from: migratorOwner }), 'ERR_ACCESS_DENIED');
        expect(await targetSettings.poolWhitelist.call()).to.be.deep.equal([]);
    });

    it('should succeed when attempting to migrate with migrator ownership and with targetent settings ownership', async () => {
        await targetSettings.grantRole(ROLE_OWNER, migrator.address);
        const sourceState = await readState(sourceSettings);
        await migrator.migrate(targetSettings.address, sourceState.pools, sourceState.limits, { from: migratorOwner });
        const targetState = await readState(targetSettings);
        expect(targetState).to.be.deep.equal(sourceState);
        expect(await targetSettings.hasRole.call(ROLE_OWNER, migrator.address)).to.be.false();
        expect(await web3.eth.getCode(migrator.address)).to.be.equal('0x');
    });

    async function readState(settings) {
        const pools = await settings.poolWhitelist.call();
        const limits = await Promise.all(pools.map(pool => settings.networkTokenMintingLimits.call(pool)));
        return {pools, limits};
    }
});
