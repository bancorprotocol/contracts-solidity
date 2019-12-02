const Web3 = require("web3");

const NODE_ADDRESS  = process.argv[2];
const CONTRACT_ADDR = process.argv[3];

async function rpc(func) {
    while (true) {
        try {
            return await func.call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                return "";
        }
    }
}

function parse(type, data) {
    if (type.startsWith("bytes")) {
        const list = [];
        for (let i = 2; i < data.length; i += 2) {
            const num = Number("0x" + data.slice(i, i + 2));
            if (32 <= num && num <= 126)
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

    for (const type of ["string", "bytes32", "uint16"]) {
        const abi = [{"constant":true,"inputs":[],"name":"version","outputs":[{"name":"","type":type}],"payable":false,"stateMutability":"view","type":"function"}];
        const contract = new web3.eth.Contract(abi , CONTRACT_ADDR);
        const version = await rpc(contract.methods.version());
        const string = parse(type, version);
        if (string) {
            console.log(type + " version: " + string);
            break;
        }
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();