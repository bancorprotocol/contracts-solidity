const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');
const { roles } = require('./helpers/Constants');

const { ROLE_OWNER } = roles;

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionSettingsMigrator = contract.fromArtifact('LiquidityProtectionSettingsMigrator');

describe('LiquidityProtectionSettingsMigrator', () => {
    const prevSettingsOwner = accounts[1];
    const migratorOwner = accounts[2];

    let prevSettings;
    let currSettings;
    let migrator;

    before(async () => {
        prevSettings = await LiquidityProtectionSettings.new(accounts[0], accounts[0]);
        currSettings = await LiquidityProtectionSettings.new(accounts[0], accounts[0]);
        migrator = await LiquidityProtectionSettingsMigrator.new({ from: migratorOwner });
        await prevSettings.grantRole(ROLE_OWNER, prevSettingsOwner);
        for (let i = 1; i <= 9; i++) {
            const pool = '0x'.padEnd(42, `${i}`);
            await prevSettings.addPoolToWhitelist(pool);
            await prevSettings.setNetworkTokenMintingLimit(pool, i);
        }
    });

    it('should revert when attempting to migrate without migrator ownership', async () => {
        await expectRevert(migrator.migrate(prevSettings.address, currSettings.address, { from: defaultSender }), 'ERR_ACCESS_DENIED');
        expect(await currSettings.poolWhitelist.call()).to.be.deep.equal([]);
    });

    it('should revert when attempting to migrate with migrator ownership but without current settings ownership', async () => {
        await expectRevert(migrator.migrate(prevSettings.address, currSettings.address, { from: migratorOwner }), 'ERR_ACCESS_DENIED');
        expect(await currSettings.poolWhitelist.call()).to.be.deep.equal([]);
    });

    it('should succeed when attempting to migrate with migrator ownership and with current settings ownership', async () => {
        await currSettings.grantRole(ROLE_OWNER, migrator.address);
        await migrator.migrate(prevSettings.address, currSettings.address, { from: migratorOwner });
        const prevPools = await prevSettings.poolWhitelist.call();
        const currPools = await currSettings.poolWhitelist.call();
        const prevLimits = await Promise.all(prevPools.map(pool => prevSettings.networkTokenMintingLimits.call(pool)));
        const currLimits = await Promise.all(currPools.map(pool => currSettings.networkTokenMintingLimits.call(pool)));
        expect(currPools).to.be.deep.equal(prevPools);
        expect(currLimits).to.be.deep.equal(prevLimits);
        expect(await currSettings.hasRole.call(ROLE_OWNER, migrator.address)).to.be.false();
        expect(await web3.eth.getCode(migrator.address)).to.be.equal('0x');
    });
});
