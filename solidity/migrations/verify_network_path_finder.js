const fs     = require("fs");
const Web3   = require("web3");
const assert = require("assert");

const NODE_ADDRESS  = process.argv[2];
const PATH_FINDER   = process.argv[3];
const REGISTRY_LIST = process.argv.slice(4);

const FINDER_ABI    = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorNetworkPathFinder.abi"));
const REGISTRY_ABI  = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorConverterRegistry.abi"));
const CONVERTER_ABI = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorConverter.abi"        ));

async function get(web3, sourceToken, targetToken, anchorToken, registries) {
    const sourcePath = await getPath(web3, sourceToken, anchorToken, registries);
    const targetPath = await getPath(web3, targetToken, anchorToken, registries);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(web3, token, anchor, registries) {
    if (isEqual(token, anchor))
        return [token];

    for (const registry of registries) {
        const address = await rpc(registry.methods.latestConverterAddress(token));
        const converter = new web3.eth.Contract(CONVERTER_ABI, address);
        const connectorTokenCount = await getTokenCount(converter, "connectorTokenCount");
        for (let i = 0; i < connectorTokenCount; i++) {
            const connectorToken = await rpc(converter.methods.connectorTokens(i));
            if (connectorToken != token) {
                const path = await getPath(web3, connectorToken, anchor, registries);
                if (path.length > 0)
                    return [token, await rpc(converter.methods.token()), ...path];
            }
        }
        const reserveTokenCount = await getTokenCount(converter, "reserveTokenCount");
        for (let i = 0; i < reserveTokenCount; i++) {
            const reserveToken = await rpc(converter.methods.reserveTokens(i));
            if (reserveToken != token) {
                const path = await getPath(web3, reserveToken, anchor, registries);
                if (path.length > 0)
                    return [token, await rpc(converter.methods.token()), ...path];
            }
        }
    }

    return [];
}

async function getTokenCount(converter, funcName) {
    while (true) {
        try {
            return await converter.methods[funcName]().call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                return 0;
        }
    }
}

function getShortestPath(sourcePath, targetPath) {
    if (sourcePath.length > 0 && targetPath.length > 0) {
        let i = sourcePath.length - 1;
        let j = targetPath.length - 1;
        while (i >= 0 && j >= 0 && isEqual(sourcePath[i], targetPath[j])) {
            i--;
            j--;
        }

        const path = [];
        for (let n = 0; n <= i + 1; n++)
            path.push(sourcePath[n]);
        for (let n = j; n >= 0; n--)
            path.push(targetPath[n]);
        return path;
    }

    return [];
}

function isEqual(token1, token2) {
    return token1.toLowerCase() === token2.toLowerCase();
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
    const finder = new web3.eth.Contract(FINDER_ABI, PATH_FINDER);
    const anchorToken = await rpc(finder.methods.anchorToken());
    const registries = REGISTRY_LIST.map(x => new web3.eth.Contract(REGISTRY_ABI, x));

    for (const registry of registries) {
        const tokenCount = await rpc(registry.methods.tokenCount());
        for (let i = 0; i < tokenCount; i++) {
            const sourceToken = await rpc(registry.methods.tokens(i));
            for (let j = i + 1; j < tokenCount; j++) {
                const targetToken = await rpc(registry.methods.tokens(j));
                const expected = await get(web3, sourceToken, targetToken, anchorToken, registries);
                const actual = await rpc(finder.methods.get(sourceToken, targetToken, REGISTRY_LIST));
                assert.equal(actual.join(', ').toLowerCase(), expected.join(', ').toLowerCase());
                console.log(`path from ${i} to ${j} (out of ${tokenCount}): ${actual}`);
            }
        }
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();