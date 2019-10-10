const fs   = require("fs");
const Web3 = require("web3");

const NODE_ADDRESS = process.argv[2];
const PRIVATE_KEY  = process.argv[3];
const OLD_REG_ADDR = process.argv[4];
const NEW_REG_ADDR = process.argv[5];

const ZERO_ADDRESS = "0x".padEnd(42, "0");

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

async function send(web3, transaction, account, gasPrice) {
    while (true) {
        try {
            const options = {
                to      : transaction._parent._address,
                data    : transaction.encodeABI(),
                gas     : await transaction.estimateGas({from: account.address}),
                gasPrice: gasPrice ? gasPrice : await getGasPrice(web3)
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

async function rpc(transaction) {
    while (true) {
        try {
            return await transaction.call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                console.log(error.message);
        }
    }
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const abi = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorConverterRegistry.abi", {encoding: "utf8"}));

    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const oldRegistry = new web3.eth.Contract(abi, OLD_REG_ADDR);
    const newRegistry = new web3.eth.Contract(abi, NEW_REG_ADDR);

    const gasPrice = await getGasPrice(web3);
    const execute = transaction => send(web3, transaction, account, gasPrice);

    const tokenCount = await rpc(oldRegistry.methods.tokenCount());
    for (let i = 0; i < tokenCount; i++) {
        const token = await rpc(oldRegistry.methods.tokens(i));
        const converterCount = await rpc(oldRegistry.methods.converterCount(token));
        for (let j = 0; j < converterCount; j++) {
            const converter = await rpc(oldRegistry.methods.converterAddress(token, j));
            switch (await rpc(newRegistry.methods.converterAddress(token, j))) {
            case ZERO_ADDRESS:
                const receipt = await execute(newRegistry.methods.registerConverter(token, converter));
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
        const receipt = await execute(newRegistry.methods.transferOwnership(owner));
        console.log(`ownership-transfer to ${owner}: gas = ${receipt.gasUsed}`);
        break;
    case owner:
        console.log(`ownership-transfer to ${owner}: completed successfully`);
        break;
    default:
        console.log(`ownership-transfer to ${owner}: an error has occurred`);
        break;
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();