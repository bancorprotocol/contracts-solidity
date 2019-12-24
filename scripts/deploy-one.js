const fs   = require("fs");
const Web3 = require("web3");

const NODE_ADDRESS  = process.argv[2];
const PRIVATE_KEY   = process.argv[3];
const CONTRACT_NAME = process.argv[4];
const CONTRACT_ARGS = process.argv.slice(5);

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

async function send(web3, account, transaction) {
    while (true) {
        try {
            const options = {
                data    : transaction.encodeABI(),
                gas     : await transaction.estimateGas({from: account.address}),
                gasPrice: await getGasPrice(web3),
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

async function run() {
    const web3        = new Web3(NODE_ADDRESS);
    const account     = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const path        = __dirname + "/../solidity/build/" + CONTRACT_NAME;
    const abi         = fs.readFileSync(path + ".abi", {encoding: "utf8"});
    const bin         = fs.readFileSync(path + ".bin", {encoding: "utf8"});
    const contract    = new web3.eth.Contract(JSON.parse(abi));
    const options     = {data: "0x" + bin, arguments: CONTRACT_ARGS};
    const transaction = contract.deploy(options);
    const receipt     = await send(web3, account, transaction);
    console.log(JSON.stringify({
        [CONTRACT_NAME]: {
            name: CONTRACT_NAME,
            addr: receipt.contractAddress,
            args: transaction.encodeABI().slice(options.data.length)
        }
    }));
    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();