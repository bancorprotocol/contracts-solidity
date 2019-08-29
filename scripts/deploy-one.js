const fs = require("fs");
const Web3 = require("web3");

const NODE_ADDRESS  = process.argv[2];
const PRIVATE_KEY   = process.argv[3];
const CONTRACT_NAME = process.argv[4];
const CONTRACT_ARGS = process.argv.slice(5);

async function send(web3, transaction) {
    const options = {
        data    : transaction.encodeABI(),
        gasPrice: await web3.eth.getGasPrice(),
        gas     : (await web3.eth.getBlock("latest")).gasLimit
    };
    const signed  = await web3.eth.accounts.signTransaction(options, PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    return receipt;
}

async function deploy(web3) {
    const abi = fs.readFileSync("solidity/build/" + CONTRACT_NAME + ".abi");
    const bin = fs.readFileSync("solidity/build/" + CONTRACT_NAME + ".bin");
    const contract = new web3.eth.Contract(JSON.parse(abi));
    const options = {data: "0x" + bin, arguments: CONTRACT_ARGS};
    const transaction = contract.deploy(options);
    const receipt = await send(web3, transaction);
    const args = transaction.encodeABI().slice(options.data.length);
    console.log(`"${CONTRACT_NAME}": {"addr": "${receipt.contractAddress}", "args": "${args}"}`);
    return new web3.eth.Contract(JSON.parse(abi), receipt.contractAddress);
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const contract = await deploy(web3);
    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();