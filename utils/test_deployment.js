const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const { providers } = require('ethers');
const { LedgerSigner } = require('@ethersproject/hardware-wallets');

const runDeployment = require('../test/helpers/runDeployment');

const CFG_FILE_NAME = process.argv[2];
const NODE_ADDRESS = process.argv[3];
const PRIVATE_KEY = process.argv[4];

const ARTIFACTS_DIR = path.resolve(__dirname, '../artifacts');

const MIN_GAS_LIMIT = 100000;

const STANDARD_ERRORS = ['nonce too low', 'replacement transaction underpriced'];

const getConfig = () => {
    return JSON.parse(fs.readFileSync(CFG_FILE_NAME, { encoding: 'utf8' }));
};

const setConfig = (record) => {
    fs.writeFileSync(CFG_FILE_NAME, JSON.stringify({ ...getConfig(), ...record }, null, 4));
};

const scan = async (message) => {
    process.stdout.write(message);
    return await new Promise((resolve, reject) => {
        process.stdin.resume();
        process.stdin.once('data', (data) => {
            process.stdin.pause();
            resolve(data.toString().trim());
        });
    });
};

const getGasPrice = async (web3) => {
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
};

const getTransactionReceipt = async (web3) => {
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
};

const send = async (transaction) => {
    while (true) {
        try {
            const tx = {
                to: transaction._parent._address,
                data: transaction.encodeABI(),
                gas: Math.max(
                    await transaction.estimateGas({ from: await signer.getAddress(), value: transaction.value }),
                    MIN_GAS_LIMIT
                ),
                gasPrice: gasPrice || (await getGasPrice(web3)),
                chainId: await web3.eth.net.getId(),
                value: transaction.value
            };
            const signed = await signer.signTransaction(tx);
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
};

const deploy = async (contractId, contractName, ...contractArgs) => {
    if (getConfig()[contractId] === undefined) {
        const artifact = getArtifact(contractName);
        const contract = new web3.eth.Contract(artifact.abi);
        const options = { data: artifact.bytecode, arguments: contractArgs };
        const transaction = contract.deploy(options);
        const receipt = await send(transaction);
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
    return deployed(contractName, getConfig()[contractId].addr);
};

const deployed = (contractName, contractAddr) => {
    const artifact = getArtifact(contractName);
    const contract = new web3.eth.Contract(artifact.abi, contractAddr);
    contract.address = contract._address;
    for (const obj of artifact.abi) {
        if (obj.type === 'function') {
            switch (obj.stateMutability) {
                case 'pure':
                case 'view':
                    contract[obj.name] = (...args) => contract.methods[obj.name](...args).call();
                    break;
                case 'nonpayable':
                    contract[obj.name] = contract.methods[obj.name];
                    break;
                case 'payable':
                    contract[obj.name] = (...args) => ({
                        ...contract.methods[obj.name](...args.slice(0, -1)),
                        value: args[args.length - 1].value
                    });
                    break;
            }
        }
    }
    return contract;
};

const getArtifact = (artifactName) => {
    const getPathNames = (dirName) => {
        let pathNames = [];
        for (const fileName of fs.readdirSync(dirName)) {
            const pathName = path.join(dirName, fileName);
            if (fs.statSync(pathName).isDirectory()) {
                pathNames = pathNames.concat(getPathNames(pathName));
            } else {
                pathNames.push(pathName);
            }
        }
        return pathNames;
    };

    for (const pathName of getPathNames(ARTIFACTS_DIR)) {
        if (path.basename(pathName) === artifactName + '.json') {
            return JSON.parse(fs.readFileSync(pathName, { encoding: 'utf8' }));
        }
    }

    throw new Error(`${artifactName} artifact not found`);
};

let web3;
let gasPrice;
let signer;
const isLedger = !PRIVATE_KEY;

const run = async () => {
    try {
        web3 = new Web3(NODE_ADDRESS);

        if (!isLedger) {
            console.log('Deploying using a local test key...');

            signer = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
            signer.getAddress = async () => signer.address;
            signer.signTransaction = async (tx) => web3.eth.accounts.signTransaction(tx, signer.privateKey);
        } else {
            console.log('Deploying using a Ledger HW...');

            const type = 'hid';
            const path = `m/44'/60'/0'/0/0`;
            signer = new LedgerSigner(web3, type, path);
        }

        console.log();

        console.log('address', await signer.getAddress());

        gasPrice = await getGasPrice(web3);

        let phase = 0;
        if (getConfig().phase === undefined) {
            setConfig({ phase });
        }

        const execute = async (transaction) => {
            if (getConfig().phase === phase++) {
                await send(transaction);
                console.log(`phase ${phase} executed`);
                setConfig({ phase });
            }
        };

        await runDeployment(
            signer,
            deploy,
            deployed,
            execute,
            getConfig,
            Web3.utils.keccak256,
            Web3.utils.asciiToHex,
            web3.eth.getTransactionCount
        );
    } catch (error) {
        console.error(error);
    }

    web3.currentProvider.disconnect();
};

run();
