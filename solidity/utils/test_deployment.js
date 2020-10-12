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
        }
        catch (error) {
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

    const reserves = {
        ETH: {
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            decimals: 18
        }
    };

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
    const contractRegistry = await web3Func(deploy, 'contractRegistry', 'ContractRegistry', []);
    const converterFactory = await web3Func(deploy, 'converterFactory', 'ConverterFactory', []);
    const bancorFormula = await web3Func(deploy, 'bancorFormula', 'BancorFormula', []);
    const bancorNetwork = await web3Func(deploy, 'bancorNetwork', 'BancorNetwork', [contractRegistry._address]);
    const conversionPathFinder = await web3Func(deploy, 'conversionPathFinder', 'ConversionPathFinder', [contractRegistry._address]);
    const converterUpgrader = await web3Func(deploy, 'converterUpgrader', 'ConverterUpgrader', [contractRegistry._address, reserves.ETH.address]);
    const converterRegistry = await web3Func(deploy, 'converterRegistry', 'ConverterRegistry', [contractRegistry._address]);
    const converterRegistryData = await web3Func(deploy, 'converterRegistryData', 'ConverterRegistryData', [contractRegistry._address]);
    const liquidTokenConverterFactory = await web3Func(deploy, 'liquidTokenConverterFactory', 'LiquidTokenConverterFactory', []);
    const liquidityPoolV1ConverterFactory = await web3Func(deploy, 'liquidityPoolV1ConverterFactory', 'LiquidityPoolV1ConverterFactory', []);
    const liquidityPoolV2ConverterFactory = await web3Func(deploy, 'liquidityPoolV2ConverterFactory', 'LiquidityPoolV2ConverterFactory', []);
    const liquidityPoolV2ConverterAnchorFactory = await web3Func(deploy, 'liquidityPoolV2ConverterAnchorFactory', 'LiquidityPoolV2ConverterAnchorFactory', []);
    const liquidityPoolV2ConverterCustomFactory = await web3Func(deploy, 'liquidityPoolV2ConverterCustomFactory', 'LiquidityPoolV2ConverterCustomFactory', []);
    const whitelist = await web3Func(deploy, 'whitelist', 'Whitelist', []);

    // contract deployment for etherscan verification only
    const poolToken1 = await web3Func(deploy, 'poolToken1', 'DSToken', ['Token1', 'TKN1', 18]);
    const poolToken2 = await web3Func(deploy, 'poolToken2', 'DSToken', ['Token2', 'TKN2', 18]);
    const poolTokensContainer = await web3Func(deploy, 'poolTokensContainer', 'PoolTokensContainer', ['Pool', 'POOL', 18]);
    const chainlinkOracle1 = await web3Func(deploy, 'chainlinkOracle1', 'ChainlinkETHToETHOracle', []);
    const chainlinkOracle2 = await web3Func(deploy, 'chainlinkOracle2', 'ChainlinkETHToETHOracle', []);
    await web3Func(deploy, 'priceOracle', 'PriceOracle', [poolToken1._address, poolToken2._address, chainlinkOracle1._address, chainlinkOracle2._address]);
    await web3Func(deploy, 'liquidTokenConverter', 'LiquidTokenConverter', [poolToken1._address, contractRegistry._address, 1000]);
    await web3Func(deploy, 'liquidityPoolV1Converter', 'LiquidityPoolV1Converter', [poolToken2._address, contractRegistry._address, 1000]);
    await web3Func(deploy, 'liquidityPoolV2Converter', 'LiquidityPoolV2Converter', [poolTokensContainer._address, contractRegistry._address, 1000]);

    // initialize contract registry
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('ContractRegistry'), contractRegistry._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('ConverterFactory'), converterFactory._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorFormula'), bancorFormula._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorNetwork'), bancorNetwork._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('ConversionPathFinder'), conversionPathFinder._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorConverterUpgrader'), converterUpgrader._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorConverterRegistry'), converterRegistry._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorConverterRegistryData'), converterRegistryData._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('ChainlinkOracleWhitelist'), whitelist._address));

    // initialize converter factory
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidTokenConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidityPoolV1ConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidityPoolV2ConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterAnchorFactory(liquidityPoolV2ConverterAnchorFactory._address));
    await execute(converterFactory.methods.registerTypedConverterCustomFactory(liquidityPoolV2ConverterCustomFactory._address));

    for (const reserve of getConfig().reserves) {
        if (reserve.type === undefined) {
            const token = deployed(web3, 'ERC20Token', reserve.address);
            const symbol = await token.methods.symbol().call();
            const decimals = await token.methods.decimals().call();
            reserves[symbol] = { address: token._address, decimals: decimals };
        }
        if (reserve.type === 0) {
            const name = reserve.symbol + ' ERC20 Token';
            const symbol = reserve.symbol;
            const decimals = reserve.decimals;
            const supply = decimalToInteger(reserve.supply, decimals);
            const token = await web3Func(deploy, 'erc20Token-' + symbol, 'ERC20Token', [name, symbol, decimals, supply]);
            reserves[symbol] = { address: token._address, decimals: decimals };
        }
        if (reserve.type === 1) {
            const name = reserve.symbol + ' DS Token';
            const symbol = reserve.symbol;
            const decimals = reserve.decimals;
            const supply = decimalToInteger(reserve.supply, decimals);
            const nonce = await web3.eth.getTransactionCount(account.address);
            const token = await web3Func(deploy, 'dsToken-' + symbol, 'DSToken', [name, symbol, decimals]);
            if (nonce !== await web3.eth.getTransactionCount(account.address)) {
                await execute(token.methods.issue(account.address, supply));
            }
            reserves[symbol] = { address: token._address, decimals: decimals };
        }
    }

    for (const [converter, index] of getConfig().converters.map((converter, index) => [converter, index])) {
        const type = converter.type;
        const name = converter.symbol + (type === 0 ? ' Liquid Token' : ' Liquidity Pool');
        const symbol = converter.symbol;
        const decimals = converter.decimals;
        const fee = percentageToPPM(converter.fee);
        const tokens = converter.reserves.map(reserve => reserves[reserve.symbol].address);
        const weights = converter.reserves.map(reserve => percentageToPPM(reserve.weight));
        const amounts = converter.reserves.map(reserve => decimalToInteger(reserve.balance, reserves[reserve.symbol].decimals));
        const value = amounts[converter.reserves.findIndex(reserve => reserve.symbol === 'ETH')];

        await execute(converterRegistry.methods.newConverter(type, name, symbol, decimals, percentageToPPM('100%'), tokens, weights));
        const converterAnchor = deployed(web3, 'IConverterAnchor', (await converterRegistry.methods.getAnchor(index).call()));
        const converterBase = deployed(web3, 'ConverterBase', await converterAnchor.methods.owner().call());
        await execute(converterBase.methods.acceptOwnership());
        await execute(converterBase.methods.setConversionFee(fee));

        if (type === 2) {
            for (const reserve of converter.reserves) {
                if (reserve.oracle === undefined) {
                    const oracle = await web3Func(deploy, 'chainlinkOracle-' + converter.symbol + reserve.symbol, 'ChainlinkETHToETHOracle', []);
                    reserve.oracle = oracle._address;
                }
            }
            const deployedConverter = deployed(web3, 'LiquidityPoolV2Converter', converterBase._address);
            await execute(whitelist.methods.addAddress(converter.reserves[0].oracle));
            await execute(whitelist.methods.addAddress(converter.reserves[1].oracle));
            await execute(deployedConverter.methods.activate(tokens[0], converter.reserves[0].oracle, converter.reserves[1].oracle));
        }

        if (type !== 0 && amounts.every(amount => amount > 0)) {
            for (let i = 0; i < converter.reserves.length; i++) {
                const reserve = converter.reserves[i];
                if (reserve.symbol !== 'ETH') {
                    const deployedToken = deployed(web3, 'ERC20Token', tokens[i]);
                    await execute(deployedToken.methods.approve(converterBase._address, amounts[i]));
                }
            }
            if (type === 1) {
                const deployedConverter = deployed(web3, 'LiquidityPoolV1Converter', converterBase._address);
                await execute(deployedConverter.methods.addLiquidity(tokens, amounts, 1), value);
            }
            if (type === 2) {
                const deployedConverter = deployed(web3, 'LiquidityPoolV2Converter', converterBase._address);
                await execute(deployedConverter.methods.addLiquidity(tokens[0], amounts[0], 1), value);
                await execute(deployedConverter.methods.addLiquidity(tokens[1], amounts[1], 1), value);
            }
        }

        reserves[converter.symbol] = { address: converterAnchor._address, decimals: decimals };
    }

    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BNTToken'), reserves.BNT.address));
    await execute(conversionPathFinder.methods.setAnchorToken(reserves.BNT.address));
    await execute(bancorFormula.methods.init());

    const liquidityProtectionStore = await web3Func(deploy, 'liquidityProtectionStore', 'LiquidityProtectionStore', []);
    const liquidityProtectionParams = [liquidityProtectionStore._address, reserves.BNT.address, reserves.vBNT.address, contractRegistry._address];
    const liquidityProtection = await web3Func(deploy, 'liquidityProtection', 'LiquidityProtection', liquidityProtectionParams);

    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('LiquidityProtectionStore'), liquidityProtectionStore._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('LiquidityProtection'), liquidityProtection._address));

    await execute(liquidityProtectionStore.methods.transferOwnership(liquidityProtection._address));
    await execute(deployed(web3, 'DSToken', reserves.BNT.address).methods.transferOwnership(liquidityProtection._address));
    await execute(deployed(web3, 'DSToken', reserves.vBNT.address).methods.transferOwnership(liquidityProtection._address));
    await execute(liquidityProtection.methods.acceptStoreOwnership());
    await execute(liquidityProtection.methods.acceptNetworkTokenOwnership());
    await execute(liquidityProtection.methods.acceptGovTokenOwnership());

    const params = getConfig().liquidityProtectionParams;
    const maxSystemNetworkTokenRatio = percentageToPPM(params.maxSystemNetworkTokenRatio);
    const maxSystemNetworkTokenAmount = decimalToInteger(params.maxSystemNetworkTokenAmount, reserves.BNT.decimals);
    await execute(liquidityProtection.methods.setSystemNetworkTokenLimits(maxSystemNetworkTokenAmount, maxSystemNetworkTokenRatio));
    await execute(liquidityProtection.methods.setProtectionDelays(params.minProtectionDelay, params.maxProtectionDelay));
    await execute(liquidityProtection.methods.setLockDuration(params.lockDuration));

    for (const converter of params.converters) {
        await execute(liquidityProtection.methods.whitelistPool(reserves[converter].address, true));
    }

    web3.currentProvider.disconnect();
};

run();