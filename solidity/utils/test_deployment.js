const fs = require('fs');
const path = require('path');
const Web3 = require('web3');

const CFG_FILE_NAME = process.argv[2];
const NODE_ADDRESS = process.argv[3];
const PRIVATE_KEY = process.argv[4];

const ARTIFACTS_DIR = path.resolve(__dirname, '../build');

const MIN_GAS_LIMIT = 100000;

const ROLE_OWNER = Web3.utils.keccak256('ROLE_OWNER');
const ROLE_GOVERNOR = Web3.utils.keccak256('ROLE_GOVERNOR');
const ROLE_MINTER = Web3.utils.keccak256('ROLE_MINTER');
const ROLE_MINTED_TOKENS_ADMIN = Web3.utils.keccak256('ROLE_MINTED_TOKENS_ADMIN');

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

const send = async (web3, account, gasPrice, transaction, value = 0) => {
    while (true) {
        try {
            const tx = {
                to: transaction._parent._address,
                data: transaction.encodeABI(),
                gas: Math.max(await transaction.estimateGas({ from: account.address, value: value }), MIN_GAS_LIMIT),
                gasPrice: gasPrice || (await getGasPrice(web3)),
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
        setConfig({
            [contractId]: {
                name: contractName,
                addr: receipt.contractAddress,
                args: args
            }
        });
    }
    return deployed(web3, contractName, getConfig()[contractId].addr);
};

const deployed = (web3, contractName, contractAddr) => {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + '.abi'), {
        encoding: 'utf8'
    });
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
    const conversionPathFinder = await web3Func(deploy, 'conversionPathFinder', 'ConversionPathFinder', [
        contractRegistry._address
    ]);
    const converterUpgrader = await web3Func(deploy, 'converterUpgrader', 'ConverterUpgrader', [
        contractRegistry._address,
        reserves.ETH.address
    ]);
    const converterRegistry = await web3Func(deploy, 'converterRegistry', 'ConverterRegistry', [
        contractRegistry._address
    ]);
    const converterRegistryData = await web3Func(deploy, 'converterRegistryData', 'ConverterRegistryData', [
        contractRegistry._address
    ]);
    const liquidTokenConverterFactory = await web3Func(
        deploy,
        'liquidTokenConverterFactory',
        'LiquidTokenConverterFactory',
        []
    );
    const liquidityPoolV1ConverterFactory = await web3Func(
        deploy,
        'liquidityPoolV1ConverterFactory',
        'LiquidityPoolV1ConverterFactory',
        []
    );
    const standardPoolConverterFactory = await web3Func(
        deploy,
        'standardPoolConverterFactory',
        'StandardPoolConverterFactory',
        []
    );

    // contract deployment for etherscan verification only
    const poolToken1 = await web3Func(deploy, 'poolToken1', 'DSToken', ['Token1', 'TKN1', 18]);
    const poolToken2 = await web3Func(deploy, 'poolToken2', 'DSToken', ['Token2', 'TKN2', 18]);
    await web3Func(deploy, 'liquidTokenConverter', 'LiquidTokenConverter', [
        poolToken1._address,
        contractRegistry._address,
        1000
    ]);
    await web3Func(deploy, 'liquidityPoolV1Converter', 'LiquidityPoolV1Converter', [
        poolToken2._address,
        contractRegistry._address,
        1000
    ]);
    await web3Func(deploy, 'standardPoolConverter', 'StandardPoolConverter', [
        poolToken2._address,
        contractRegistry._address,
        1000
    ]);

    // initialize contract registry
    await execute(
        contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('ContractRegistry'), contractRegistry._address)
    );
    await execute(
        contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('ConverterFactory'), converterFactory._address)
    );
    await execute(
        contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorFormula'), bancorFormula._address)
    );
    await execute(
        contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BancorNetwork'), bancorNetwork._address)
    );
    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('ConversionPathFinder'),
            conversionPathFinder._address
        )
    );
    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('BancorConverterUpgrader'),
            converterUpgrader._address
        )
    );
    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('BancorConverterRegistry'),
            converterRegistry._address
        )
    );
    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('BancorConverterRegistryData'),
            converterRegistryData._address
        )
    );

    // initialize converter factory
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidTokenConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterFactory(liquidityPoolV1ConverterFactory._address));
    await execute(converterFactory.methods.registerTypedConverterFactory(standardPoolConverterFactory._address));

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
            const token = await web3Func(deploy, 'erc20Token-' + symbol, 'ERC20Token', [
                name,
                symbol,
                decimals,
                supply
            ]);
            reserves[symbol] = { address: token._address, decimals: decimals };
        }
        if (reserve.type === 1) {
            const name = reserve.symbol + ' DS Token';
            const symbol = reserve.symbol;
            const decimals = reserve.decimals;
            const supply = decimalToInteger(reserve.supply, decimals);
            const nonce = await web3.eth.getTransactionCount(account.address);
            const token = await web3Func(deploy, 'dsToken-' + symbol, 'DSToken', [name, symbol, decimals]);
            if (nonce !== (await web3.eth.getTransactionCount(account.address))) {
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
        const tokens = converter.reserves.map((reserve) => reserves[reserve.symbol].address);
        const weights = converter.reserves.map((reserve) => percentageToPPM(reserve.weight));
        const amounts = converter.reserves.map((reserve) =>
            decimalToInteger(reserve.balance, reserves[reserve.symbol].decimals)
        );
        const value = amounts[converter.reserves.findIndex((reserve) => reserve.symbol === 'ETH')];

        await execute(
            converterRegistry.methods.newConverter(
                type,
                name,
                symbol,
                decimals,
                percentageToPPM('100%'),
                tokens,
                weights
            )
        );
        const converterAnchor = deployed(
            web3,
            'IConverterAnchor',
            await converterRegistry.methods.getAnchor(index).call()
        );
        const converterBase = deployed(web3, 'ConverterBase', await converterAnchor.methods.owner().call());
        await execute(converterBase.methods.acceptOwnership());
        await execute(converterBase.methods.setConversionFee(fee));

        if (type !== 0 && amounts.every((amount) => amount > 0)) {
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
            if (type === 3) {
                const deployedConverter = deployed(web3, 'StandardPoolConverter', converterBase._address);
                await execute(deployedConverter.methods.addLiquidity(tokens, amounts, 1), value);
            }
        }

        reserves[converter.symbol] = {
            address: converterAnchor._address,
            decimals: decimals
        };
    }

    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex('BNTToken'), reserves.BNT.address));
    await execute(conversionPathFinder.methods.setAnchorToken(reserves.BNT.address));
    await execute(bancorFormula.methods.init());

    const bntTokenGovernance = await web3Func(deploy, 'bntTokenGovernance', 'TokenGovernance', [reserves.BNT.address]);
    const vbntTokenGovernance = await web3Func(deploy, 'vbntTokenGovernance', 'TokenGovernance', [
        reserves.vBNT.address
    ]);

    await execute(bntTokenGovernance.methods.grantRole(ROLE_GOVERNOR, account.address));
    await execute(vbntTokenGovernance.methods.grantRole(ROLE_GOVERNOR, account.address));

    const checkpointStore = await web3Func(deploy, 'checkpointStore', 'CheckpointStore', []);
    const liquidityProtectionSettings = await web3Func(
        deploy,
        'liquidityProtectionSettings',
        'LiquidityProtectionSettings',
        [reserves.BNT.address, contractRegistry._address]
    );
    const liquidityProtectionStore = await web3Func(deploy, 'liquidityProtectionStore', 'LiquidityProtectionStore', []);
    const liquidityProtectionParams = [
        liquidityProtectionSettings._address,
        liquidityProtectionStore._address,
        bntTokenGovernance._address,
        vbntTokenGovernance._address,
        checkpointStore._address
    ];

    const liquidityProtection = await web3Func(
        deploy,
        'liquidityProtection',
        'LiquidityProtection',
        liquidityProtectionParams
    );

    await execute(checkpointStore.methods.grantRole(ROLE_OWNER, liquidityProtection._address));

    // granting the LP contract both of the MINTER roles requires the deployer to have the GOVERNOR role
    await execute(bntTokenGovernance.methods.grantRole(ROLE_MINTER, liquidityProtection._address));
    await execute(vbntTokenGovernance.methods.grantRole(ROLE_MINTER, liquidityProtection._address));

    await execute(liquidityProtectionSettings.methods.grantRole(ROLE_MINTED_TOKENS_ADMIN, liquidityProtection._address));

    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('LiquidityProtectionSettings'),
            liquidityProtectionSettings._address
        )
    );
    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('LiquidityProtectionStore'),
            liquidityProtectionStore._address
        )
    );
    await execute(
        contractRegistry.methods.registerAddress(
            Web3.utils.asciiToHex('LiquidityProtection'),
            liquidityProtection._address
        )
    );

    await execute(liquidityProtectionStore.methods.transferOwnership(liquidityProtection._address));
    await execute(liquidityProtection.methods.acceptStoreOwnership());

    const params = getConfig().liquidityProtectionParams;

    const minNetworkTokenLiquidityForMinting = decimalToInteger(params.minNetworkTokenLiquidityForMinting, reserves.BNT.decimals);
    await execute(liquidityProtectionSettings.methods.setMinNetworkTokenLiquidityForMinting(minNetworkTokenLiquidityForMinting));

    const defaultNetworkTokenMintingLimit = decimalToInteger(params.defaultNetworkTokenMintingLimit, reserves.BNT.decimals);
    await execute(liquidityProtectionSettings.methods.setDefaultNetworkTokenMintingLimit(defaultNetworkTokenMintingLimit));

    await execute(
        liquidityProtectionSettings.methods.setProtectionDelays(params.minProtectionDelay, params.maxProtectionDelay)
    );
    await execute(liquidityProtectionSettings.methods.setLockDuration(params.lockDuration));

    for (const converter of params.converters) {
        await execute(liquidityProtectionSettings.methods.addPoolToWhitelist(reserves[converter].address));
    }

    web3.currentProvider.disconnect();
};

run();
