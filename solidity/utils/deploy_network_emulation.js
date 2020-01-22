const fs   = require("fs");
const Web3 = require("web3");

const CFG_FILE_NAME = process.argv[2];
const NODE_ADDRESS  = process.argv[3];
const PRIVATE_KEY   = process.argv[4];

const ARTIFACTS_DIR = __dirname + "/../build/";

const MIN_GAS_LIMIT = 100000;

function get() {
    return JSON.parse(fs.readFileSync(CFG_FILE_NAME, {encoding: "utf8"}));
}

function set(record) {
    fs.writeFileSync(CFG_FILE_NAME, JSON.stringify({...get(), ...record}, null, 4));
}

async function scan(message) {
    process.stdout.write(message);
    return await new Promise(function(resolve, reject) {
        process.stdin.resume();
        process.stdin.once("data", function(data) {
            process.stdin.pause();
            resolve(data.toString().trim());
        });
    });
}

async function getGasPrice(web3) {
    while (true) {
        const nodeGasPrice = await web3.eth.getGasPrice();
        const userGasPrice = await scan(`Enter gas-price or leave empty to use ${nodeGasPrice}: `);
        if (/^\d+$/.test(userGasPrice))
            return userGasPrice;
        if (userGasPrice == "")
            return nodeGasPrice;
        console.log("Illegal gas-price");
    }
}

async function getTransactionReceipt(web3) {
    while (true) {
        const hash = await scan("Enter transaction-hash or leave empty to retry: ");
        if (/^0x([0-9A-Fa-f]{64})$/.test(hash)) {
            const receipt = await web3.eth.getTransactionReceipt(hash);
            if (receipt)
                return receipt;
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
            const options = {
                to      : transaction._parent._address,
                data    : transaction.encodeABI(),
                gas     : Math.max(await transaction.estimateGas({from: account.address}), MIN_GAS_LIMIT),
                gasPrice: gasPrice ? gasPrice : await getGasPrice(web3),
                value   : value,
            };
            const signed  = await web3.eth.accounts.signTransaction(options, account.privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            return receipt;
        }
        catch (error) {
            console.log(error.message);
            const receipt = await getTransactionReceipt(web3);
            if (receipt)
                return receipt;
        }
    }
}

async function deploy(web3, account, gasPrice, contractId, contractName, contractArgs) {
    if (get()[contractId] == undefined) {
        const abi = fs.readFileSync(ARTIFACTS_DIR + contractName + ".abi", {encoding: "utf8"});
        const bin = fs.readFileSync(ARTIFACTS_DIR + contractName + ".bin", {encoding: "utf8"});
        const contract = new web3.eth.Contract(JSON.parse(abi));
        const options = {data: "0x" + bin, arguments: contractArgs};
        const transaction = contract.deploy(options);
        const receipt = await send(web3, account, gasPrice, transaction);
        const args = transaction.encodeABI().slice(options.data.length);
        console.log(`${contractId} deployed at ${receipt.contractAddress}`);
        set({[contractId]: {name: contractName, addr: receipt.contractAddress, args: args}});
    }
    return deployed(web3, contractName, get()[contractId].addr);
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(ARTIFACTS_DIR + contractName + ".abi", {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account  = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(web3, account, gasPrice, ...args);

    const etherTokenParams  = get().etherTokenParams ;
    const smartToken0Params = get().smartToken0Params;
    const smartToken1Params = get().smartToken1Params;
    const smartToken2Params = get().smartToken2Params;
    const smartToken3Params = get().smartToken3Params;
    const smartToken4Params = get().smartToken4Params;
    const erc20TokenAParams = get().erc20TokenAParams;
    const erc20TokenBParams = get().erc20TokenBParams;
    const converter1Params  = get().converter1Params ;
    const converter2Params  = get().converter2Params ;
    const converter3Params  = get().converter3Params ;
    const converter4Params  = get().converter4Params ;

    const contractRegistry            = await web3Func(deploy, "contractRegistry"           , "ContractRegistry"           , []);
    const contractFeatures            = await web3Func(deploy, "contractFeatures"           , "ContractFeatures"           , []);
    const bancorFormula               = await web3Func(deploy, "bancorFormula"              , "BancorFormula"              , []);
    const bancorNetwork               = await web3Func(deploy, "bancorNetwork"              , "BancorNetwork"              , [contractRegistry._address]);
    const bancorNetworkPathFinder     = await web3Func(deploy, "bancorNetworkPathFinder"    , "BancorNetworkPathFinder"    , [contractRegistry._address]);
    const bancorConverterRegistry     = await web3Func(deploy, "bancorConverterRegistry"    , "BancorConverterRegistry"    , [contractRegistry._address]);
    const bancorConverterRegistryData = await web3Func(deploy, "bancorConverterRegistryData", "BancorConverterRegistryData", [contractRegistry._address]);
    const etherToken                  = await web3Func(deploy, "etherToken"                 , "EtherToken"                 , [etherTokenParams .name, etherTokenParams .symbol]);
    const smartToken0                 = await web3Func(deploy, "smartToken0"                , "SmartToken"                 , [smartToken0Params.name, smartToken0Params.symbol, smartToken0Params.decimals]);
    const smartToken1                 = await web3Func(deploy, "smartToken1"                , "SmartToken"                 , [smartToken1Params.name, smartToken1Params.symbol, smartToken1Params.decimals]);
    const smartToken2                 = await web3Func(deploy, "smartToken2"                , "SmartToken"                 , [smartToken2Params.name, smartToken2Params.symbol, smartToken2Params.decimals]);
    const smartToken3                 = await web3Func(deploy, "smartToken3"                , "SmartToken"                 , [smartToken3Params.name, smartToken3Params.symbol, smartToken3Params.decimals]);
    const smartToken4                 = await web3Func(deploy, "smartToken4"                , "SmartToken"                 , [smartToken4Params.name, smartToken4Params.symbol, smartToken4Params.decimals]);
    const erc20TokenA                 = await web3Func(deploy, "erc20TokenA"                , "ERC20Token"                 , [erc20TokenAParams.name, erc20TokenAParams.symbol, erc20TokenAParams.decimals, erc20TokenAParams.supply]);
    const erc20TokenB                 = await web3Func(deploy, "erc20TokenB"                , "ERC20Token"                 , [erc20TokenBParams.name, erc20TokenBParams.symbol, erc20TokenBParams.decimals, erc20TokenBParams.supply]);
    const bancorConverter1            = await web3Func(deploy, "bancorConverter1"           , "BancorConverter"            , [smartToken1._address, contractRegistry._address, converter1Params.fee, smartToken0._address, converter1Params.ratio1]);
    const bancorConverter2            = await web3Func(deploy, "bancorConverter2"           , "BancorConverter"            , [smartToken2._address, contractRegistry._address, converter2Params.fee, smartToken0._address, converter2Params.ratio1]);
    const bancorConverter3            = await web3Func(deploy, "bancorConverter3"           , "BancorConverter"            , [smartToken3._address, contractRegistry._address, converter3Params.fee, smartToken0._address, converter3Params.ratio1]);
    const bancorConverter4            = await web3Func(deploy, "bancorConverter4"           , "BancorConverter"            , [smartToken4._address, contractRegistry._address, converter4Params.fee, smartToken0._address, converter4Params.ratio1]);

    let phase = 0;
    if (get().phase == undefined)
        set({phase});
    const execute = async (transaction, ...args) => {
        if (get().phase == phase++) {
            await web3Func(send, transaction, ...args);
            console.log(`phase ${phase} executed`);
            set({phase});
        }
    };

    await execute(etherToken.methods.deposit(), etherTokenParams.supply);
    await execute(smartToken0.methods.issue(account.address, smartToken0Params.supply));
    await execute(smartToken1.methods.issue(account.address, smartToken1Params.supply));
    await execute(smartToken2.methods.issue(account.address, smartToken2Params.supply));
    await execute(smartToken3.methods.issue(account.address, smartToken3Params.supply));
    await execute(smartToken4.methods.issue(account.address, smartToken4Params.supply));
    await execute(bancorConverter1.methods.addReserve(etherToken ._address, converter1Params.ratio2));
    await execute(bancorConverter2.methods.addReserve(erc20TokenA._address, converter2Params.ratio2));
    await execute(bancorConverter3.methods.addReserve(erc20TokenB._address, converter3Params.ratio2));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("ContractRegistry"           ), contractRegistry           ._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("ContractFeatures"           ), contractFeatures           ._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorFormula"              ), bancorFormula              ._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorNetwork"              ), bancorNetwork              ._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorNetworkPathFinder"    ), bancorNetworkPathFinder    ._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorConverterRegistry"    ), bancorConverterRegistry    ._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorConverterRegistryData"), bancorConverterRegistryData._address));
    await execute(contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BNTToken"                   ), smartToken0                ._address));
    await execute(smartToken0.methods.transfer(bancorConverter1._address, converter1Params.reserve1));
    await execute(smartToken0.methods.transfer(bancorConverter2._address, converter2Params.reserve1));
    await execute(smartToken0.methods.transfer(bancorConverter3._address, converter3Params.reserve1));
    await execute(smartToken0.methods.transfer(bancorConverter4._address, converter4Params.reserve1));
    await execute(etherToken .methods.transfer(bancorConverter1._address, converter1Params.reserve2));
    await execute(erc20TokenA.methods.transfer(bancorConverter2._address, converter2Params.reserve2));
    await execute(erc20TokenB.methods.transfer(bancorConverter3._address, converter3Params.reserve2));
    await execute(smartToken1.methods.transferOwnership(bancorConverter1._address));
    await execute(smartToken2.methods.transferOwnership(bancorConverter2._address));
    await execute(smartToken3.methods.transferOwnership(bancorConverter3._address));
    await execute(smartToken4.methods.transferOwnership(bancorConverter4._address));
    await execute(bancorConverter1.methods.acceptTokenOwnership());
    await execute(bancorConverter2.methods.acceptTokenOwnership());
    await execute(bancorConverter3.methods.acceptTokenOwnership());
    await execute(bancorConverter4.methods.acceptTokenOwnership());
    await execute(bancorConverterRegistry.methods.addConverter(bancorConverter1._address));
    await execute(bancorConverterRegistry.methods.addConverter(bancorConverter2._address));
    await execute(bancorConverterRegistry.methods.addConverter(bancorConverter3._address));
    await execute(bancorConverterRegistry.methods.addConverter(bancorConverter4._address));
    await execute(bancorNetworkPathFinder.methods.setAnchorToken(smartToken0._address));
    await execute(bancorNetwork.methods.registerEtherToken(etherToken._address, true));

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();