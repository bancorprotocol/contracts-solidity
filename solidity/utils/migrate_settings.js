const fs = require('fs');
const path = require('path');
const Web3 = require('web3');
const rlp = require('rlp');

const SOURCE_NODE = process.argv[2];
const TARGET_NODE = process.argv[3];
const ADMIN_ADDRESS = process.argv[4];
const SOURCE_ADDRESS = process.argv[5];
const PRIVATE_KEY = process.argv[6];

const MIN_GAS_LIMIT = 100000;

const CFG_FILE_NAME = 'settings_migration.json';
const ARTIFACTS_DIR = path.resolve(__dirname, '../build');

const ROLE_OWNER = Web3.utils.keccak256('ROLE_OWNER');

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

function encode(address) {
    return address.slice(2).padStart(64, '0').toLowerCase();
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

async function readState(settings) {
    const networkToken = await rpc(settings.methods.networkToken());
    const registry = await rpc(settings.methods.registry());
    const pools = await rpc(settings.methods.poolWhitelist());
    const limits = await Promise.all(pools.map(pool => rpc(settings.methods.networkTokenMintingLimits(pool))));
    return {networkToken, registry, pools, limits};
}

async function run() {
    const sourceWeb3 = new Web3(SOURCE_NODE);
    const targetWeb3 = new Web3(TARGET_NODE);

    const gasPrice = await getGasPrice(targetWeb3);
    const account = targetWeb3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

    const source = deployed(sourceWeb3, 'LiquidityProtectionSettings', SOURCE_ADDRESS);
    const sourceState = await readState(source);

    const migrator = await deploy(
        targetWeb3,
        account,
        gasPrice,
        'migrator',
        'LiquidityProtectionSettingsMigrator',
        [sourceState.networkToken, sourceState.registry, sourceState.pools, sourceState.limits, ADMIN_ADDRESS]
    );

    const targetAddress = '0x' + Web3.utils.sha3(rlp.encode([migrator._address, 1])).slice(26);
    const target = deployed(targetWeb3, 'LiquidityProtectionSettings', targetAddress);
    const targetState = await readState(target);

    const sourceStateString = JSON.stringify(sourceState, null, 4);
    const targetStateString = JSON.stringify(targetState, null, 4);

    const adminIsOwner = await rpc(target.methods.hasRole(ROLE_OWNER, ADMIN_ADDRESS));
    const migratorIsOwner = await rpc(target.methods.hasRole(ROLE_OWNER, migrator._address));

    if (sourceStateString !== targetStateString) {
        console.error('data migration failed:');
        console.error('source =', sourceStateString);
        console.error('target =', targetStateString);
    }

    if (!adminIsOwner) {
        console.error('admin is not the owner');
    }

    if (migratorIsOwner) {
        console.error('migrator is still the owner');
    }

    console.log('settings deployed at', target._address);

    setConfig({
        name: 'LiquidityProtectionSettings',
        addr: target._address,
        args: encode(targetState.networkToken) + encode(targetState.registry)
    });

    for (const web3 of [sourceWeb3, targetWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();
