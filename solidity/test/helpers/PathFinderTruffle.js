module.exports = {get};

const fs = require("fs");

const BancorConverter = artifacts.require("BancorConverter");
const BancorConverterRegistry = artifacts.require("BancorConverterRegistry");

async function get(sourceToken, targetToken, anchorToken, registryList) {
    const registries = registryList.map(x => BancorConverterRegistry.at(x));
    const sourcePath = await getPath(sourceToken, anchorToken, registries);
    const targetPath = await getPath(targetToken, anchorToken, registries);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(token, anchor, registries) {
    if (isEqual(token, anchor))
        return [token];

    for (const registry of registries) {
        const converterCount = await registry.converterCount(token);
        if (converterCount > 0) {
            const address = await registry.converterAddress(token, converterCount - 1);
            const converter = BancorConverter.at(address);
            const reserveTokenCount = await converter.reserveTokenCount();
            for (let i = 0; i < reserveTokenCount; i++) {
                const reserveToken = await converter.reserveTokens(i);
                if (reserveToken != token) {
                    const path = await getPath(reserveToken, anchor, registries);
                    if (path.length > 0)
                        return [token, await converter.token(), ...path];
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
