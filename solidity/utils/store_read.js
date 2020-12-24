const fs = require("fs");
const os = require("os");
const path = require("path");
const Web3 = require("web3");

const NODE_ADDRESS    = process.argv[2];
const STORE_ADDRESS   = process.argv[3];
const STORE_BLOCK_NUM = process.argv[4];
const STORAGE_INDEX   = process.argv[5];
const DATA_FOLDER     = process.argv[6];

const PROTECTED_LIQUIDITIES_FILE_NAME = "protected_liquidities.csv";
const LOCKED_BALANCES_FILE_NAME       = "locked_balances.csv";
const SYSTEM_BALANCES_FILE_NAME       = "system_balances.csv";

const BATCH_SIZE = 100;

const ARTIFACTS_DIR = path.resolve(__dirname, "../build");

const readFileSync   = (fileName          ) => fs.readFileSync  (DATA_FOLDER + "/" + fileName,           {encoding: "utf8"});
const writeFileSync  = (fileName, fileData) => fs.writeFileSync (DATA_FOLDER + "/" + fileName, fileData, {encoding: "utf8"});
const appendFileSync = (fileName, fileData) => fs.appendFileSync(DATA_FOLDER + "/" + fileName, fileData, {encoding: "utf8"});

if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER);
}

function printRow(fileName, ...cellValues) {
    const row = cellValues.map(value => String(value).trim()).join(",") + os.EOL;
    appendFileSync(fileName, row);
    process.stdout.write(row);
}

async function rpc(func) {
    while (true) {
        try {
            return await func.call();
        }
        catch (error) {
            console.log(error.message);
            if (error.message.startsWith("Invalid JSON RPC response") || error.message.endsWith("project ID request rate exceeded")) {
                await new Promise(r => setTimeout(r, 10000));
            }
            else {
                throw error;
            }
        }
    }
}

async function getPastEvents(contract, eventName, fromBlock, toBlock, filter) {
    if (fromBlock <= toBlock) {
        try {
            return await contract.getPastEvents(eventName, {fromBlock: fromBlock, toBlock: toBlock, filter: filter});
        }
        catch (error) {
            const midBlock = (fromBlock + toBlock) >> 1;
            const arr1 = await getPastEvents(contract, eventName, fromBlock, midBlock);
            const arr2 = await getPastEvents(contract, eventName, midBlock + 1, toBlock);
            return [...arr1, ...arr2];
        }
    }
    return [];
}

async function readProtectedLiquidities(web3, store) {
    writeFileSync(PROTECTED_LIQUIDITIES_FILE_NAME, "");

    printRow(
        PROTECTED_LIQUIDITIES_FILE_NAME,
        "id           ",
        "provider     ",
        "poolToken    ",
        "reserveToken ",
        "poolAmount   ",
        "reserveAmount",
        "reserveRateN ",
        "reserveRated ",
        "timestamp    ",
    );

    const count = Web3.utils.toBN(await web3.eth.getStorageAt(STORE_ADDRESS, STORAGE_INDEX)).toNumber();
    writeFileSync("NextProtectedLiquidityId.txt", String(count));

    for (let i = 0; i < count; i += BATCH_SIZE) {
        const ids = [...Array(Math.min(count, BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const pls = await Promise.all(ids.map(id => rpc(store.methods.protectedLiquidity(id))));
        for (let j = 0; j < ids.length; j++) {
            const values = Object.keys(pls[j]).map(key => pls[j][key]);
            if (values.some(value => Web3.utils.toBN(value).gtn(0))) {
                printRow(PROTECTED_LIQUIDITIES_FILE_NAME, ids[j], ...values);
            }
        }
    }
}

async function readLockedBalances(web3, store) {
    writeFileSync(LOCKED_BALANCES_FILE_NAME, "");

    printRow(
        LOCKED_BALANCES_FILE_NAME,
        "provider      ",
        "amount        ",
        "expirationTime",
    );

    const providers = [...new Set(readFileSync(PROTECTED_LIQUIDITIES_FILE_NAME).split(os.EOL).slice(1, -1).map(line => line.split(",")[1]))];
    for (let i = 0; i < providers.length; i += BATCH_SIZE) {
        const indexes = [...Array(Math.min(providers.length, BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const counts = await Promise.all(indexes.map(index => rpc(store.methods.lockedBalanceCount(providers[index]))));
        for (let j = 0; j < indexes.length; j++) {
            if (counts[j] > 0) {
                const lbs = await rpc(store.methods.lockedBalanceRange(providers[indexes[j]], 0, counts[j]));
                for (let i = 0; i < counts[j]; i++) {
                    printRow(LOCKED_BALANCES_FILE_NAME, providers[indexes[j]], ...[...Array(2).keys()].map(n => lbs[n][i]));
                }
            }
        }
    }
}

async function readSystemBalances(web3, store) {
    writeFileSync(SYSTEM_BALANCES_FILE_NAME, "");

    printRow(
        SYSTEM_BALANCES_FILE_NAME,
        "token         ",
        "systemBalance ",
        "poolAmount    ",
        "reserve0      ",
        "reserve1      ",
        "reserve0Amount",
        "reserve1Amount",
    );

    const events          = await getPastEvents(store, "SystemBalanceUpdated", STORE_BLOCK_NUM, await web3.eth.getBlockNumber());
    const tokens          = [...new Set(events.map(event => event.returnValues._token))];
    const owners          = await Promise.all(tokens.map(token => rpc(deployed(web3, "DSToken", token).methods.owner())));
    const converters      = owners.map(owner => deployed(web3, "ConverterBase", owner));
    const systemBalances  = await Promise.all(tokens.map(token => rpc(store.methods.systemBalance(token))));
    const poolAmounts     = await Promise.all(tokens.map(token => rpc(store.methods.totalProtectedPoolAmount(token))));
    const reserve0s       = await Promise.all(converters.map(converter => rpc(converter.methods.connectorTokens(0))));
    const reserve1s       = await Promise.all(converters.map(converter => rpc(converter.methods.connectorTokens(1))));
    const reserve0Amounts = await Promise.all(tokens.map((token, i) => rpc(store.methods.totalProtectedReserveAmount(token, reserve0s[i]))));
    const reserve1Amounts = await Promise.all(tokens.map((token, i) => rpc(store.methods.totalProtectedReserveAmount(token, reserve1s[i]))));

    for (let i = 0; i < tokens.length; i++) {
        printRow(
            SYSTEM_BALANCES_FILE_NAME,
            tokens         [i],
            systemBalances [i],
            poolAmounts    [i],
            reserve0s      [i],
            reserve1s      [i],
            reserve0Amounts[i],
            reserve1Amounts[i],
        );
    }
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".abi"), {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const store = deployed(web3, "LiquidityProtectionStore", STORE_ADDRESS);
    await readProtectedLiquidities(web3, store);
    await readLockedBalances(web3, store);
    await readSystemBalances(web3, store);
    if (web3.currentProvider.disconnect) {
        web3.currentProvider.disconnect();
    }
}

run();