const fs = require("fs");
const os = require("os");
const Web3 = require("web3");

const NODE_ADDRESS = process.argv[2];

const PROTECTED_LIQUIDITIES_FILE_NAME = "protected_liquidities.csv";
const LOCKED_BALANCES_FILE_NAME       = "locked_balances.csv";
const SYSTEM_BALANCES_FILE_NAME       = "system_balances.csv";

const BATCH_SIZE = 100;

const LP_STORE_BLOCK_NUMBER = 11039642;

const LP_STORE_ADDRESS = "0xf5FAB5DBD2f3bf675dE4cB76517d4767013cfB55";

const LP_STORE_ABI = [
    {"inputs":[{"internalType":"uint256","name":"_id","type":"uint256"}],"name":"protectedLiquidity","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"contract IDSToken","name":"","type":"address"},{"internalType":"contract IERC20Token","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"_provider","type":"address"}],"name":"lockedBalanceCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"_provider","type":"address"},{"internalType":"uint256","name":"_startIndex","type":"uint256"},{"internalType":"uint256","name":"_endIndex","type":"uint256"}],"name":"lockedBalanceRange","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"contract IERC20Token","name":"_token","type":"address"}],"name":"systemBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"contract IDSToken","name":"_poolToken","type":"address"}],"name":"totalProtectedPoolAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"contract IDSToken","name":"_poolToken","type":"address"},{"internalType":"contract IERC20Token","name":"_reserveToken","type":"address"}],"name":"totalProtectedReserveAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract IERC20Token","name":"_token","type":"address"},{"indexed":false,"internalType":"uint256","name":"_prevAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"_newAmount","type":"uint256"}],"name":"SystemBalanceUpdated","type":"event"},
];

const TOKEN_ABI = [
    {'inputs':[],'name':'owner','outputs':[{'internalType':'address','name':'','type':'address'}],'stateMutability':'view','type':'function'},
];

const CONVERTER_ABI = [
    {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"connectorTokens","outputs":[{"internalType":"contract IERC20Token","name":"","type":"address"}],"stateMutability":"view","type":"function"},
];

function printRow(fileName, ...cellValues) {
    const row = cellValues.map(value => String(value).trim()).join(",") + os.EOL;
    fs.appendFileSync(fileName, row, {encoding: "utf8"});
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

async function fetchProtectedLiquidities(web3, store) {
    fs.writeFileSync(PROTECTED_LIQUIDITIES_FILE_NAME, "", {encoding: "utf8"});

    printRow(
        PROTECTED_LIQUIDITIES_FILE_NAME,
        "provider     ",
        "poolToken    ",
        "reserveToken ",
        "poolAmount   ",
        "reserveAmount",
        "reserveRateN ",
        "reserveRated ",
        "timestamp    ",
    );

    const count = Web3.utils.toBN(await web3.eth.getStorageAt(LP_STORE_ADDRESS, 4)).toNumber();
    for (let i = 0; i < count; i += BATCH_SIZE) {
        const ids = [...Array(Math.min(count, BATCH_SIZE + i) - i).keys()].map(n => n + i);
        const pls = await Promise.all(ids.map(id => rpc(store.methods.protectedLiquidity(id))));
        for (const pl of pls) {
            printRow(PROTECTED_LIQUIDITIES_FILE_NAME, ...[...Array(8).keys()].map(n => pl[n]));
        }
    }
}

async function fetchLockedBalances(web3, store) {
    fs.writeFileSync(LOCKED_BALANCES_FILE_NAME, "", {encoding: "utf8"});

    printRow(
        LOCKED_BALANCES_FILE_NAME,
        "provider      ",
        "amount        ",
        "expirationTime",
    );

    const providers = [...new Set(fs.readFileSync(PROTECTED_LIQUIDITIES_FILE_NAME, {encoding: "utf8"}).split(os.EOL).slice(1, -1).map(line => line.split(",")[0]))];
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

async function fetchSystemBalances(web3, store) {
    fs.writeFileSync(SYSTEM_BALANCES_FILE_NAME, "", {encoding: "utf8"});

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

    const events          = await getPastEvents(store, "SystemBalanceUpdated", LP_STORE_BLOCK_NUMBER, await web3.eth.getBlockNumber());
    const tokens          = [...new Set(events.map(event => event.returnValues._token))];
    const owners          = await Promise.all(tokens.map(token => rpc(new web3.eth.Contract(TOKEN_ABI, token).methods.owner())));
    const converters      = owners.map(owner => new web3.eth.Contract(CONVERTER_ABI, owner));
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

async function run() {
    const web3 = new Web3(NODE_ADDRESS);
    const store = new web3.eth.Contract(LP_STORE_ABI, LP_STORE_ADDRESS);
    await fetchProtectedLiquidities(web3, store);
    await fetchLockedBalances(web3, store);
    await fetchSystemBalances(web3, store);
    if (web3.currentProvider.disconnect) {
        web3.currentProvider.disconnect();
    }
}

run();