const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const SOURCE_NODE = process.argv[2];
const TARGET_NODE = process.argv[3];
const ADMIN_ADDRESS = process.argv[4];
const SETTINGS_ADDRESS = process.argv[5];
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

    const migrator = await web3Func(deploy, 'liquidityProtectionSettingsMigrator', 'LiquidityProtectionSettingsMigrator', []);
    const sourceSettings = deployed(sourceWeb3, 'LiquidityProtectionSettings', SETTINGS_ADDRESS);
    const targetSettings = await web3Func(deploy, 'liquidityProtectionSettings', 'LiquidityProtectionSettings', [
        await rpc(sourceSettings.methods.networkToken()),
        await rpc(sourceSettings.methods.registry())
    ]);

    await execute(targetSettings.methods.grantRole(ROLE_OWNER, ADMIN_ADDRESS));
    await execute(targetSettings.methods.grantRole(ROLE_OWNER, migrator._address));
    await execute(migrator.methods.migrate(sourceSettings._address, targetSettings._address));

    const sourcePools = await rpc(sourceSettings.methods.poolWhitelist());
    const targetPools = await rpc(targetSettings.methods.poolWhitelist());
    const sourceLimits = await Promise.all(sourcePools.map(pool => rpc(sourceSettings.methods.networkTokenMintingLimits(pool))));
    const targetLimits = await Promise.all(targetPools.map(pool => rpc(targetSettings.methods.networkTokenMintingLimits(pool))));

    if (sourcePools.join(',') === targetPools.join(',') && sourceLimits.join(',') === targetLimits.join(',')) {
        await execute(targetSettings.methods.renounceRole(ROLE_OWNER, account.address));
        console.log('migration completed successfully');
    }
    else {
        console.log('migration completed unsuccessfully:');
        console.log(`sourcePools = ${sourcePools}`);
        console.log(`targetPools = ${targetPools}`);
        console.log(`sourceLimits = ${sourceLimits}`);
        console.log(`targetLimits = ${targetLimits}`);
    }

    for (const web3 of [sourceWeb3, targetWeb3]) {
        if (web3.currentProvider.disconnect) {
            web3.currentProvider.disconnect();
        }
    }
}

run();
