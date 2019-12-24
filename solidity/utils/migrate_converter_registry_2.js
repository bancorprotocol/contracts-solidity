const Web3 = require("web3");

const NODE_ADDRESS = process.argv[2];
const PRIVATE_KEY  = process.argv[3];
const OLD_REG_ADDR = process.argv[4];
const NEW_REG_ADDR = process.argv[5];

const CONVERTER_ABI = [
    {"constant":true,"inputs":[],"name":"token","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
];

const SMART_TOKEN_ABI = [
    {"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
];

const OLD_REGISTRY_ABI = [
    {"constant":true,"inputs":[],"name":"tokenCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"tokens","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_token","type":"address"}],"name":"latestConverterAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
];

const NEW_REGISTRY_ABI = [
    {"constant":false,"inputs":[{"name":"_converter","type":"address"}],"name":"addConverter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"constant":true,"inputs":[{"name":"_value","type":"address"}],"name":"isSmartToken","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_value","type":"address"}],"name":"isLiquidityPool","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_converter","type":"address"}],"name":"isConverterValid","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
];

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

async function send(web3, account, gasPrice, transaction) {
    while (true) {
        try {
            const options = {
                to      : transaction._parent._address,
                data    : transaction.encodeABI(),
                gas     : await transaction.estimateGas({from: account.address}),
                gasPrice: gasPrice ? gasPrice : await getGasPrice(web3),
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

async function rpc(func) {
    while (true) {
        try {
            return await func.call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                throw error;
        }
    }
}

async function isConverterValid(registry, converter) {
    try {
        return await rpc(registry.methods.isConverterValid(converter));
     }
    catch (error) {
        return false;
    }
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const gasPrice = await getGasPrice(web3);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

    const oldRegistry = new web3.eth.Contract(OLD_REGISTRY_ABI, OLD_REG_ADDR);
    const newRegistry = new web3.eth.Contract(NEW_REGISTRY_ABI, NEW_REG_ADDR);

    const tokenCount = await rpc(oldRegistry.methods.tokenCount());
    for (let i = 0; i < tokenCount; i++) {
        const tokenAddr = await rpc(oldRegistry.methods.tokens(i));
        const converterAddr = await rpc(oldRegistry.methods.latestConverterAddress(tokenAddr));
        const converter = new web3.eth.Contract(CONVERTER_ABI, converterAddr);
        const smartTokenAddr = await rpc(converter.methods.token());
        const smartToken = new web3.eth.Contract(SMART_TOKEN_ABI, smartTokenAddr);
        const ownerAddr = await rpc(smartToken.methods.owner());
        if (await rpc(newRegistry.methods.isSmartToken(smartTokenAddr))) {
            console.log(`token ${i} out of ${tokenCount}: already added`);
        }
        else if (await isConverterValid(newRegistry, ownerAddr)) {
            const transaction = newRegistry.methods.addConverter(ownerAddr);
            const receipt = await send(web3, account, gasPrice, transaction);
            console.log(`token ${i} out of ${tokenCount}: gas used = ${receipt.gasUsed}`);
        }
        else {
            console.log(`token ${i} out of ${tokenCount}: owner is not a valid converter`);
        }
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();