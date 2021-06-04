const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { LedgerSigner } = require('@ethersproject/hardware-wallets');

const runDeployment = require('../test/helpers/runDeployment');

const ARTIFACTS_DIR = path.resolve(__dirname, '../artifacts');
const MIN_GAS_LIMIT = 100000;
const STANDARD_ERRORS = ['nonce too low', 'replacement transaction underpriced'];
const HID = 'hid';

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
    const nodeGasPrice = await web3.eth.getGasPrice();
    const userGasPrice = await scan(`Enter gas-price or leave empty to use ${nodeGasPrice}: `);
    if (/^\d+$/.test(userGasPrice)) {
        return userGasPrice;
    }
    if (userGasPrice === '') {
        return nodeGasPrice;
    }
    throw new Error('Invalid gas price');
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

const getConfig = (configPath) => {
    return JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }));
};

const setConfig = (config, configPath) => {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
};

const main = async () => {
    let web3;
    let config;
    let configPath;
    let gasPrice;
    let signer;

    let phase = 0;

    const send = async (transaction) => {
        while (true) {
            try {
                const signerAddress = await signer.getAddress();
                const {
                    _parent: { _address: to },
                    value
                } = transaction;
                const tx = {
                    to,
                    data: transaction.encodeABI(),
                    nonce: await web3.eth.getTransactionCount(signerAddress),
                    gasLimit: Math.max(await transaction.estimateGas({ from: signerAddress, value }), MIN_GAS_LIMIT),
                    gasPrice,
                    chainId: await web3.eth.getChainId(),
                    value
                };

                const signed = await signer.signTransaction(tx);
                const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction || signed);

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
        if (!config[contractId]) {
            const artifact = getArtifact(contractName);
            const contract = new web3.eth.Contract(artifact.abi);
            const options = { data: artifact.bytecode, arguments: contractArgs };
            const transaction = contract.deploy(options);
            const receipt = await send(transaction);
            const args = transaction.encodeABI().slice(options.data.length);

            console.log(`Deployed ${contractId} (${contractName}) at ${receipt.contractAddress}`);

            config[contractId] = {
                name: contractName,
                addr: receipt.contractAddress,
                args
            };
        }

        return deployed(contractName, config[contractId].addr);
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

    const execute = async (web3, transaction) => {
        if (config.phase !== phase++) {
            return;
        }

        await send(web3, transaction);

        console.log(`Executed phase #${phase}`);

        config.phase = phase;
        setConfig(config, configPath);
    };

    try {
        await yargs(hideBin(process.argv))
            .option('provider', {
                type: 'string',
                demandOption: true,
                description: "Web3 provider's URL"
            })
            .option('configPath', {
                type: 'string',
                demandOption: true,
                description: 'The path to the configuration file'
            })
            .option('key', {
                type: 'string',
                description: 'Deploy via **test*** private key (incompatible with --ledger) '
            })
            .option('ledger', {
                type: 'boolean',
                description: 'Deploy via a Ledger HW (incompatible with --key)'
            })
            .option('ledgerPath', {
                type: 'string',
                default: "m/44'/60'/0'/0",
                description: 'BIP39 path'
            })
            .middleware(({ provider }) => {
                web3 = new Web3(provider);
            })
            .middleware(({ configPath: path }) => {
                configPath = path;
                config = getConfig(configPath);

                if (!config.phase) {
                    config.phase = 0;
                }
            })
            .middleware(async () => {
                gasPrice = await getGasPrice(web3);
            })
            .command(
                'deploy',
                'Deploy the contracts',
                () => {},
                async ({ key, ledger, path }) => {
                    if (key) {
                        signer = web3.eth.accounts.privateKeyToAccount(key);
                        signer.getAddress = async () => signer.address;
                        signer.signTransaction = async (tx) => web3.eth.accounts.signTransaction(tx, signer.privateKey);

                        console.log(`Deploying using a local test key for the address ${signer.address}...`);
                    } else if (ledger) {
                        signer = new LedgerSigner(web3, HID, path);

                        console.log(`Deploying using a Ledger HW for the address ${await signer.getAddress()}...`);
                    } else {
                        throw new Error('Unknown deployment method');
                    }

                    console.log();

                    await runDeployment(signer, deploy, deployed, execute, config);
                }
            )
            .demandCommand()
            .help()
            .parse();
    } catch (e) {
        console.error(e);
    }

    web3.currentProvider.disconnect();
};

main();
