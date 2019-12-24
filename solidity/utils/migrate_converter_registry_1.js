const Web3 = require("web3");

const NODE_ADDRESS = process.argv[2];
const PRIVATE_KEY  = process.argv[3];
const OLD_REG_ADDR = process.argv[4];
const NEW_REG_ADDR = process.argv[5];

const ZERO_ADDRESS = "0x".padEnd(42, "0");

const OLD_REGISTRY_ABI = [
    {"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[],"name":"tokenCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"tokens","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_token","type":"address"}],"name":"converterCount","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":true,"inputs":[{"name":"_token","type":"address"},{"name":"_index","type":"uint32"}],"name":"converterAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
];

const NEW_REGISTRY_ABI = [
    {"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
    {"constant":true,"inputs":[{"name":"_token","type":"address"},{"name":"_index","type":"uint32"}],"name":"converterAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
    {"constant":false,"inputs":[{"name":"_token","type":"address"},{"name":"_converter","type":"address"}],"name":"registerConverter","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
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

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const gasPrice = await getGasPrice(web3);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

    const oldRegistry = new web3.eth.Contract(OLD_REGISTRY_ABI, OLD_REG_ADDR);
    const newRegistry = new web3.eth.Contract(NEW_REGISTRY_ABI, NEW_REG_ADDR);

    const tokenCount = await rpc(oldRegistry.methods.tokenCount());
    for (let i = 0; i < tokenCount; i++) {
        const token = await rpc(oldRegistry.methods.tokens(i));
        const converterCount = await rpc(oldRegistry.methods.converterCount(token));
        for (let j = 0; j < converterCount; j++) {
            const converter = await rpc(oldRegistry.methods.converterAddress(token, j));
            switch (await rpc(newRegistry.methods.converterAddress(token, j))) {
            case ZERO_ADDRESS:
                const receipt = await send(web3, account, gasPrice, newRegistry.methods.registerConverter(token, converter));
                console.log(`token ${i} out of ${tokenCount}, converter ${j} out of ${converterCount}: gas = ${receipt.gasUsed}`);
                break;
            case converter:
                console.log(`token ${i} out of ${tokenCount}, converter ${j} out of ${converterCount}: completed successfully`);
                break;
            default:
                console.log(`token ${i} out of ${tokenCount}, converter ${j} out of ${converterCount}: an error has occurred`);
                break;
            }
        }
    }

    const owner = await rpc(oldRegistry.methods.owner());
    switch (await rpc(newRegistry.methods.newOwner())) {
    case ZERO_ADDRESS:
        const receipt = await send(web3, account, gasPrice, newRegistry.methods.transferOwnership(owner));
        console.log(`ownership-transfer from ${account.address} to ${owner}: gas = ${receipt.gasUsed}`);
        break;
    case owner:
        console.log(`ownership-transfer from ${account.address} to ${owner}: completed successfully`);
        break;
    default:
        console.log(`ownership-transfer from ${account.address} to ${owner}: an error has occurred`);
        break;
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();