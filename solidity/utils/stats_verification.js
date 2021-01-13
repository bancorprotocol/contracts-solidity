const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const STORE_NODE = process.argv[2];
const STATS_NODE = process.argv[3];
const STORE_ADDR = process.argv[4];
const STATS_ADDR = process.argv[5];

const ARTIFACTS_DIR = path.resolve(__dirname, '../build');

const READ_BATCH_SIZE = 100;
const READ_TIMEOUT = 10000;

const DELIMITER = '.';

if (!fs.existsSync(ARTIFACTS_DIR)) {
    throw new Error('Artifacts not found');
}

function toKey(keys) {
    return keys.join(DELIMITER);
}

function toKeys(key) {
    return key.split(DELIMITER);
}

function setState(state, keys, value) {
    const key = toKey(keys);
    if (state[key] === undefined) {
        state[key] = value;
    } else {
        state[key] = Web3.utils.toBN(state[key]).add(Web3.utils.toBN(value)).toString();
    }
}

function sumValues(state, key) {
    return Object.entries(state)
        .filter((entry) => entry[0].startsWith(key))
        .reduce((sum, entry) => sum.add(Web3.utils.toBN(entry[1])), Web3.utils.toBN(0))
        .toString();
}

async function rpc(func) {
    while (true) {
        try {
            return await func.call();
        } catch (error) {
            console.log(error.message);
            if (error.message.endsWith('project ID request rate exceeded')) {
                await new Promise((resolve) => setTimeout(resolve, READ_TIMEOUT));
            } else if (!error.message.startsWith('Invalid JSON RPC response')) {
                throw error;
            }
        }
    }
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.abi'), { encoding: 'utf8' });
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function readState(web3, store) {
    const poolAmounts = {};
    const reserveAmounts = {};
    const providerAmounts = {};

    const count = await web3.eth.getStorageAt(store._address, 4);

    for (let i = 0; i < count; i += READ_BATCH_SIZE) {
        const ids = [...Array(Math.min(count, READ_BATCH_SIZE + i) - i).keys()].map((n) => n + i);
        const pls = await Promise.all(ids.map((id) => rpc(store.methods.protectedLiquidity(id))));
        for (let j = 0; j < ids.length; j++) {
            console.log(`${ids[j]}: ${Object.values(pls[j])}`);
            const provider = pls[j][0];
            const poolToken = pls[j][1];
            const reserveToken = pls[j][2];
            const poolAmount = pls[j][3];
            const reserveAmount = pls[j][4];
            setState(poolAmounts, [poolToken], poolAmount);
            setState(reserveAmounts, [poolToken, reserveToken], reserveAmount);
            setState(providerAmounts, [poolToken, reserveToken, provider], reserveAmount);
        }
    }

    return { poolAmounts, reserveAmounts, providerAmounts };
}

async function readAmounts(state, func) {
    const amounts = {};
    for (let i = 0; i < Object.keys(state).length; i += READ_BATCH_SIZE) {
        const keys = Object.keys(state).slice(i, i + READ_BATCH_SIZE);
        const values = await Promise.all(keys.map((key) => rpc(func(...toKeys(key)))));
        for (let j = 0; j < keys.length; j++) {
            amounts[keys[j]] = values[j];
        }
    }
    return amounts;
}

async function readStoreAmounts(state, store) {
    return {
        poolAmounts: await readAmounts(state.poolAmounts, store.methods.totalProtectedPoolAmount),
        reserveAmounts: await readAmounts(state.reserveAmounts, store.methods.totalProtectedReserveAmount)
    };
}

async function readStatsAmounts(state, stats) {
    return {
        poolAmounts: await readAmounts(state.poolAmounts, stats.methods.totalPoolAmount),
        reserveAmounts: await readAmounts(state.reserveAmounts, stats.methods.totalReserveAmount),
        providerAmounts: await readAmounts(state.providerAmounts, stats.methods.totalProviderAmount)
    };
}

async function compare(state, storeState, statsState) {
    for (const key of Object.keys(state.poolAmounts)) {
        const storeAmount = storeState.poolAmounts[key];
        const statsAmount = statsState.poolAmounts[key];
        if (storeAmount !== statsAmount) {
            console.log(`poolAmounts[${key}]: store = ${storeAmount}, stats = ${statsAmount}`);
        }
    }

    for (const key of Object.keys(state.reserveAmounts)) {
        const storeAmount = storeState.reserveAmounts[key];
        const statsAmount = statsState.reserveAmounts[key];
        if (storeAmount !== statsAmount) {
            console.log(`reserveAmounts[${key}]: store = ${storeAmount}, stats = ${statsAmount}`);
        }
    }

    for (const key of Object.keys(state.reserveAmounts)) {
        const reserveAmount = statsState.reserveAmounts[key];
        const providerAmounts = sumValues(state.providerAmounts, key);
        if (reserveAmount !== providerAmounts) {
            console.log(`${key}: reserveAmount = ${reserveAmount}, providerAmounts = ${providerAmounts}`);
        }
    }
}

async function run() {
    const sourceWeb3 = new Web3(STORE_NODE);
    const targetWeb3 = new Web3(STATS_NODE);

    const store = deployed(sourceWeb3, 'LiquidityProtectionStore', STORE_ADDR);
    const stats = deployed(targetWeb3, 'liquidityProtectionStats', STATS_ADDR);

    const state = await readState(sourceWeb3, store);
    const storeState = await readStoreAmounts(state, store);
    const statsState = await readStatsAmounts(state, stats);

    compare(state, storeState, statsState);

    for (const web3 of [sourceWeb3, targetWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();
