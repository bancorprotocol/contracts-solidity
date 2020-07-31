const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const CFG_FILE_NAME = process.argv[2];
const NODE_ADDRESS = process.argv[3];
const PRIVATE_KEY = process.argv[4];

const ARTIFACTS_DIR = path.resolve(__dirname, '../build');

const MIN_GAS_LIMIT = 100000;

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
        }
        else if (hash) {
            console.log('Illegal transaction-hash');
        }
        else {
            return null;
        }
    }
};

const send = async (web3, account, gasPrice, transaction, value = 0) => {
    while (true) {
        try {
            const tx = {
                to: transaction._parent._address,
                data: transaction.encodeABI(),
                gas: Math.max(await transaction.estimateGas({ from: account.address, value: value }), MIN_GAS_LIMIT),
                gasPrice: gasPrice || await getGasPrice(web3),
                chainId: await web3.eth.net.getId(),
                value: value
            };
            const signed = await web3.eth.accounts.signTransaction(tx, account.privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            return receipt;
        } catch (error) {
            console.log(error.message);
            const receipt = await getTransactionReceipt(web3);
            if (receipt) {
                return receipt;
            }
        }
    }
};

const deploy = async (web3, account, gasPrice, contractId, contractName, contractArgs) => {
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
};

const deployed = (web3, contractName, contractAddr) => {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.abi'), { encoding: 'utf8' });
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
};

const decimalToInteger = (value, decimals) => {
    const parts = [...value.split('.'), ''];
    return parts[0] + parts[1].padEnd(decimals, '0');
};

const percentageToPPM = (value) => {
    return decimalToInteger(value.replace('%', ''), 4);
};

const run = async () => {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(web3, account, gasPrice, ...args);

    const addresses = { ETH: Web3.utils.toChecksumAddress('0x'.padEnd(42, 'e')) };
    const tokenDecimals = { ETH: 18 };

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

    // main contracts
    const contractRegistryAddress = '0x52Ae12ABe5D8BD778BD5397F99cA900624CfADD4';
    const converterFactory = await web3Func(deploy, 'converterFactory', 'ConverterFactory', []);
    const bancorFormula = await web3Func(deploy, 'bancorFormula', 'BancorFormula', []);
    const converterUpgrader = await web3Func(deploy, 'converterUpgrader', 'ConverterUpgrader', [contractRegistryAddress, addresses.ETH]);
    const liquidTokenConverterFactory = await web3Func(deploy, 'liquidTokenConverterFactory', 'LiquidTokenConverterFactory', []);
    const liquidityPoolV1ConverterFactory = await web3Func(deploy, 'liquidityPoolV1ConverterFactory', 'LiquidityPoolV1ConverterFactory', []);
    const liquidityPoolV2ConverterFactory = await web3Func(deploy, 'liquidityPoolV2ConverterFactory', 'LiquidityPoolV2ConverterFactory', []);
    const liquidityPoolV2ConverterAnchorFactory = await web3Func(deploy, 'liquidityPoolV2ConverterAnchorFactory', 'LiquidityPoolV2ConverterAnchorFactory', []);
    const liquidityPoolV2ConverterCustomFactory = await web3Func(deploy, 'liquidityPoolV2ConverterCustomFactory', 'LiquidityPoolV2ConverterCustomFactory', []);
    await web3Func(deploy, 'oracleWhitelist', 'Whitelist', []);
    await web3Func(deploy, 'ethToEthOracle', 'ChainlinkETHToETHOracle', []);

    // contract deployment for etherscan verification only
    const smartToken = await web3Func(deploy, 'smartToken', 'SmartToken', ["Token1", "TKN1", 18]);
    const smartToken2 = await web3Func(deploy, 'smartToken2', 'SmartToken', ["Token2", "TKN2", 18]);
    const poolTokensContainer = await web3Func(deploy, 'poolTokensContainer', 'PoolTokensContainer', ["Pool", "POOL", 18]);
    const chainlinkOracle1 = await web3Func(deploy, 'chainlinkOracle1', 'ChainlinkETHToETHOracle', []);
    const chainlinkOracle2 = await web3Func(deploy, 'chainlinkOracle2', 'ChainlinkETHToETHOracle', []);
    await web3Func(deploy, 'priceOracle', 'PriceOracle', [smartToken._address, smartToken2._address, chainlinkOracle1._address, chainlinkOracle2._address]);
    await web3Func(deploy, 'liquidTokenConverter', 'LiquidTokenConverter', [smartToken._address, contractRegistryAddress, 1000]);
    await web3Func(deploy, 'liquidityPoolV1Converter', 'LiquidityPoolV1Converter', [smartToken2._address, contractRegistryAddress, 1000]);
    await web3Func(deploy, 'liquidityPoolV2Converter', 'LiquidityPoolV2Converter', [poolTokensContainer._address, contractRegistryAddress, 1000]);

    // initialize converter factory
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidTokenConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidityPoolV1ConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidityPoolV2ConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterAnchorFactory(liquidityPoolV2ConverterAnchorFactory._address));
    await execute(converterFactory.methods.registerTypedConverterCustomFactory(liquidityPoolV2ConverterCustomFactory._address));

    await execute(bancorFormula.methods.init());

    if (web3.currentProvider.constructor.name === 'WebsocketProvider') {
        web3.currentProvider.connection.close();
    }
};

run();
