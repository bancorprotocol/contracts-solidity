import { ethers } from 'hardhat';
import { expect } from 'chai';

import Constants from './helpers/Constants';
import Contracts from './helpers/Contracts';
import { encode } from 'rlp';

let networkToken: any;
let registry: any;
let admin: any;
let accounts: any;

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

        const targetAddress = '0x' + ethers.utils.keccak256(encode([migrator.address, 1])).slice(26);
        const targetSettings = await Contracts.LiquidityProtectionSettings.attach(targetAddress);
        const targetState = await readState(targetSettings);

        expect(targetState).to.be.deep.equal(sourceState);
        expect(await targetSettings.hasRole(Constants.roles.ROLE_OWNER, admin.address)).to.be.true;
        expect(await targetSettings.hasRole(Constants.roles.ROLE_OWNER, migrator.address)).to.be.false;
    });

    async function readState(settings: any) {
        const networkToken = await settings.networkToken();
        const registry = await settings.registry();
        const pools = await settings.poolWhitelist();
        const limits = await Promise.all(pools.map((pool: any) => settings.networkTokenMintingLimits(pool)));
        return { networkToken, registry, pools, limits };
    }
});
