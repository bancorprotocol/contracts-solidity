const fs = require("fs");
const os = require("os");
const path = require("path");
const Web3 = require("web3");

const {
    ADD_PROTECTED_LIQUIDITIES   ,
    ADD_LOCKED_BALANCES         ,
    ADD_SYSTEM_BALANCES         ,
    UPDATE_PROTECTED_LIQUIDITIES,
    REMOVE_PROTECTED_LIQUIDITIES,
    NEXT_PROTECTED_LIQUIDITY_ID ,
} = require("./file_names.js");

const DATA_FOLDER   = process.argv[2];
const NODE_ADDRESS  = process.argv[3];
const STORE_ADDRESS = process.argv[4];
const PRIVATE_KEY   = process.argv[5];
const CURRENT_PHASE = process.argv[6];

const BATCH_SIZES = {
    [ADD_PROTECTED_LIQUIDITIES   ]: 20,
    [ADD_LOCKED_BALANCES         ]: 80,
    [ADD_SYSTEM_BALANCES         ]: 50,
    [UPDATE_PROTECTED_LIQUIDITIES]: 60,
    [REMOVE_PROTECTED_LIQUIDITIES]: 90,
};

const MIN_GAS_LIMIT = 100000;

const CFG_FILE_NAME = "migration.json";
const ARTIFACTS_DIR = path.resolve(__dirname, "../../build");

const ROLE_SEEDER = Web3.utils.keccak256("ROLE_SEEDER");
const ROLE_OWNER  = Web3.utils.keccak256("ROLE_OWNER");

const readFileSync   = (fileName          ) => fs.readFileSync  (path.resolve(DATA_FOLDER, fileName),           {encoding: "utf8"});
const writeFileSync  = (fileName, fileData) => fs.writeFileSync (path.resolve(DATA_FOLDER, fileName), fileData, {encoding: "utf8"});
const appendFileSync = (fileName, fileData) => fs.appendFileSync(path.resolve(DATA_FOLDER, fileName), fileData, {encoding: "utf8"});

if (!fs.existsSync(CFG_FILE_NAME)) {
    fs.writeFileSync(CFG_FILE_NAME, "{}");
}

function getConfig() {
    return JSON.parse(fs.readFileSync(CFG_FILE_NAME), {encoding: "utf8"});
}

function setConfig(record) {
    fs.writeFileSync(CFG_FILE_NAME, JSON.stringify({...getConfig(), ...record}, null, 4));
}

async function scan(message) {
    process.stdout.write(message);
    return await new Promise((resolve, reject) => {
        process.stdin.resume();
        process.stdin.once("data", (data) => {
            process.stdin.pause();
            resolve(data.toString().trim());
        });
    });
}

async function getGasPrice(web3) {
    while (true) {
        const nodeGasPrice = await web3.eth.getGasPrice();
        const userGasPrice = await scan(`Enter gas-price or leave empty to use ${nodeGasPrice}: `);
        if (/^\d+$/.test(userGasPrice)) {
            return userGasPrice;
        }
        if (userGasPrice === "") {
            return nodeGasPrice;
        }
        console.log("Illegal gas-price");
    }
}

async function getTransactionReceipt(web3) {
    while (true) {
        const hash = await scan("Enter transaction-hash or leave empty to retry: ");
        if (/^0x([0-9A-Fa-f]{64})$/.test(hash)) {
            const receipt = await web3.eth.getTransactionReceipt(hash);
            if (receipt) {
                return receipt;
            }
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

async function send(web3, account, gasPrice, transaction, value = 0) {
    while (true) {
        try {
            const tx = {
                to: transaction._parent._address,
                data: transaction.encodeABI(),
                gas: Math.max(await transaction.estimateGas({from: account.address, value: value}), MIN_GAS_LIMIT),
                gasPrice: gasPrice || (await getGasPrice(web3)),
                chainId: await web3.eth.net.getId(),
                value: value
            };
            const signed = await web3.eth.accounts.signTransaction(tx, account.privateKey);
            const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
            return receipt;
        }
        catch (error) {
            console.log(error.message);
            const receipt = await getTransactionReceipt(web3);
            if (receipt) {
                return receipt;
            }
        }
    }
}

async function deploy(web3, account, gasPrice, contractId, contractName, contractArgs) {
    if (getConfig()[contractId] === undefined) {
        const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".abi"), {encoding: "utf8"});
        const bin = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".bin"), {encoding: "utf8"});
        const contract = new web3.eth.Contract(JSON.parse(abi));
        const options = {data: "0x" + bin, arguments: contractArgs};
        const transaction = contract.deploy(options);
        const receipt = await send(web3, account, gasPrice, transaction);
        const args = transaction.encodeABI().slice(options.data.length);
        console.log(`${contractId} deployed at ${receipt.contractAddress}`);
        setConfig({
            [contractId]: {
                name: contractName,
                addr: receipt.contractAddress,
                args: args
            }
        });
    }
    return deployed(web3, contractName, getConfig()[contractId].addr);
}

function deployed(web3, contractName, contractAddr) {
    const abi = fs.readFileSync(path.join(ARTIFACTS_DIR, contractName + ".abi"), {encoding: "utf8"});
    return new web3.eth.Contract(JSON.parse(abi), contractAddr);
}

async function writeData(execute, fileName, contractMethod) {
    const lines = readFileSync(fileName).split(os.EOL).slice(1, -1);
    for (let i = 0; i < lines.length; i += BATCH_SIZES[fileName]) {
        const entries = lines.slice(i, i + BATCH_SIZES[fileName]).map(line => line.split(","));
        const values = [...Array(entries[0].length).keys()].map(n => entries.map(entry => entry[n]));
        await execute(contractMethod(...values));
    }
}

async function run() {
    const web3 = new Web3(NODE_ADDRESS);

    const gasPrice = await getGasPrice(web3);
    const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    const web3Func = (func, ...args) => func(web3, account, gasPrice, ...args);

    let phase = 0;
    if (getConfig()[CURRENT_PHASE] === undefined) {
        setConfig({[CURRENT_PHASE]: phase});
    }

    const execute = async (transaction, ...args) => {
        if (getConfig()[CURRENT_PHASE] === phase++) {
            await web3Func(send, transaction, ...args);
            console.log(`phase ${phase} executed`);
            setConfig({[CURRENT_PHASE]: phase});
        }
    };

    const store = await web3Func(deploy, "liquidityProtectionStore", "LiquidityProtectionStore", []);

    switch (CURRENT_PHASE) {
    case "1":
        await execute(store.methods.grantRole(ROLE_SEEDER, account.address));
        await writeData(execute, ADD_PROTECTED_LIQUIDITIES, store.methods.addProtectedLiquidities);
        await writeData(execute, ADD_LOCKED_BALANCES      , store.methods.addLockedBalances      );
        await writeData(execute, ADD_SYSTEM_BALANCES      , store.methods.addSystemBalances      );
        break;
    case "2":
        await writeData(execute, ADD_PROTECTED_LIQUIDITIES, store.methods.addProtectedLiquidities);
        await writeData(execute, ADD_LOCKED_BALANCES      , store.methods.addLockedBalances      );
        await writeData(execute, ADD_SYSTEM_BALANCES      , store.methods.addSystemBalances      );
        const nextProtectedLiquidityId = readFileSync(NEXT_PROTECTED_LIQUIDITY_ID);
        await execute(store.methods.setNextProtectedLiquidityId(nextProtectedLiquidityId));
        break;
    case "3":
        const owned = deployed(web3, "Owned", STORE_ADDRESS);
        await execute(store.methods.grantRole(ROLE_SEEDER, "0x".padEnd(42, "0")));
        await execute(store.methods.grantRole(ROLE_OWNER, await owned.methods.owner().call()));
        break;
    }

    if (web3.currentProvider.disconnect) {
        web3.currentProvider.disconnect();
    }
}

run();