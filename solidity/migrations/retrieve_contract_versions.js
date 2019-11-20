const fs   = require("fs");
const Web3 = require("web3");

const NODE_ADDRESS  = process.argv[2];
const CONTRACT_ADDR = process.argv[3];
const VERSION_TYPES = process.argv.slice(4);

async function getVersion(contract) {
    while (true) {
        try {
            return await contract.methods.version().call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                return "";
        }
    }
}

function toString(type, data) {
    if (type.startsWith("bytes")) {
        const list = [];
        for (let i = 2; i < data.length; i += 2) {
            const num = Number("0x" + data.slice(i, i + 2));
            if (32 <= num && num <= 127)
                list.push(num);
            else
                break;
        }
        return String.fromCharCode(...list);
    }
    return data;
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    for (const VERSION_TYPE of VERSION_TYPES) {
        const abi = [{"constant":true,"inputs":[],"name":"version","outputs":[{"name":"","type":VERSION_TYPE}],"payable":false,"stateMutability":"view","type":"function"}];
        const contract = new web3.eth.Contract(abi , CONTRACT_ADDR);
        const version = await getVersion(contract);
        console.log(VERSION_TYPE + "version: " + toString(VERSION_TYPE, version));
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();