/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const BancorConverter = require('./helpers/BancorConverter');

const EtherToken = artifacts.require('EtherToken');
const SmartToken = artifacts.require('SmartToken');
const ContractIds = artifacts.require('ContractIds');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorConverterRegistry = artifacts.require('BancorConverterRegistry');
const BancorNetworkPathFinder = artifacts.require('BancorNetworkPathFinder');

async function get(sourceToken, targetToken, anchorToken, registryList) {
    const sourcePath = await getPath(sourceToken, anchorToken, registryList);
    const targetPath = await getPath(targetToken, anchorToken, registryList);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(token, anchorToken, registryList) {
    if (token == anchorToken)
        return [token];

    for (const registry of registryList) {
        const address = await registry.latestConverterAddress(token);
        const converter = BancorConverter.at(address);
        const connectorTokenCount = await getTokenCount(converter, "connectorTokenCount");
        for (let i = 0; i < connectorTokenCount; i++) {
            const connectorToken = await converter.connectorTokens(i);
            if (connectorToken != token) {
                const path = await getPath(connectorToken, anchorToken, registryList);
                if (path.length > 0)
                    return [token, await converter.token(), ...path];
            }
        }
        const reserveTokenCount = await getTokenCount(converter, "reserveTokenCount");
        for (let i = 0; i < reserveTokenCount; i++) {
            const reserveToken = await converter.reserveTokens(i);
            if (reserveToken != token) {
                const path = await getPath(reserveToken, anchorToken, registryList);
                if (path.length > 0)
                    return [token, await converter.token(), ...path];
            }
        }
    }

    return [];
}

async function getTokenCount(converter, funcName) {
    try {
        return await converter[funcName]();
    }
    catch (error) {
        return 0;
    }
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

const tests = [
    {title: 'old converter test', version: 4},
    {title: 'new converter test', version: null},
];

contract('BancorNetworkPathFinder', accounts => {
    for (const test of tests) {
        describe(test.title, () => {
            let pathFinder;
            let converter1;
            let converter2;
            let converter3;
            let converter4;
            let converter5;
            let converter6;
            let converter7;
            let etherToken;
            let smartToken1;
            let smartToken2;
            let smartToken3;
            let smartToken4;
            let smartToken5;
            let smartToken6;
            let smartToken7;
            let smartToken8;
            let smartToken9;
            let smartTokenA;
            let smartTokenB;
            let smartTokenC;
            let smartTokenD;
            let smartTokenE;
            let smartTokenF;
            let contractIds;
            let contractRegistry;
            let converterRegistry1;
            let converterRegistry2;
            let converterRegistry3;

            before(async () => {
                contractIds = await ContractIds.new();
                contractRegistry = await ContractRegistry.new();
                pathFinder = await BancorNetworkPathFinder.new(contractRegistry.address);

                etherToken  = await EtherToken.new();
                smartToken1 = await SmartToken.new('Token1', 'TKN1', 18);
                smartToken2 = await SmartToken.new('Token2', 'TKN2', 18);
                smartToken3 = await SmartToken.new('Token3', 'TKN3', 18);
                smartToken4 = await SmartToken.new('Token4', 'TKN4', 18);
                smartToken5 = await SmartToken.new('Token5', 'TKN5', 18);
                smartToken6 = await SmartToken.new('Token6', 'TKN6', 18);
                smartToken7 = await SmartToken.new('Token7', 'TKN7', 18);
                smartToken8 = await SmartToken.new('Token8', 'TKN8', 18);
                smartToken9 = await SmartToken.new('Token9', 'TKN9', 18);
                smartTokenA = await SmartToken.new('TokenA', 'TKNA', 18);
                smartTokenB = await SmartToken.new('TokenB', 'TKNB', 18);
                smartTokenC = await SmartToken.new('TokenC', 'TKNC', 18);
                smartTokenD = await SmartToken.new('TokenD', 'TKND', 18);
                smartTokenE = await SmartToken.new('TokenE', 'TKNE', 18);
                smartTokenF = await SmartToken.new('TokenF', 'TKNF', 18);

                converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, etherToken .address, 500000, test.version);
                converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken4.address, 500000, test.version);
                converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, smartToken6.address, 500000, test.version);
                converter4 = await BancorConverter.new(smartToken4.address, contractRegistry.address, 0, smartToken8.address, 500000, test.version);
                converter5 = await BancorConverter.new(smartToken5.address, contractRegistry.address, 0, smartTokenA.address, 500000, test.version);
                converter6 = await BancorConverter.new(smartToken6.address, contractRegistry.address, 0, smartTokenC.address, 500000, test.version);
                converter7 = await BancorConverter.new(smartToken7.address, contractRegistry.address, 0, smartTokenE.address, 500000, test.version);

                converterRegistry1 = await BancorConverterRegistry.new();
                converterRegistry2 = await BancorConverterRegistry.new();
                converterRegistry3 = await BancorConverterRegistry.new();

                const enableVirtualBalance = test.version ? false : undefined;
                await converter2.addReserve(smartToken1.address, 500000, enableVirtualBalance);
                await converter3.addReserve(smartToken1.address, 500000, enableVirtualBalance);
                await converter4.addReserve(smartToken1.address, 500000, enableVirtualBalance);
                await converter5.addReserve(smartToken1.address, 500000, enableVirtualBalance);
                await converter6.addReserve(smartToken1.address, 500000, enableVirtualBalance);
                await converter7.addReserve(smartToken2.address, 500000, enableVirtualBalance);

                await converterRegistry1.registerConverter(smartToken1.address, converter1.address);
                await converterRegistry1.registerConverter(smartToken2.address, converter2.address);
                await converterRegistry1.registerConverter(smartToken3.address, converter3.address);
                await converterRegistry1.registerConverter(smartToken4.address, converter4.address);
                await converterRegistry2.registerConverter(smartToken5.address, converter5.address);
                await converterRegistry2.registerConverter(smartToken6.address, converter6.address);
                await converterRegistry3.registerConverter(smartToken7.address, converter7.address);
            });

            it('should abort with an error if the anchor-token is not yet updated', async () => {
                await contractRegistry.registerAddress(await contractIds.BNT_TOKEN(), smartToken1.address);
                await utils.catchInvalidOpcode(pathFinder.get(smartToken2.address, smartToken3.address, [converterRegistry1.address, converterRegistry2.address, converterRegistry3.address]));
            });

            it('should abort with an error if the anchor-token is already updated', async () => {
                await pathFinder.updateAnchorToken();
                await utils.catchRevert(pathFinder.updateAnchorToken());
            });

            it('should return an empty path if the source-token has no path to the anchor-token', async () => {
                const sourceToken = utils.zeroAddress;
                const targetToken = smartToken1.address;
                const expected = await get(sourceToken, targetToken, smartToken1.address, [converterRegistry1, converterRegistry2, converterRegistry3]);
                const actual = await pathFinder.get(sourceToken, targetToken, [converterRegistry1.address, converterRegistry2.address, converterRegistry3.address]);
                assert.equal(actual + expected, []);
            });

            it('should return an empty path if the target-token has no path to the anchor-token', async () => {
                const sourceToken = smartToken1.address;
                const targetToken = utils.zeroAddress;
                const expected = await get(sourceToken, targetToken, smartToken1.address, [converterRegistry1, converterRegistry2, converterRegistry3]);
                const actual = await pathFinder.get(sourceToken, targetToken, [converterRegistry1.address, converterRegistry2.address, converterRegistry3.address]);
                assert.equal(actual + expected, []);
            });

            for (let i = 1; i <= 7; i++) {
                for (let j = 1; j <= 7; j++) {
                    it(`from smartToken${i} to smartToken${j}`, async () => {
                        const sourceToken = eval(`smartToken${i}.address`);
                        const targetToken = eval(`smartToken${j}.address`);
                        const expected = await get(sourceToken, targetToken, smartToken1.address, [converterRegistry1, converterRegistry2, converterRegistry3]);
                        const actual = await pathFinder.get(sourceToken, targetToken, [converterRegistry1.address, converterRegistry2.address, converterRegistry3.address]);
                        assert.equal(`${actual}`, `${expected}`);
                    });
                }
            }
        });
    }
});
