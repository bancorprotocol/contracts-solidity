const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const SOURCE_NODE = process.argv[2];
const TARGET_NODE = process.argv[3];
const ADMIN_ADDRESS = process.argv[4];
const STORE_ADDRESS = process.argv[5];
const PRIVATE_KEY = process.argv[6];

const MIN_GAS_LIMIT = 100000;

const CFG_FILE_NAME = 'user_store_migration.json';
const ARTIFACTS_DIR = path.resolve(__dirname, '../build');

const ROLE_SEEDER = Web3.utils.keccak256('ROLE_SEEDER');
const ROLE_SUPERVISOR = Web3.utils.keccak256('ROLE_SUPERVISOR');

const READ_TIMEOUT = 10000;
const READ_BATCH_SIZE = 100;
const WRITE_BATCH_SIZE = 50;

const STANDARD_ERRORS = ['nonce too low', 'replacement transaction underpriced'];

if (!fs.existsSync(CFG_FILE_NAME)) {
    fs.writeFileSync(CFG_FILE_NAME, '{}');
}

if (!fs.existsSync(ARTIFACTS_DIR)) {
    throw new Error('Artifacts not found');
}

function getConfig() {
    return JSON.parse(fs.readFileSync(CFG_FILE_NAME), { encoding: 'utf8' });
}

function setConfig(record) {
    fs.writeFileSync(CFG_FILE_NAME, JSON.stringify({ ...getConfig(), ...record }, null, 4));
}

function allZeros(values) {
    return values.every((value) => Web3.utils.toBN(value).eqn(0));
}

function isEmpty(object) {
    return Object(object) === object && Object.values(object).every(isEmpty);
}

function setState(state, key, value) {
    console.log(`${key}: ${value}`);
    state[key] = value;
}

function extendState(state, key, value) {
    console.log(`${key}: ${value}`);
    state[key].push(value);
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

async function getPastEvents(contract, eventName, fromBlock, toBlock, filter) {
    if (fromBlock <= toBlock) {
        try {
            return await contract.getPastEvents(eventName, { fromBlock, toBlock, filter });
        } catch (error) {
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
        process.stdin.once('data', (data) => {
            process.stdin.pause();
            resolve(data.toString().trim());
        });
    });
}

async function userDecision(options) {
    const message = Object.entries(options)
        .map((entry) => `'${entry[0]}' ${entry[1]}`)
        .join(' or ');
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
        if (userGasPrice === '') {
            return nodeGasPrice;
        }
        console.log('Illegal gas-price');
    }
}

async function getTransactionReceipt(web3) {
    while (true) {
        const hash = await scan('Enter transaction-hash or leave empty to retry: ');
        if (/^0x([0-9A-Fa-f]{64})$/.test(hash)) {
            const receipt = await web3.eth.getTransactionReceipt(hash);
            if (receipt) {
                return receipt;
            }
            console.log('Invalid transaction-hash');
        } else if (hash) {
            console.log('Illegal transaction-hash');
        } else {
            return null;
        }
    }
}

async function send(web3, account, gasPrice, transaction) {
    while (true) {
        try {
            const options = {
                to: transaction._parent._address,
                data: transaction.encodeABI(),
                gas: Math.max(await transaction.estimateGas({ from: account.address }), MIN_GAS_LIMIT),
                gasPrice: gasPrice
            };
            const signed = await web3.eth.accounts.signTransaction(options, account.privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            return receipt;
        } catch (error) {
            if (STANDARD_ERRORS.some((suffix) => error.message.endsWith(suffix))) {
                console.log(error.message + '; retrying...');
            } else {
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
        const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.abi'), { encoding: 'utf8' });
        const bin = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.bin'), { encoding: 'utf8' });
        const contract = new web3.eth.Contract(JSON.parse(abi));
        const options = { data: '0x' + bin, arguments: contractArgs };
        const transaction = contract.deploy(options);
        const receipt = await send(web3, account, gasPrice, transaction);
        const args = transaction.encodeABI().slice(options.data.length);
        console.log(`${contractId} deployed at ${receipt.contractAddress}`);
        setConfig({ [contractId]: { name: contractName, addr: receipt.contractAddress, args: args } });
    }
    return deployed(web3, contractName, getConfig()[contractId].addr);
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.abi'), { encoding: 'utf8' });
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function readState(contract, providers) {
    const state = {};

    for (let i = 0; i < providers.length; i += READ_BATCH_SIZE) {
        const indexes = [...Array(Math.min(providers.length, READ_BATCH_SIZE + i) - i).keys()].map((n) => n + i);
        const counts = await Promise.all(
            indexes.map((index) => rpc(contract.methods.lockedBalanceCount(providers[index])))
        );
        for (let j = 0; j < indexes.length; j++) {
            setState(state, providers[indexes[j]], [['0', '0']]);
            if (counts[j] > 0) {
                const lbs = await rpc(contract.methods.lockedBalanceRange(providers[indexes[j]], 0, counts[j]));
                for (let k = 0; k < counts[j]; k++) {
                    extendState(state, providers[indexes[j]], [lbs[0][k], lbs[1][k]]);
                }
            }
        }
    }

    return state;
}

async function readSource(web3, source) {
    const block = await web3.eth.getBlockNumber();
    const events = await getPastEvents(source, 'BalanceLocked', 0, block);
    const providers = [...new Set(events.map((event) => event.returnValues._provider))];
    return await readState(source, providers);
}

async function readTarget(state, target) {
    const providers = Object.keys(state);
    return await readState(target, providers);
}

async function writeTarget(web3Func, target, state, firstTime) {
    const table = Object.entries(state).reduce((acc, [key, arrs]) => [...acc, ...arrs.map((arr) => [key, ...arr])], []);
    const rows = table.filter((row) => !(firstTime && allZeros(row.slice(1))));
    const cols = rows[0].map((x, n) => rows.map((row) => row[n]));
    const count = Math.ceil(rows.length / WRITE_BATCH_SIZE);
    for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
        const params = cols.map((col) => col.slice(i, i + WRITE_BATCH_SIZE));
        await web3Func(send, target.methods.seedLockedBalances(...params));
        console.log(`${i / WRITE_BATCH_SIZE + 1} out of ${count}`);
    }
}

async function run() {
    const sourceWeb3 = new Web3(SOURCE_NODE);
    const targetWeb3 = new Web3(TARGET_NODE);

    const gasPrice = await getGasPrice(targetWeb3);
    const account = targetWeb3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(targetWeb3, account, gasPrice, ...args);

    let phase = 0;
    if (getConfig().phase === undefined) {
        setConfig({ phase });
    }

    const execute = async (transaction, ...args) => {
        if (getConfig().phase === phase++) {
            await web3Func(send, transaction, ...args);
            console.log(`phase ${phase} executed`);
            setConfig({ phase });
        }
    };

    const source = deployed(sourceWeb3, 'LiquidityProtectionStore', STORE_ADDRESS);
    const target = await web3Func(deploy, 'liquidityProtectionUserStore', 'LiquidityProtectionUserStore', [
        await web3.eth.getStorageAt(source._address, 4)
    ]);
    await execute(target.methods.grantRole(ROLE_SEEDER, account.address));
    await execute(target.methods.grantRole(ROLE_SUPERVISOR, ADMIN_ADDRESS));

    let sourceState = await readSource(sourceWeb3, source);
    let targetState = await readTarget(sourceState, target);

    while (true) {
        const diffState = getDiff(targetState, sourceState);
        if (!isEmpty(diffState)) {
            await writeTarget(web3Func, target, diffState, isEmpty(targetState));
        }
        if ((await userDecision({ 1: 'for another iteration', 2: 'for conclusion' })) === '2') {
            break;
        }
        targetState = sourceState;
        sourceState = await readSource(sourceWeb3, source);
    }

    targetState = await readTarget(sourceState, target);
    const diffState = getDiff(targetState, sourceState);
    console.log('Differences:', JSON.stringify(diffState, null, 4));

    for (const web3 of [sourceWeb3, targetWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();
