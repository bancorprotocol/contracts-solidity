const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const NODE_ADDRESS = process.argv[2];
const STATS_ADDRESS = process.argv[3];
const PRIVATE_KEY = process.argv[4];

const MIN_GAS_LIMIT = 100000;

const ARTIFACTS_DIR = path.resolve(__dirname, '../build');

const ROLE_SEEDER = Web3.utils.keccak256('ROLE_SEEDER');
const ROLE_SUPERVISOR = Web3.utils.keccak256('ROLE_SUPERVISOR');

const STANDARD_ERRORS = ['nonce too low', 'replacement transaction underpriced'];

if (!fs.existsSync(ARTIFACTS_DIR)) {
    throw new Error('Artifacts not found');
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

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.abi'), { encoding: 'utf8' });
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const stats = deployed(web3, 'LiquidityProtectionStats', STATS_ADDRESS);

    await send(web3, account, gasPrice, stats.methods.renounceRole(ROLE_SEEDER, account.address));
    await send(web3, account, gasPrice, stats.methods.renounceRole(ROLE_SUPERVISOR, account.address));

    if (web3.currentProvider.disconnect) {
        web3.currentProvider.disconnect();
    }
}

run();
