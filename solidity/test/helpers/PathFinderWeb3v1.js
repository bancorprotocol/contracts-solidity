module.exports = {get};

const fs = require("fs");

const ARTIFACTS_DIR = __dirname + "/../../build/";
const CONVERTER_ABI = JSON.parse(fs.readFileSync(ARTIFACTS_DIR + "BancorConverter.abi"        , {encoding: "utf8"}));
const REGISTRY_ABI  = JSON.parse(fs.readFileSync(ARTIFACTS_DIR + "BancorConverterRegistry.abi", {encoding: "utf8"}));

async function get(web3, sourceToken, targetToken, anchorToken, registryList) {
    const registries = registryList.map(x => new web3.eth.Contract(REGISTRY_ABI, x));
    const sourcePath = await getPath(web3, sourceToken, anchorToken, registries);
    const targetPath = await getPath(web3, targetToken, anchorToken, registries);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(web3, token, anchor, registries) {
    if (isEqual(token, anchor))
        return [token];

    for (const registry of registries) {
        const converterCount = await rpc(registry.methods.converterCount(token));
        if (converterCount > 0) {
            const address = await rpc(registry.methods.converterAddress(token, converterCount - 1));
            const converter = new web3.eth.Contract(CONVERTER_ABI, address);
            const connectorTokenCount = await getTokenCount(converter, "connectorTokenCount");
            for (let i = 0; i < connectorTokenCount; i++) {
                const connectorToken = await rpc(converter.methods.connectorTokens(i));
                const path = await getPath(web3, connectorToken, anchor, registries);
                if (path.length > 0) {
                    const midToken = await rpc(converter.methods.token());
                    return isEqual(token, midToken) ? [token, ...path] : [token, midToken, ...path];
                }
            }
            const reserveTokenCount = await getTokenCount(converter, "reserveTokenCount");
            for (let i = 0; i < reserveTokenCount; i++) {
                const reserveToken = await rpc(converter.methods.reserveTokens(i));
                const path = await getPath(web3, reserveToken, anchor, registries);
                if (path.length > 0) {
                    const midToken = await rpc(converter.methods.token());
                    return isEqual(token, midToken) ? [token, ...path] : [token, midToken, ...path];
                }
            }
        }
    }

    return [];
}

function getShortestPath(sourcePath, targetPath) {
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

function isEqual(token1, token2) {
    return token1.toLowerCase() === token2.toLowerCase();
}

async function rpc(transaction) {
    while (true) {
        try {
            return await transaction.call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                console.log(error.message);
        }
    }
}

async function getTokenCount(converter, methodName) {
    while (true) {
        try {
            return await converter.methods[methodName]().call();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                return 0;
        }
    }
}
