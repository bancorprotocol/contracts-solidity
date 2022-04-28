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
const BATCH_SIZE = 1000;

const LIQUIDITY_PROTECTION_STORE_ADDRESS = '0xf5fab5dbd2f3bf675de4cb76517d4767013cfb55';
const STAKING_REWARDS_ADDRESS = '0x318fEA7e45A7D3aC5999DA7e1055F5982eEB3E67';

let provider: providers.WebSocketProvider;

const init = () => {
    console.log(`Connecting to ${ETHEREUM_PROVIDER_URL}...`);

    provider = new providers.WebSocketProvider(ETHEREUM_PROVIDER_URL);
};

const getProviders = async () => {
    const toBlock = await provider.getBlockNumber();

    console.log(`Getting all historic providers from ${START_BLOCK} to ${toBlock}...`);
    console.log();

    const store = LiquidityProtectionStore.connect(LIQUIDITY_PROTECTION_STORE_ADDRESS, provider);

    const providers = new Set<string>();

    for (let i = START_BLOCK; i < toBlock; i += BATCH_SIZE) {
        const endBlock = Math.min(i + BATCH_SIZE - 1, toBlock);

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

type ProvidersWithRewards = Record<string, BigNumber>;

const filterProvidersWithRewards = async (providers: Set<string>) => {
    console.log('Filtering providers with pending rewards...');
    console.log();

    const providersWithRewards: ProvidersWithRewards = {};

    const stakingRewards = StakingRewards.connect(STAKING_REWARDS_ADDRESS, provider);

    for (const provider of providers) {
        const pendingRewards = await stakingRewards.pendingRewards(provider);
        if (pendingRewards.gt(0)) {
            providersWithRewards[provider] = pendingRewards;
        }
    }

    return providersWithRewards;
};

const saveCSV = (providers: ProvidersWithRewards, outputPath: string) => {
    console.log(`Saving providers CSV as ${outputPath}...`);
    console.log();

    const data = Object.entries(providers)
        .map(([provider, pendingRewards]) => [provider, pendingRewards.toString()].join(','))
        .join('\n');

    fs.writeFileSync(outputPath, data, 'utf-8');
};

const saveMerkleTree = (providers: ProvidersWithRewards, outputPath: string) => {
    console.log(`Saving providers MerkleTree as ${outputPath}...`);
    console.log();

    const merkleTree = new MerkleTree(
        Object.entries(providers).map(
            ([provider, pendingRewards]) =>
                solidityKeccak256(['address', 'uint256'], [provider, pendingRewards.toString()]).slice(2),
            'hex'
        ),
        keccak256,
        { sortPairs: true }
    );

    fs.writeFileSync(outputPath, JSON.stringify({ root: merkleTree.getHexRoot(), tree: merkleTree }, null, 4));
};

const main = async () => {
    init();

    const providers = await getProviders();
    const providersWithRewards = await filterProvidersWithRewards(providers);

    const timestamp = new Date().toISOString();

    saveCSV(providersWithRewards, `./snapshot-${timestamp}.csv`);
    saveMerkleTree(providersWithRewards, `./snapshot-merkle-tree-${timestamp}.json`);
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
