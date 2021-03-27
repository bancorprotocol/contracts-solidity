import { expect } from 'chai';
const { roles } = require('./helpers/Constants');

const rlp = require('rlp');

const Contracts = require('./helpers/Contracts');

let networkToken;
let registry;
let admin;

describe('LiquidityProtectionSettingsMigrator', () => {
    before(async () => {
        accounts = await ethers.getSigners();

        networkToken = accounts[1];
        registry = accounts[2];
        admin = accounts[3];
    });

    it('deploy', async () => {
        const sourceSettings = await Contracts.LiquidityProtectionSettings.deploy(
            networkToken.address,
            registry.address
        );

        for (let i = 0; i < accounts.length; i++) {
            await sourceSettings.addPoolToWhitelist(accounts[i].address);
            await sourceSettings.setNetworkTokenMintingLimit(accounts[i].address, i);
        }

        const sourceState = await readState(sourceSettings);

        const migrator = await Contracts.LiquidityProtectionSettingsMigrator.deploy(
            sourceState.networkToken,
            sourceState.registry,
            sourceState.pools,
            sourceState.limits,
            admin.address
        );

        const targetAddress = '0x' + ethers.utils.keccak256(rlp.encode([migrator.address, 1])).slice(26);
        const targetSettings = await Contracts.LiquidityProtectionSettings.attach(targetAddress);
        const targetState = await readState(targetSettings);

        expect(targetState).to.be.deep.equal(sourceState);
        expect(await targetSettings.hasRole(roles.ROLE_OWNER, admin.address)).to.be.true;
        expect(await targetSettings.hasRole(roles.ROLE_OWNER, migrator.address)).to.be.false;
    });

    async function readState(settings) {
        const networkToken = await settings.networkToken();
        const registry = await settings.registry();
        const pools = await settings.poolWhitelist();
        const limits = await Promise.all(pools.map((pool) => settings.networkTokenMintingLimits(pool)));
        return { networkToken, registry, pools, limits };
    }
});
