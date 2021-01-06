const fs = require("fs");
const path = require("path");
const Web3 = require("web3");

const SOURCE_NODE   = process.argv[2];
const TARGET_NODE   = process.argv[3];
const STORE_ADDRESS = process.argv[4];
const STORE_BLOCK   = process.argv[5];
const PRIVATE_KEY   = process.argv[6];
const TEST_MODE     = process.argv[7];

const MIN_GAS_LIMIT = 100000;

const CFG_FILE_NAME = "store_migration.json";
const ARTIFACTS_DIR = path.resolve(__dirname, "../build");

const ROLE_SUPERVISOR = Web3.utils.keccak256("ROLE_SUPERVISOR");
const ROLE_SEEDER     = Web3.utils.keccak256("ROLE_SEEDER");

const SOURCE_SLOT = 4;
const TARGET_SLOT = 1;

const READ_BATCH_SIZE = 100;
const READ_TIMEOUT    = 10000;

const WRITE_CONFIG = {
    pls: {batchSize: 20, toTable: toTable2d, methodName: "seedPositions"     },
    lbs: {batchSize: 50, toTable: toTable3d, methodName: "seedLockedBalances"},
    sbs: {batchSize: 80, toTable: toTable2d, methodName: "seedSystemBalances"},
};

const KEYS = Object.keys(WRITE_CONFIG);

const STANDARD_ERRORS = [
    "nonce too low",
    "replacement transaction underpriced",
];

if (!fs.existsSync(CFG_FILE_NAME)) {
    fs.writeFileSync(CFG_FILE_NAME, "{}");
}

if (!fs.existsSync(ARTIFACTS_DIR)) {
    throw new Error("Artifacts not found");
}

fs.copyFileSync("LiquidityProtectionStoreOld.abi", path.resolve(ARTIFACTS_DIR, "LiquidityProtectionStoreOld.abi"));

function getConfig() {
    return JSON.parse(fs.readFileSync(CFG_FILE_NAME), {encoding: "utf8"});
}

function setConfig(record) {
    fs.writeFileSync(CFG_FILE_NAME, JSON.stringify({...getConfig(), ...record}, null, 4));
}

function allZeros(values) {
    return values.every(value => Web3.utils.toBN(value).eqn(0));
}

function isEmpty(object) {
    return Object(object) === object && Object.values(object).every(isEmpty);
}

function toTable2d(state) {
    return Object.entries(state).map(entry => [entry[0], ...entry[1]]);
}

function toTable3d(state) {
    return Object.entries(state).reduce((acc, [key, arrs]) => [...acc, ...arrs.map(arr => [key, ...arr])], []);
}

function setState(state, key, value) {
    console.log(`${key}: ${value}`);
    state[key] = value;
}

function extendState(state, key, value) {
    console.log(`${key}: ${value}`);
    state[key].push(value);
}

function getInnerDiff(prev, curr) {
    const diff = {};
    for (const key in curr) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
            diff[key] = curr[key];
        }
    }
    return diff;
}

function getOuterDiff(keys, prev, curr) {
    return keys.reduce((acc, key) => ({...acc, ...{[key]: getInnerDiff(prev[key], curr[key])}}), {});
}

async function rpc(func) {
    while (true) {
        try {
            return await func.call();
        }
        catch (error) {
            console.log(error.message);
            if (error.message.endsWith("project ID request rate exceeded")) {
                await new Promise(resolve => setTimeout(resolve, READ_TIMEOUT));
            }
            else if (!error.message.startsWith("Invalid JSON RPC response")) {
                throw error;
            }
        }
    }
}

async function getPastEvents(contract, eventName, fromBlock, toBlock, filter) {
    if (fromBlock <= toBlock) {
        try {
            return await contract.getPastEvents(eventName, {fromBlock: fromBlock, toBlock: toBlock, filter: filter});
        }
        catch (error) {
            const midBlock = (fromBlock + toBlock) >> 1;
            const arr1 = await getPastEvents(contract, eventName, fromBlock, midBlock);
            const arr2 = await getPastEvents(contract, eventName, midBlock + 1, toBlock);
            return [...arr1, ...arr2];
        }
    }
    return [];
}

async function scan(message) {
    process.stdout.write(message);
    return await new Promise((resolve, reject) => {
        process.stdin.resume();
        process.stdin.once("data", (data) => {
            process.stdin.pause();
            resolve(data.toString().trim());
        });
    });
}

async function userDecision(options) {
    const message = Object.entries(options).map(entry => `'${entry[0]}' for ${entry[1]}`).join(" or ");
    while (true) {
        const input = await scan(`Enter ${message}: `);
        if (options[input] !== undefined) {
            return input;
        }
    }
}

async function getGasPrice(web3) {
    while (true) {
        const nodeGasPrice = await web3.eth.getGasPrice();
        const userGasPrice = await scan(`Enter gas-price or leave empty to use ${nodeGasPrice}: `);
        if (/^\d+$/.test(userGasPrice)) {
            return userGasPrice;
        }
        if (userGasPrice === "") {
            return nodeGasPrice;
        }
        console.log("Illegal gas-price");
    }
}

async function getTransactionReceipt(web3) {
    while (true) {
        const hash = await scan("Enter transaction-hash or leave empty to retry: ");
        if (/^0x([0-9A-Fa-f]{64})$/.test(hash)) {
            const receipt = await web3.eth.getTransactionReceipt(hash);
            if (receipt) {
                return receipt;
            }
            console.log("Invalid transaction-hash");
        }
        else if (hash) {
            console.log("Illegal transaction-hash");
        }
        else {
            return null;
        }
    }
}

async function send(web3, account, gasPrice, transaction, value = 0) {
    while (true) {
        try {
            const tx = {
                to: transaction._parent._address,
                data: transaction.encodeABI(),
                gas: Math.max(await transaction.estimateGas({from: account.address, value: value}), MIN_GAS_LIMIT),
                gasPrice: gasPrice || (await getGasPrice(web3)),
                chainId: await web3.eth.net.getId(),
                value: value
            };
            const signed = await web3.eth.accounts.signTransaction(tx, account.privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            return receipt;
        }
        catch (error) {
            if (STANDARD_ERRORS.some(suffix => error.message.endsWith(suffix))) {
                console.log(error.message + "; retrying...");
            }
            else {
                console.log(error.message);
                const receipt = await getTransactionReceipt(web3);
                if (receipt) {
                    return receipt;
                }
            }
        }
    }
}

async function deploy(web3, account, gasPrice, contractId, contractName, contractArgs) {
    if (getConfig()[contractId] === undefined) {
        const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".abi"), {encoding: "utf8"});
        const bin = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".bin"), {encoding: "utf8"});
        const contract = new web3.eth.Contract(JSON.parse(abi));
        const options = {data: "0x" + bin, arguments: contractArgs};
        const transaction = contract.deploy(options);
        const receipt = await send(web3, account, gasPrice, transaction);
        const args = transaction.encodeABI().slice(options.data.length);
        console.log(`${contractId} deployed at ${receipt.contractAddress}`);
        setConfig({
            [contractId]: {
                name: contractName,
                addr: receipt.contractAddress,
                args: args
            }
        });
    }
    return deployed(web3, contractName, getConfig()[contractId].addr);
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".abi"), {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function readProtectedLiquidities(store, count) {
    const state = {};

    for (let i = 0; i < count; i += READ_BATCH_SIZE) {
        const ids = [...Array(Math.min(count, READ_BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const pls = await Promise.all(ids.map(id => rpc(store.methods.protectedLiquidity(id))));
        for (let j = 0; j < ids.length; j++) {
            setState(state, ids[j], Object.keys(pls[j]).map(key => pls[j][key]));
        }
    }

    return state;
}

async function readLockedBalances(store, providers) {
    const state = {};

    for (let i = 0; i < providers.length; i += READ_BATCH_SIZE) {
        const indexes = [...Array(Math.min(providers.length, READ_BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const counts = await Promise.all(indexes.map(index => rpc(store.methods.lockedBalanceCount(providers[index]))));
        for (let j = 0; j < indexes.length; j++) {
            setState(state, providers[indexes[j]], [["0", "0"]]);
            if (counts[j] > 0) {
                const lbs = await rpc(store.methods.lockedBalanceRange(providers[indexes[j]], 0, counts[j]));
                for (let k = 0; k < counts[j]; k++) {
                    extendState(state, providers[indexes[j]], [lbs[0][k], lbs[1][k]]);
                }
            }
        }
    }

    return state;
}

async function readSystemBalances(store, tokens) {
    const state = {};

    const balances = await Promise.all(tokens.map(token => rpc(store.methods.systemBalance(token))));
    for (let i = 0; i < tokens.length; i++) {
        setState(state, tokens[i], [balances[i]]);
    }

    return state;
}

async function readState(store, count, providers, tokens) {
    return {
        pls: await readProtectedLiquidities(store, count),
        lbs: await readLockedBalances(store, providers),
        sbs: await readSystemBalances(store, tokens),
    };
}

async function readSource(web3, store) {
    const lastBlock = await web3.eth.getBlockNumber();
    const lbEvents  = await getPastEvents(store, "BalanceLocked", STORE_BLOCK, lastBlock);
    const sbEvents  = await getPastEvents(store, "SystemBalanceUpdated", STORE_BLOCK, lastBlock);
    const count     = await web3.eth.getStorageAt(store._address, SOURCE_SLOT);
    const providers = [...new Set(lbEvents.map(event => event.returnValues._provider))];
    const tokens    = [...new Set(sbEvents.map(event => event.returnValues._token))];
    return await readState(store, count, providers, tokens);
}

async function readTarget(state, store) {
    const count     = Object.keys(state.pls).length;
    const providers = Object.keys(state.lbs);
    const tokens    = Object.keys(state.sbs);
    return await readState(store, count, providers, tokens);
}

async function writeTarget(web3Func, store, config, state, firstTime) {
    const table = config.toTable(state);
    const rows  = table.filter(row => !(firstTime && allZeros(row.slice(1))));
    const cols  = rows[0].map((x, n) => rows.map(row => row[n]));
    const count = Math.ceil(rows.length / config.batchSize);
    for (let i = 0; i < rows.length; i += config.batchSize) {
        const params = cols.map(col => col.slice(i, i + config.batchSize));
        await web3Func(send, store.methods[config.methodName](...params));
        console.log(config.methodName, i / config.batchSize + 1, "out of", count);
    }
}

async function isLocked(web3, store) {
    const owner = await rpc(store.methods.owner());
    const code  = await web3.eth.getCode(owner);
    return code === "0x";
}

async function run() {
    const sourceWeb3 = new Web3(SOURCE_NODE);
    const targetWeb3 = new Web3(TARGET_NODE);

    const gasPrice = await getGasPrice(targetWeb3);
    const account  = targetWeb3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(targetWeb3, account, gasPrice, ...args);

    let phase = 0;
    if (getConfig().phase === undefined) {
        setConfig({phase});
    }

    const execute = async (transaction, ...args) => {
        if (getConfig().phase === phase++) {
            await web3Func(send, transaction, ...args);
            console.log(`phase ${phase} executed`);
            setConfig({phase});
        }
    };

    const sourceStore = deployed(sourceWeb3, "LiquidityProtectionStoreOld", STORE_ADDRESS);
    const targetStore = await web3Func(deploy, "liquidityProtectionStore", "LiquidityProtectionStore", []);
    await execute(targetStore.methods.grantRole(ROLE_SEEDER, account.address));

    targetStore.methods.protectedLiquidity = targetStore.methods.position;

    let sourceState = await readSource(sourceWeb3 , sourceStore);
    let targetState = await readTarget(sourceState, targetStore);

    for (let locked = false; true; ) {
        const diffState = getOuterDiff(KEYS, targetState, sourceState);
        const firstTime = isEmpty(targetState);
        for (const key of KEYS.filter(key => !isEmpty(diffState[key]))) {
            await writeTarget(web3Func, targetStore, WRITE_CONFIG[key], diffState[key], firstTime);
        }
        if (locked) {
            break;
        }
        if ((await userDecision({1: "another iteration", 2: "final iteration"})) === "2") {
            for (locked = TEST_MODE; !locked; locked = await isLocked(sourceWeb3, sourceStore)) {
                await scan("Lock the store and press enter when ready...");
            }
        }
        targetState = sourceState;
        sourceState = await readSource(sourceWeb3, sourceStore);
    }

    targetState = await readTarget(sourceState, targetStore);
    const diffState = getOuterDiff(KEYS, targetState, sourceState);

    if (!isEmpty(diffState)) {
        throw new Error("Data migration failed");
    }

    const sourceNextPositionId = await sourceWeb3.eth.getStorageAt(sourceStore._address, SOURCE_SLOT);
    await execute(targetStore.methods.seedNextPositionId(sourceNextPositionId));
    const targetNextPositionId = await targetWeb3.eth.getStorageAt(targetStore._address, TARGET_SLOT);

    if (sourceNextPositionId !== targetNextPositionId) {
        throw new Error("Next position ID migration failed");
    }

    await execute(targetStore.methods.grantRole(ROLE_SUPERVISOR, await rpc(sourceStore.methods.owner())));
    await execute(targetStore.methods.revokeRole(ROLE_SEEDER, account.address));
    await execute(targetStore.methods.revokeRole(ROLE_SUPERVISOR, account.address));

    for (const web3 of [sourceWeb3, targetWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();