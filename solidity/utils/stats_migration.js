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

const CFG_FILE_NAME = "stats_migration.json";
const ARTIFACTS_DIR = path.resolve(__dirname, "../build");

const ROLE_SUPERVISOR = Web3.utils.keccak256("ROLE_SUPERVISOR");
const ROLE_SEEDER     = Web3.utils.keccak256("ROLE_SEEDER");

const STORAGE_SLOT = 4;

const READ_BATCH_SIZE = 100;
const READ_TIMEOUT    = 10000;

const WRITE_CONFIG = {
    poolAmounts    : {batchSize: 80, methodName: "seedPoolAmounts"    },
    reserveAmounts : {batchSize: 70, methodName: "seedReserveAmounts" },
    providerAmounts: {batchSize: 60, methodName: "seedProviderAmounts"},
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

function addressKeys(object) {
    return Object.keys(object).filter(Web3.utils.isAddress);
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

async function send(web3, account, gasPrice, transaction) {
    while (true) {
        try {
            const options = {
                to      : transaction._parent._address,
                data    : transaction.encodeABI(),
                gas     : Math.max(await transaction.estimateGas({from: account.address}), MIN_GAS_LIMIT),
                gasPrice: gasPrice
            };
            const signed  = await web3.eth.accounts.signTransaction(options, account.privateKey);
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
        setConfig({[contractId]: {name: contractName, addr: receipt.contractAddress, args: args}});
    }
    return deployed(web3, contractName, getConfig()[contractId].addr);
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".abi"), {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function readSource(web3, store) {
    const state = {};
    const count = await web3.eth.getStorageAt(store._address, STORAGE_SLOT);

    for (let i = 0; i < count; i += READ_BATCH_SIZE) {
        const ids = [...Array(Math.min(count, READ_BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const pls = await Promise.all(ids.map(id => rpc(store.methods.protectedLiquidity(id))));

        for (const pl of pls) {
            console.log(JSON.stringify(pl));

            const provider      = pl[0];
            const poolToken     = pl[1];
            const reserveToken  = pl[2];
            const poolAmount    = Web3.utils.toBN(pl[3]);
            const reserveAmount = Web3.utils.toBN(pl[4]);

            if (state[poolToken] === undefined) {
                state[poolToken] = {amount: Web3.utils.toBN(0)};
            }

            if (state[poolToken][reserveToken] === undefined) {
                state[poolToken][reserveToken] = {amount: Web3.utils.toBN(0)};
            }

            if (state[poolToken][reserveToken][provider] === undefined) {
                state[poolToken][reserveToken][provider] = {amount: Web3.utils.toBN(0)};
            }

            state[poolToken].amount = state[poolToken].amount.add(poolAmount);
            state[poolToken][reserveToken].amount = state[poolToken][reserveToken].amount.add(reserveAmount);
            state[poolToken][reserveToken][provider].amount = state[poolToken][reserveToken][provider].amount.add(reserveAmount);
        }
    }

    const poolAmounts = [];
    const reserveAmounts = [];
    const providerAmounts = [];

    for (const poolToken of addressKeys(state)) {
        poolAmounts.push([poolToken, state[poolToken].amount.toString()]);
        for (const reserveToken of addressKeys(state[poolToken])) {
            reserveAmounts.push([poolToken, reserveToken, state[poolToken][reserveToken].amount.toString()]);
            for (const provider of addressKeys(state[poolToken][reserveToken])) {
                providerAmounts.push([poolToken, reserveToken, provider, state[poolToken][reserveToken][provider].amount.toString()]);
            }
        }
    }

    return {poolAmounts, reserveAmounts, providerAmounts};
}

async function readTargetAmounts(params, func) {
    const amounts = [];
    for (let i = 0; i < params.length; i += READ_BATCH_SIZE) {
        const inputs = params.slice(i, i + READ_BATCH_SIZE);
        const outputs = await Promise.all(inputs.map(args => rpc(func(...args))));
        for (let j = 0; j < inputs.length; j++) {
            amounts.push([...inputs[j], outputs[j]]);
        }
    }
    return amounts
}

async function readTarget(state, stats) {
    const totalPoolAmountParams = [];
    const totalReserveAmountParams = [];
    const totalProviderAmountParams = [];

    for (const poolToken in state) {
        totalPoolAmountParams.push([poolToken]);
        for (const reserveToken in state[poolToken]) {
            totalReserveAmountParams.push([poolToken, reserveToken]);
            for (const provider in state[poolToken][reserveToken]) {
                totalProviderAmountParams.push([poolToken, reserveToken, provider]);
            }
        }
    }

    return {
        poolAmounts: await readTargetAmounts(totalPoolAmountParams, stats.methods.totalPoolAmount),
        reserveAmounts: await readTargetAmounts(totalReserveAmountParams, stats.methods.totalReserveAmount),
        providerAmounts: await readTargetAmounts(totalProviderAmountParams, stats.methods.totalProviderAmount),
    };
}

async function writeTarget(web3Func, stats, config, table, firstTime) {
    const rows  = table.filter(row => !(firstTime && allZeros(row.slice(1))));
    const cols  = rows[0].map((x, n) => rows.map(row => row[n]));
    const count = Math.ceil(rows.length / config.batchSize);
    for (let i = 0; i < rows.length; i += config.batchSize) {
        const params = cols.map(col => col.slice(i, i + config.batchSize));
        await web3Func(send, stats.methods[config.methodName](...params));
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

    const store = deployed(sourceWeb3, "LiquidityProtectionStore", STORE_ADDRESS);
    const stats = await web3Func(deploy, "liquidityProtectionStats", "LiquidityProtectionStats", []);
    await execute(stats.methods.grantRole(ROLE_SEEDER, account.address));

    let sourceState = await readSource(sourceWeb3 , store);
    let targetState = await readTarget(sourceState, stats);

    for (let locked = false; true; ) {
        const diffState = getOuterDiff(KEYS, targetState, sourceState);
        const firstTime = isEmpty(targetState);
        for (const key of KEYS.filter(key => !isEmpty(diffState[key]))) {
            await writeTarget(web3Func, stats, WRITE_CONFIG[key], diffState[key], firstTime);
        }
        if (locked) {
            break;
        }
        if ((await userDecision({1: "another iteration", 2: "final iteration"})) === "2") {
            for (locked = TEST_MODE; !locked; locked = await isLocked(sourceWeb3, store)) {
                await scan("Lock the store and press enter when ready...");
            }
        }
        targetState = sourceState;
        sourceState = await readSource(sourceWeb3, store);
    }

    targetState = await readTarget(sourceState, stats);
    const diffState = getOuterDiff(KEYS, targetState, sourceState);

    if (!isEmpty(diffState)) {
        throw new Error("Data migration failed");
    }

    const sourceNextPositionId = await sourceWeb3.eth.getStorageAt(store._address, SOURCE_SLOT);
    await execute(stats.methods.seedNextPositionId(sourceNextPositionId));
    const targetNextPositionId = await targetWeb3.eth.getStorageAt(stats._address, TARGET_SLOT);

    if (sourceNextPositionId !== targetNextPositionId) {
        throw new Error("Next position ID migration failed");
    }

    await execute(stats.methods.grantRole(ROLE_SUPERVISOR, await rpc(store.methods.owner())));
    await execute(stats.methods.revokeRole(ROLE_SEEDER, account.address));
    await execute(stats.methods.revokeRole(ROLE_SUPERVISOR, account.address));

    for (const web3 of [sourceWeb3, targetWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();