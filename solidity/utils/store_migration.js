const fs = require("fs");
const path = require("path");
const Web3 = require("web3");

const SRC_NODE_URL  = process.argv[2];
const DST_NODE_URL  = process.argv[3];
const STORE_ADDRESS = process.argv[4];
const STORE_BLOCK   = process.argv[5];
const PRIVATE_KEY   = process.argv[6];

const MIN_GAS_LIMIT = 100000;

const CFG_FILE_NAME = "store_migration.json";
const ARTIFACTS_DIR = path.resolve(__dirname, "../build");

const ROLE_SEEDER = Web3.utils.keccak256("ROLE_SEEDER");
const ROLE_OWNER  = Web3.utils.keccak256("ROLE_OWNER");

const OLD_STORE_SLOT  = 4;
const NEW_STORE_SLOT  = 1;

const READ_BATCH_SIZE = 100;
const READ_TIMEOUT    = 10000;

const WRITE_CONFIG = {
    pls: {batchSize: 20, toTable: toTable2d, methodName: "seedProtectedLiquidities"},
    lbs: {batchSize: 80, toTable: toTable3d, methodName: "seedLockedBalances"      },
    sbs: {batchSize: 50, toTable: toTable2d, methodName: "seedSystemBalances"      },
};

if (!fs.existsSync(CFG_FILE_NAME)) {
    fs.writeFileSync(CFG_FILE_NAME, "{}");
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

function toTable2d(state) {
    return Object.entries(state).map(entry => [entry[0], ...entry[1]]);
}

function toTable3d(state) {
    return Object.entries(state).reduce((acc, [key, arrs]) => [...acc, ...arrs.map(arr => [key, ...arr])], []);
}

function setState(state, key, values) {
    console.log(`${key}: ${values}`);
    state[key] = values;
}

function extendState(state, key, values) {
    console.log(`${key}: ${values}`);
    state[key].push(values);
}

function getDiff(prev, curr) {
    const diff = {};
    for (const key in curr) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
            diff[key] = curr[key];
        }
    }
    return diff;
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
            console.log(error.message);
            const receipt = await getTransactionReceipt(web3);
            if (receipt) {
                return receipt;
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

async function readProtectedLiquidities(web3, store, slot) {
    const state = {};

    const count = await web3.eth.getStorageAt(store._address, slot);

    for (let i = 0; i < count; i += READ_BATCH_SIZE) {
        const ids = [...Array(Math.min(count, READ_BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const pls = await Promise.all(ids.map(id => rpc(store.methods.protectedLiquidity(id))));
        for (let j = 0; j < ids.length; j++) {
            setState(state, ids[j], Object.keys(pls[j]).map(key => pls[j][key]));
        }
    }

    return state;
}

async function readLockedBalances(web3, store, lastBlock) {
    const state = {};

    const events = await getPastEvents(store, "BalanceLocked", STORE_BLOCK, lastBlock);
    const providers = [...new Set(events.map(event => event.returnValues._provider))];

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

async function readSystemBalances(web3, store, lastBlock) {
    const state = {};

    const events     = await getPastEvents(store, "SystemBalanceUpdated", STORE_BLOCK, lastBlock);
    const tokens     = [...new Set(events.map(event => event.returnValues._token))];
    const owners     = await Promise.all(tokens.map(token => rpc(deployed(web3, "DSToken", token).methods.owner())));
    const converters = owners.map(owner => deployed(web3, "ConverterBase", owner));
    const reserve0s  = await Promise.all(converters.map(converter => rpc(converter.methods.connectorTokens(0))));
    const reserve1s  = await Promise.all(converters.map(converter => rpc(converter.methods.connectorTokens(1))));

    const systemBalances  = await Promise.all(tokens.map(token => rpc(store.methods.systemBalance(token))));
    const poolAmounts     = await Promise.all(tokens.map(token => rpc(store.methods.totalProtectedPoolAmount(token))));
    const reserve0Amounts = await Promise.all(tokens.map((token, i) => rpc(store.methods.totalProtectedReserveAmount(token, reserve0s[i]))));
    const reserve1Amounts = await Promise.all(tokens.map((token, i) => rpc(store.methods.totalProtectedReserveAmount(token, reserve1s[i]))));

    for (let i = 0; i < tokens.length; i++) {
        setState(state, tokens[i], [
            systemBalances [i],
            poolAmounts    [i],
            reserve0s      [i],
            reserve1s      [i],
            reserve0Amounts[i],
            reserve1Amounts[i],
        ]);
    }

    return state;
}

async function readState(web3, store, slot) {
    const lastBlock = await web3.eth.getBlockNumber();
    return {
        pls: await readProtectedLiquidities(web3, store, slot),
        lbs: await readLockedBalances(web3, store, lastBlock),
        sbs: await readSystemBalances(web3, store, lastBlock),
    };
}

async function writeData(execute, store, config, state, firstTime) {
    const table = config.toTable(state);
    const rows = table.filter(row => !(firstTime && allZeros(row.slice(1))));
    const cols = rows[0].map((x, n) => rows.map(row => row[n]));
    for (let i = 0; i < rows.length; i += config.batchSize) {
        const params = cols.map(col => col.slice(i, i + config.batchSize));
        await execute(store.methods[config.methodName](...params));
    }
}

async function run() {
    const srcWeb3 = new Web3(SRC_NODE_URL);
    const dstWeb3 = new Web3(DST_NODE_URL);

    const gasPrice = await getGasPrice(dstWeb3);
    const account  = dstWeb3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(dstWeb3, account, gasPrice, ...args);

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

    const oldStore = deployed(srcWeb3, "LiquidityProtectionStore", STORE_ADDRESS);
    const newStore = await web3Func(deploy, "liquidityProtectionStore", "LiquidityProtectionStore", []);
    await execute(newStore.methods.grantRole(ROLE_SEEDER, account.address));

    const keys = Object.keys(WRITE_CONFIG);
    let prevState = keys.reduce((acc, key) => ({...acc, ...{[key]: {}}}), {});

    while (true) {
        const currState = await readState(srcWeb3, oldStore, OLD_STORE_SLOT);
        const diffState = keys.reduce((acc, key) => ({...acc, ...{[key]: getDiff(prevState[key], currState[key])}}), {});
        if (isEmpty(diffState)) {
            let status;
            while (status !== "1" && status !== "2") {
                status = await scan("Enter '1' after locking the old store or '2' before locking the new store: ");
            }
            if (status === "1") {
                continue;
            }
            if (status === "2") {
                break;
            }
        }
        for (const key of keys) {
            await writeData(execute, newStore, WRITE_CONFIG[key], diffState[key], isEmpty(prevState));
        }
        prevState = currState;
    }

    const nextProtectedLiquidityId = await srcWeb3.eth.getStorageAt(STORE_ADDRESS, OLD_STORE_SLOT);
    await execute(newStore.methods.setNextProtectedLiquidityId(nextProtectedLiquidityId));

    const owned = deployed(srcWeb3, "Owned", STORE_ADDRESS);
    await execute(newStore.methods.grantRole(ROLE_SEEDER, "0x".padEnd(42, "0")));
    await execute(newStore.methods.grantRole(ROLE_OWNER, await owned.methods.owner().call()));

    for (const web3 of [srcWeb3, dstWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();