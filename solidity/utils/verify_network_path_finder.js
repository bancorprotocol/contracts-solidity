const fs     = require("fs");
const Web3   = require("web3");
const assert = require("assert");

const NODE_ADDRESS   = process.argv[2];
const FINDER_ADDRESS = process.argv[3];

const FINDER_ABI      = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorNetworkPathFinder.abi"));
const REGISTRY_ABI    = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorConverterRegistry.abi"));
const CONVERTER_ABI   = JSON.parse(fs.readFileSync(__dirname + "/../build/BancorConverter.abi"        ));
const SMART_TOKEN_ABI = JSON.parse(fs.readFileSync(__dirname + "/../build/SmartToken.abi"             ));

async function get(web3, sourceToken, targetToken, anchorToken, registry) {
    const sourcePath = await getPath(web3, sourceToken, anchorToken, registry);
    const targetPath = await getPath(web3, targetToken, anchorToken, registry);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(web3, token, anchorToken, registryContract) {
    if (token == anchorToken)
        return [token];

    const isSmartToken = await rpc(registryContract.methods.isSmartToken(token));
    const smartTokens = isSmartToken ? [token] : await rpc(registryContract.methods.getConvertibleTokenSmartTokens(token));
    for (const smartToken of smartTokens) {
        const smartTokenContract = new web3.eth.Contract(SMART_TOKEN_ABI, smartToken);
        const converterContract = new web3.eth.Contract(CONVERTER_ABI, await rpc(smartTokenContract.methods.owner()));
        const connectorTokenCount = await rpc(converterContract.methods.connectorTokenCount());
        for (let i = 0; i < connectorTokenCount; i++) {
            const connectorToken = await rpc(converterContract.methods.connectorTokens(i));
            if (connectorToken != token) {
                const path = await getPath(web3, connectorToken, anchorToken, registryContract);
                if (path.length > 0)
                    return [token, smartToken, ...path];
            }
        }
    }

    return [];
}

function getShortestPath(sourcePath, targetPath) {
    if (sourcePath.length > 0 && targetPath.length > 0) {
        let i = sourcePath.length - 1;
        let j = targetPath.length - 1;
        while (i >= 0 && j >= 0 && sourcePath[i] == targetPath[j]) {
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
    const finder = new web3.eth.Contract(FINDER_ABI, FINDER_ADDRESS);
    const registry = new web3.eth.Contract(REGISTRY_ABI, await rpc(finder.methods.converterRegistry()));
    const anchorToken = await rpc(finder.methods.anchorToken());

    const convertibleTokens = await rpc(registry.methods.getConvertibleTokens());
    for (let i = 0; i < convertibleTokens.length; i++) {
        for (let j = 0; j < convertibleTokens.length; j++) {
            const expected = await get(web3, convertibleTokens[i], convertibleTokens[j], anchorToken, registry);
            const actual = await rpc(finder.methods.get(convertibleTokens[i], convertibleTokens[j]));
            console.log(`path from ${i} to ${j} (out of ${convertibleTokens.length}): ${actual}`);
            assert.equal(`${actual}`, `${expected}`);
        }
    }

    if (web3.currentProvider.constructor.name == "WebsocketProvider")
        web3.currentProvider.connection.close();
}

run();