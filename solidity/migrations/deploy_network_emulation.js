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

async function scan() {
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
        process.stdout.write(`Enter gas-price or leave empty to use ${nodeGasPrice}: `);
        const userGasPrice = await scan();
        if (/^\d+$/.test(userGasPrice))
            return userGasPrice;
        if (userGasPrice == "")
            return nodeGasPrice;
        console.log("Illegal gas-price");
    }
}

async function getTransactionReceipt(web3) {
    while (true) {
        process.stdout.write("Enter transaction-hash or leave empty to retry: ");
        const hash = await scan();
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

async function send(web3, account, gasPrice, transaction, value = 0, retry = true) {
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
            if (retry) {
                const receipt = await getTransactionReceipt(web3);
                if (receipt)
                    return receipt;
            }
            else {
                return {};
            }
        }
    }
}

async function deploy(web3, account, gasPrice, contractName, contractType, contractArgs) {
    if (get()[contractName] == undefined) {
        const abi = fs.readFileSync(ARTIFACTS_DIR + contractType + ".abi", {encoding: "utf8"});
        const bin = fs.readFileSync(ARTIFACTS_DIR + contractType + ".bin", {encoding: "utf8"});
        const contract = new web3.eth.Contract(JSON.parse(abi));
        const options = {data: "0x" + bin, arguments: contractArgs};
        const transaction = contract.deploy(options);
        const receipt = await send(web3, account, gasPrice, transaction);
        const args = transaction.encodeABI().slice(options.data.length);
        console.log(`${contractName} deployed at ${receipt.contractAddress}`);
        set({[contractName]: {type: contractType, addr: receipt.contractAddress, args: args}});
    }
    return deployed(web3, contractType, get()[contractName].addr);
}

function deployed(web3, contractType, contractAddr) {
    const abi = fs.readFileSync(ARTIFACTS_DIR + contractType + ".abi", {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account  = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(web3, account, gasPrice, ...args);

    const etherTokenParams  = get().etherTokenParams ;
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
    const priceLimitParams  = get().priceLimitParams ;

    const contractRegistry        = await web3Func(deploy, "ContractRegistry"       , "ContractRegistry"       , []);
    const contractFeatures        = await web3Func(deploy, "ContractFeatures"       , "ContractFeatures"       , []);
    const bancorFormula           = await web3Func(deploy, "BancorFormula"          , "BancorFormula"          , []);
    const bancorNetwork           = await web3Func(deploy, "BancorNetwork"          , "BancorNetwork"          , [contractRegistry._address]);
    const bancorNetworkPathFinder = await web3Func(deploy, "BancorNetworkPathFinder", "BancorNetworkPathFinder", [contractRegistry._address]);
    const bancorConverterRegistry = await web3Func(deploy, "BancorConverterRegistry", "BancorConverterRegistry", []);
    const etherToken              = await web3Func(deploy, "EtherToken"             , "EtherToken"             , []);
    const smartToken1             = await web3Func(deploy, "SmartToken1"            , "SmartToken"             , [smartToken1Params.name, smartToken1Params.symbol, smartToken1Params.decimals]);
    const smartToken2             = await web3Func(deploy, "SmartToken2"            , "SmartToken"             , [smartToken2Params.name, smartToken2Params.symbol, smartToken2Params.decimals]);
    const smartToken3             = await web3Func(deploy, "SmartToken3"            , "SmartToken"             , [smartToken3Params.name, smartToken3Params.symbol, smartToken3Params.decimals]);
    const smartToken4             = await web3Func(deploy, "SmartToken4"            , "SmartToken"             , [smartToken4Params.name, smartToken4Params.symbol, smartToken4Params.decimals]);
    const erc20TokenA             = await web3Func(deploy, "ERC20TokenA"            , "ERC20Token"             , [erc20TokenAParams.name, erc20TokenAParams.symbol, erc20TokenAParams.decimals, erc20TokenAParams.supply]);
    const erc20TokenB             = await web3Func(deploy, "ERC20TokenB"            , "ERC20Token"             , [erc20TokenBParams.name, erc20TokenBParams.symbol, erc20TokenBParams.decimals, erc20TokenBParams.supply]);
    const bancorConverter1        = await web3Func(deploy, "BancorConverter1"       , "BancorConverter"        , [smartToken1._address, contractRegistry._address, converter1Params.fee, etherToken ._address, converter1Params.ratio1]);
    const bancorConverter2        = await web3Func(deploy, "BancorConverter2"       , "BancorConverter"        , [smartToken2._address, contractRegistry._address, converter2Params.fee, smartToken1._address, converter2Params.ratio1]);
    const bancorConverter3        = await web3Func(deploy, "BancorConverter3"       , "BancorConverter"        , [smartToken3._address, contractRegistry._address, converter3Params.fee, smartToken1._address, converter3Params.ratio1]);
    const bancorConverter4        = await web3Func(deploy, "BancorConverter4"       , "BancorConverter"        , [smartToken4._address, contractRegistry._address, converter4Params.fee, smartToken1._address, converter4Params.ratio1]);
    const bancorGasPriceLimit     = await web3Func(deploy, "BancorGasPriceLimit"    , "BancorGasPriceLimit"    , [priceLimitParams.value]);

    await web3Func(send, etherToken.methods.deposit(), etherTokenParams.supply);
    await web3Func(send, smartToken1.methods.issue(account.address, smartToken1Params.supply));
    await web3Func(send, smartToken2.methods.issue(account.address, smartToken2Params.supply));
    await web3Func(send, smartToken3.methods.issue(account.address, smartToken3Params.supply));
    await web3Func(send, smartToken4.methods.issue(account.address, smartToken4Params.supply));
    await web3Func(send, bancorConverter3.methods.addReserve(erc20TokenA._address, converter3Params.ratio2, converter3Params.virtual));
    await web3Func(send, bancorConverter4.methods.addReserve(erc20TokenB._address, converter4Params.ratio2, converter4Params.virtual));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("ContractRegistry"       ), contractRegistry       ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("ContractFeatures"       ), contractFeatures       ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorFormula"          ), bancorFormula          ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorNetwork"          ), bancorNetwork          ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorGasPriceLimit"    ), bancorGasPriceLimit    ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BNTToken"               ), smartToken1            ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BNTConverter"           ), bancorConverter1       ._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorNetworkPathFinder"), bancorNetworkPathFinder._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("BancorConverterRegistry"), bancorConverterRegistry._address));
    await web3Func(send, contractRegistry.methods.registerAddress(Web3.utils.asciiToHex("EtherToken"             ), etherToken             ._address));
    await web3Func(send, bancorConverterRegistry.methods.registerConverter(smartToken1._address, bancorConverter1._address));
    await web3Func(send, bancorConverterRegistry.methods.registerConverter(smartToken2._address, bancorConverter2._address));
    await web3Func(send, bancorConverterRegistry.methods.registerConverter(smartToken3._address, bancorConverter3._address));
    await web3Func(send, bancorConverterRegistry.methods.registerConverter(smartToken4._address, bancorConverter4._address));
    await web3Func(send, etherToken .methods.transfer(bancorConverter1._address, converter1Params.reserve1));
    await web3Func(send, smartToken1.methods.transfer(bancorConverter2._address, converter2Params.reserve1));
    await web3Func(send, smartToken1.methods.transfer(bancorConverter3._address, converter3Params.reserve1));
    await web3Func(send, smartToken1.methods.transfer(bancorConverter4._address, converter4Params.reserve1));
    await web3Func(send, erc20TokenA.methods.transfer(bancorConverter3._address, converter3Params.reserve2));
    await web3Func(send, erc20TokenB.methods.transfer(bancorConverter4._address, converter4Params.reserve2));
    await web3Func(send, smartToken1.methods.transferOwnership(bancorConverter1._address));
    await web3Func(send, smartToken2.methods.transferOwnership(bancorConverter2._address));
    await web3Func(send, smartToken3.methods.transferOwnership(bancorConverter3._address));
    await web3Func(send, smartToken4.methods.transferOwnership(bancorConverter4._address));
    await web3Func(send, bancorConverter1.methods.acceptTokenOwnership());
    await web3Func(send, bancorConverter2.methods.acceptTokenOwnership());
    await web3Func(send, bancorConverter3.methods.acceptTokenOwnership());
    await web3Func(send, bancorConverter4.methods.acceptTokenOwnership());

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();