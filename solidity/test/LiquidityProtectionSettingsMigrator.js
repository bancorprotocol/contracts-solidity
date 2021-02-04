const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expect } = require('../../chai-local');
const { roles } = require('./helpers/Constants');
const rlp = require('rlp');

const LiquidityProtectionSettings = contract.fromArtifact('LiquidityProtectionSettings');
const LiquidityProtectionSettingsMigrator = contract.fromArtifact('LiquidityProtectionSettingsMigrator');

describe('LiquidityProtectionSettingsMigrator', () => {
    it('deploy', async () => {
        const networkToken = accounts[1];
        const registry = accounts[2];
        const admin = accounts[3];

        const sourceSettings = await LiquidityProtectionSettings.new(networkToken, registry);

        for (let i = 1; i <= 9; i++) {
            const pool = '0x'.padEnd(42, `${i}`);
            await sourceSettings.addPoolToWhitelist(pool);
            await sourceSettings.setNetworkTokenMintingLimit(pool, i);
        }

        const sourceState = await readState(sourceSettings);

        const migrator = await LiquidityProtectionSettingsMigrator.new(
            sourceState.networkToken,
            sourceState.registry,
            sourceState.pools,
            sourceState.limits,
            admin
        );

        const targetAddress = '0x' + web3.utils.sha3(rlp.encode([migrator.address, 1])).slice(26);
        const targetSettings = await LiquidityProtectionSettings.at(targetAddress);
        const targetState = await readState(targetSettings);

        expect(targetState).to.be.deep.equal(sourceState);
        expect(await targetSettings.hasRole.call(roles.ROLE_OWNER, admin)).to.be.true();
        expect(await targetSettings.hasRole.call(roles.ROLE_OWNER, migrator.address)).to.be.false();
    });

    async function readState(settings) {
        const networkToken = await settings.networkToken.call();
        const registry = await settings.registry.call();
        const pools = await settings.poolWhitelist.call();
        const limits = await Promise.all(pools.map((pool) => settings.networkTokenMintingLimits.call(pool)));
        return { networkToken, registry, pools, limits };
    }
});
