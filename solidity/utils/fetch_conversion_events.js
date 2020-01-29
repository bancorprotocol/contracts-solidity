module.exports = fetch;

const Web3 = require("web3");

const GENESIS_BLOCK_NUMBER = 3851136;

const OWNER_UPDATE_EVENT_HASH = Web3.utils.keccak256("OwnerUpdate(address,address)");

const CONVERSION_EVENT_LEGACY = [
    {"anonymous":false,"inputs":[{"indexed":true,"name":"fromToken","type":"address"},{"indexed":true,"name":"toToken","type":"address"},{"indexed":true,"name":"trader","type":"address"},{"indexed":false,"name":"inputAmount","type":"uint256"},{"indexed":false,"name":"outputAmount","type":"uint256"}],"name":"Change","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"fromToken","type":"address"},{"indexed":true,"name":"toToken","type":"address"},{"indexed":true,"name":"trader","type":"address"},{"indexed":false,"name":"inputAmount","type":"uint256"},{"indexed":false,"name":"outputAmount","type":"uint256"},{"indexed":false,"name":"_currentPriceN","type":"uint256"},{"indexed":false,"name":"_currentPriceD","type":"uint256"}],"name":"Conversion","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"name":"fromToken","type":"address"},{"indexed":true,"name":"toToken","type":"address"},{"indexed":true,"name":"trader","type":"address"},{"indexed":false,"name":"inputAmount","type":"uint256"},{"indexed":false,"name":"outputAmount","type":"uint256"},{"indexed":false,"name":"conversionFee","type":"int256"}],"name":"Conversion","type":"event"}
];

function parseOwnerUpdateEvent(log) {
    return {
        blockNumber: log.blockNumber,
        prevOwner: Web3.utils.toChecksumAddress(log.topics[1] ? log.topics[1].slice(-40) : log.data.slice(26, 66)),
        currOwner: Web3.utils.toChecksumAddress(log.topics[2] ? log.topics[2].slice(-40) : log.data.slice(90, 130))
    };
}

async function getPastLogs(web3, address, topic0, fromBlock, toBlock) {
    try {
        return await web3.eth.getPastLogs({address: address, topics: [topic0], fromBlock: fromBlock, toBlock: toBlock});
    }
    catch (error) {
        const midBlock = (fromBlock + toBlock) >> 1;
        const arr1 = await getPastLogs(web3, address, topic0, fromBlock, midBlock);
        const arr2 = await getPastLogs(web3, address, topic0, midBlock + 1, toBlock);
        return [...arr1, ...arr2];
    }
}

async function getPastEvents(contract, eventName, fromBlock, toBlock) {
    try {
        return await contract.getPastEvents(eventName, {fromBlock: fromBlock, toBlock: toBlock});
    }
    catch (error) {
        const midBlock = (fromBlock + toBlock) >> 1;
        const arr1 = await getPastEvents(contract, eventName, fromBlock, midBlock);
        const arr2 = await getPastEvents(contract, eventName, midBlock + 1, toBlock);
        return [...arr1, ...arr2];
    }
}

async function getOwnerUpdateEvents(web3, tokenAddress, fromBlock, toBlock) {
    const logs = await getPastLogs(web3, tokenAddress, OWNER_UPDATE_EVENT_HASH, fromBlock, toBlock);
    if (logs.length > 0)
        return logs.map(log => parseOwnerUpdateEvent(log));
    const prelogs = await getPastLogs(web3, tokenAddress, OWNER_UPDATE_EVENT_HASH, GENESIS_BLOCK_NUMBER, fromBlock - 1);
    if (prelogs.length > 0)
        return [parseOwnerUpdateEvent(prelogs[prelogs.length - 1])];
    throw new Error("Inactive Token");
}

async function getConversionEvents(web3, tokenAddress, fromBlock, toBlock) {
    const result = [];

    const batches = [{fromBlock: fromBlock}];
    const events = await getOwnerUpdateEvents(web3, tokenAddress, fromBlock, toBlock);
    for (const event of events.filter(event => event.blockNumber > fromBlock)) {
        batches[batches.length - 1].owner = event.prevOwner;
        batches[batches.length - 1].toBlock = event.blockNumber - 1;
        batches.push({fromBlock: event.blockNumber});
    }
    batches[batches.length - 1].owner = events[events.length - 1].currOwner;
    batches[batches.length - 1].toBlock = toBlock;

    let index = 0;
    for (const batch of batches) {
        for (const abi of CONVERSION_EVENT_LEGACY.slice(index)) {
            const converter = new web3.eth.Contract([abi], batch.owner);
            const events = await getPastEvents(converter, abi.name, batch.fromBlock, batch.toBlock);
            if (events.length > 0) {
                result.push(...events.map(event => ({
                    fromToken    : event.returnValues.fromToken    ,
                    toToken      : event.returnValues.toToken      ,
                    trader       : event.returnValues.trader       ,
                    inputAmount  : event.returnValues.inputAmount  ,
                    outputAmount : event.returnValues.outputAmount ,
                    conversionFee: event.returnValues.conversionFee,
                    blockNumber  : event.blockNumber
                })));
                index = CONVERSION_EVENT_LEGACY.indexOf(abi);
                break;
            }
        }
    }

    return result;
}

async function fetch(nodeAddress, tokenAddress, fromBlock, toBlock) {
    const web3 = new Web3(nodeAddress);
    const result = await getConversionEvents(web3, tokenAddress, fromBlock, toBlock);
    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
    return result;
}
