const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { roles } = require('./helpers/Constants');

const { ROLE_OWNER } = roles;

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionSettingsMigrator = contract.fromArtifact('LiquidityProtectionSettingsMigrator');

describe('LiquidityProtectionSettingsMigrator', () => {
    const sourceSettingsOwner = accounts[1];
    const migratorOwner = accounts[2];

    let sourceSettings;
    let targetSettings;
    let migrator;

    before(async () => {
        sourceSettings = await LiquidityProtectionSettings.new(accounts[0], accounts[0]);
        targetSettings = await LiquidityProtectionSettings.new(accounts[0], accounts[0]);
        migrator = await LiquidityProtectionSettingsMigrator.new({ from: migratorOwner });
        await sourceSettings.grantRole(ROLE_OWNER, sourceSettingsOwner);
        for (let i = 1; i <= 9; i++) {
            const pool = '0x'.padEnd(42, `${i}`);
            await sourceSettings.addPoolToWhitelist(pool);
            await sourceSettings.setNetworkTokenMintingLimit(pool, i);
        }
    });

    it('should revert when attempting to migrate without migrator ownership', async () => {
        await expectRevert(migrator.migrate(sourceSettings.address, targetSettings.address, { from: defaultSender }), 'ERR_ACCESS_DENIED');
        expect(await targetSettings.poolWhitelist.call()).to.be.deep.equal([]);
    });

    it('should revert when attempting to migrate with migrator ownership but without targetent settings ownership', async () => {
        await expectRevert(migrator.migrate(sourceSettings.address, targetSettings.address, { from: migratorOwner }), 'ERR_ACCESS_DENIED');
        expect(await targetSettings.poolWhitelist.call()).to.be.deep.equal([]);
    });

    it('should succeed when attempting to migrate with migrator ownership and with targetent settings ownership', async () => {
        await targetSettings.grantRole(ROLE_OWNER, migrator.address);
        await migrator.migrate(sourceSettings.address, targetSettings.address, { from: migratorOwner });
        const sourcePools = await sourceSettings.poolWhitelist.call();
        const targetPools = await targetSettings.poolWhitelist.call();
        const sourceLimits = await Promise.all(sourcePools.map(pool => sourceSettings.networkTokenMintingLimits.call(pool)));
        const targetLimits = await Promise.all(targetPools.map(pool => targetSettings.networkTokenMintingLimits.call(pool)));
        expect(targetPools).to.be.deep.equal(sourcePools);
        expect(targetLimits).to.be.deep.equal(sourceLimits);
        expect(await targetSettings.hasRole.call(ROLE_OWNER, migrator.address)).to.be.false();
        expect(await web3.eth.getCode(migrator.address)).to.be.equal('0x');
    });
});
