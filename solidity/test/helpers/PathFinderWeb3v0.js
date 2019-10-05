module.exports = {get};

const fs = require("fs");

const CONVERTER_ABI = JSON.parse(fs.readFileSync(__dirname + "/../../build/BancorConverter.abi"        ));
const REGISTRY_ABI  = JSON.parse(fs.readFileSync(__dirname + "/../../build/BancorConverterRegistry.abi"));

async function get(web3, sourceToken, targetToken, anchorToken, registryList) {
    const registries = registryList.map(x => web3.eth.contract(REGISTRY_ABI).at(x));
    const sourcePath = await getPath(web3, sourceToken, anchorToken, registries);
    const targetPath = await getPath(web3, targetToken, anchorToken, registries);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(web3, token, anchor, registries) {
    if (isEqual(token, anchor))
        return [token];

    for (const registry of registries) {
        const converterCount = await rpc(registry.converterCount(token));
        if (converterCount > 0) {
            const address = await rpc(registry.converterAddress(token, converterCount - 1));
            const converter = web3.eth.contract(CONVERTER_ABI).at(address);
            const connectorTokenCount = await getTokenCount(converter, "connectorTokenCount");
            for (let i = 0; i < connectorTokenCount; i++) {
                const connectorToken = await rpc(converter.connectorTokens(i));
                if (connectorToken != token) {
                    const path = await getPath(web3, connectorToken, anchor, registries);
                    if (path.length > 0)
                        return [token, await rpc(converter.token()), ...path];
                }
            }
            const reserveTokenCount = await getTokenCount(converter, "reserveTokenCount");
            for (let i = 0; i < reserveTokenCount; i++) {
                const reserveToken = await rpc(converter.reserveTokens(i));
                if (reserveToken != token) {
                    const path = await getPath(web3, reserveToken, anchor, registries);
                    if (path.length > 0)
                        return [token, await rpc(converter.token()), ...path];
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
            return await transaction;
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
            return await converter[funcName]();
        }
        catch (error) {
            if (!error.message.startsWith("Invalid JSON RPC response"))
                return 0;
        }
    }
}
