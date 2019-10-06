module.exports = {get};

const fs = require("fs");

const CONVERTER_ABI = JSON.parse(fs.readFileSync(__dirname + "/../../build/BancorConverter.abi"        ));
const REGISTRY_ABI  = JSON.parse(fs.readFileSync(__dirname + "/../../build/BancorConverterRegistry.abi"));

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
