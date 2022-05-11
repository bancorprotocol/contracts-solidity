import {
    LiquidityProtectionStore__factory as LiquidityProtectionStore,
    StakingRewards__factory as StakingRewards
} from '../../typechain';
import { BigNumber, providers, utils } from 'ethers';
import fs from 'fs';
import MerkleTree from 'merkletreejs';

const { solidityKeccak256, keccak256 } = utils;

const ETHEREUM_PROVIDER_URL = 'ws://localhost:8545';
const START_BLOCK = 11039642;
const END_BLOCK = 14745043;
const BATCH_SIZE = 1000;

const LIQUIDITY_PROTECTION_STORE_ADDRESS = '0xf5fab5dbd2f3bf675de4cb76517d4767013cfb55';
const STAKING_REWARDS_ADDRESS = '0x318fEA7e45A7D3aC5999DA7e1055F5982eEB3E67';

let provider: providers.WebSocketProvider;

const init = () => {
    console.log(`Connecting to ${ETHEREUM_PROVIDER_URL}...`);

    provider = new providers.WebSocketProvider(ETHEREUM_PROVIDER_URL);
};

const getProviders = async () => {
    console.log(`Getting all historic providers from ${START_BLOCK} to ${END_BLOCK}...`);
    console.log();

    const store = LiquidityProtectionStore.connect(LIQUIDITY_PROTECTION_STORE_ADDRESS, provider);

    const providers = new Set<string>();

    for (let i = START_BLOCK; i < END_BLOCK; i += BATCH_SIZE) {
        const endBlock = Math.min(i + BATCH_SIZE - 1, END_BLOCK);

        console.log(`Querying all ProtectionAdded and ProtectionUpdated events from ${i} to ${endBlock}...`);

        const addEvents = await store.queryFilter(store.filters.ProtectionAdded(), i, endBlock);
        for (const event of addEvents) {
            providers.add(event.args.provider);
        }

        const updateEvents = await store.queryFilter(store.filters.ProtectionUpdated(), i, endBlock);
        for (const event of updateEvents) {
            providers.add(event.args.provider);
        }
    }

    return providers;
};

interface Rewards {
    claimable: BigNumber;
    totalClaimed: BigNumber;
}

type ProvidersWithRewards = Record<string, Rewards>;

const filterProvidersWithRewards = async (providers: Set<string>) => {
    console.log('Filtering providers with pending rewards...');
    console.log();

    const providersWithRewards: ProvidersWithRewards = {};

    const stakingRewards = StakingRewards.connect(STAKING_REWARDS_ADDRESS, provider);

    for (const provider of providers) {
        const claimable = await stakingRewards.pendingRewards(provider, { blockTag: END_BLOCK });
        const totalClaimed = await stakingRewards.totalClaimedRewards(provider, { blockTag: END_BLOCK });
        if (claimable.gt(0) || totalClaimed.gt(0)) {
            providersWithRewards[provider] = { claimable, totalClaimed };
        }
    }

    return providersWithRewards;
};

const saveSnapshot = (providers: ProvidersWithRewards, outputPath: string) => {
    console.log(`Saving providers snapshot as ${outputPath}...`);
    console.log();

    let data: Record<string, [string, string]> = {};
    Object.entries(providers).forEach(
        ([provider, { claimable, totalClaimed }]) => (data[provider] = [claimable.toString(), totalClaimed.toString()])
    );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(
            providers,
            (_, value) => {
                const { type, hex } = value;
                if (type === 'BigNumber') {
                    return BigNumber.from(hex).toString();
                }

                return value;
            },
            4
        )
    );
};

const saveMerkleTree = (providers: ProvidersWithRewards, outputPath: string) => {
    console.log(`Saving providers MerkleTree as ${outputPath}...`);
    console.log();

    const merkleTree = new MerkleTree(
        Object.entries(providers).map(
            ([provider, { claimable }]) =>
                solidityKeccak256(['address', 'uint256'], [provider, claimable.toString()]).slice(2),
            'hex'
        ),
        keccak256,
        { sortPairs: true }
    );

    fs.writeFileSync(outputPath, JSON.stringify({ root: merkleTree.getHexRoot(), tree: merkleTree }));
};

const main = async () => {
    init();

    const providers = await getProviders();
    const providersWithRewards = await filterProvidersWithRewards(providers);

    const timestamp = new Date().toISOString();

    saveSnapshot(providersWithRewards, `./snapshot-${timestamp}.json`);
    saveMerkleTree(providersWithRewards, `./snapshot-merkle-tree-${timestamp}.json`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
