/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const EtherToken = artifacts.require('EtherToken');
const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorConverter = artifacts.require('BancorConverter');
const BancorConverterRegistry = artifacts.require('BancorConverterRegistry');
const BancorConverterRegistryData = artifacts.require('BancorConverterRegistryData');
const BancorNetworkPathFinder = artifacts.require('BancorNetworkPathFinder');

async function print(sourceToken, targetToken, path) {
    const sourceSymbol = await SmartToken.at(sourceToken).symbol();
    const targetSymbol = await SmartToken.at(targetToken).symbol();
    const symbols = await Promise.all(path.map(token => SmartToken.at(token).symbol()));
    console.log(`path from ${sourceSymbol} to ${targetSymbol} = [${symbols}]`);
}

async function generatePath(sourceToken, targetToken, anchorToken, converterRegistry) {
    const sourcePath = await getPath(sourceToken, anchorToken, converterRegistry);
    const targetPath = await getPath(targetToken, anchorToken, converterRegistry);
    return getShortestPath(sourcePath, targetPath);
}

async function getPath(token, anchorToken, converterRegistry) {
    if (token == anchorToken)
        return [token];

    const isSmartToken = await converterRegistry.isSmartToken(token);
    const smartTokens = isSmartToken ? [token] : await converterRegistry.getConvertibleTokenSmartTokens(token);
    for (const smartToken of smartTokens) {
        const converter = BancorConverter.at(await SmartToken.at(smartToken).owner());
        const connectorTokenCount = await converter.connectorTokenCount();
        for (let i = 0; i < connectorTokenCount; i++) {
            const connectorToken = await converter.connectorTokens(i);
            if (connectorToken != token) {
                const path = await getPath(connectorToken, anchorToken, converterRegistry);
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
        for (let m = 0; m <= i + 1; m++)
            path.push(sourcePath[m]);
        for (let n = j; n >= 0; n--)
            path.push(targetPath[n]);

        let length = 0;
        for (let p = 0; p < path.length; p += 1) {
            for (let q = p + 2; q < path.length - p % 2; q += 2) {
                if (path[p] == path[q])
                    p = q;
            }
            path[length++] = path[p];
        }

        return path.slice(0, length);
    }

    return [];
}

contract('BancorNetworkPathFinder', accounts => {
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
    let anchorToken;
    let contractRegistry
    let converterRegistry;
    let converterRegistryData;

    before(async function() {
        etherToken  = await EtherToken.new('Token0', 'TKN0');
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
        anchorToken = etherToken.address;

        contractRegistry = await ContractRegistry.new();

        pathFinder            = await BancorNetworkPathFinder    .new(contractRegistry.address);
        converterRegistry     = await BancorConverterRegistry    .new(contractRegistry.address);
        converterRegistryData = await BancorConverterRegistryData.new(contractRegistry.address);

        converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, etherToken .address, 500000);
        converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken4.address, 500000);
        converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, smartToken6.address, 500000);
        converter4 = await BancorConverter.new(smartToken4.address, contractRegistry.address, 0, smartToken8.address, 500000);
        converter5 = await BancorConverter.new(smartToken5.address, contractRegistry.address, 0, smartTokenA.address, 500000);
        converter6 = await BancorConverter.new(smartToken6.address, contractRegistry.address, 0, smartTokenC.address, 500000);
        converter7 = await BancorConverter.new(smartToken7.address, contractRegistry.address, 0, smartTokenE.address, 500000);

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY     , converterRegistry    .address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        await converter2.addReserve(smartToken1.address, 500000);
        await converter3.addReserve(smartToken1.address, 500000);
        await converter4.addReserve(smartToken1.address, 500000);
        await converter5.addReserve(smartToken1.address, 500000);
        await converter6.addReserve(smartToken1.address, 500000);
        await converter7.addReserve(smartToken2.address, 500000);

        await etherToken.deposit({value: 1000000});
        await smartToken1.issue(accounts[0], 1000000);
        await smartToken2.issue(accounts[0], 1000000);
        await smartToken3.issue(accounts[0], 1000000);
        await smartToken4.issue(accounts[0], 1000000);
        await smartToken5.issue(accounts[0], 1000000);
        await smartToken6.issue(accounts[0], 1000000);
        await smartToken7.issue(accounts[0], 1000000);
        await smartToken8.issue(accounts[0], 1000000);
        await smartToken9.issue(accounts[0], 1000000);
        await smartTokenA.issue(accounts[0], 1000000);
        await smartTokenB.issue(accounts[0], 1000000);
        await smartTokenC.issue(accounts[0], 1000000);
        await smartTokenD.issue(accounts[0], 1000000);
        await smartTokenE.issue(accounts[0], 1000000);

        await etherToken .transfer(converter1.address, 1000);
        await smartToken4.transfer(converter2.address, 1000);
        await smartToken6.transfer(converter3.address, 1000);
        await smartToken8.transfer(converter4.address, 1000);
        await smartTokenA.transfer(converter5.address, 1000);
        await smartTokenC.transfer(converter6.address, 1000);
        await smartTokenE.transfer(converter7.address, 1000);
        await smartToken1.transfer(converter2.address, 1000);
        await smartToken1.transfer(converter3.address, 1000);
        await smartToken1.transfer(converter4.address, 1000);
        await smartToken1.transfer(converter5.address, 1000);
        await smartToken1.transfer(converter6.address, 1000);
        await smartToken2.transfer(converter7.address, 1000);

        await smartToken1.transferOwnership(converter1.address);
        await smartToken2.transferOwnership(converter2.address);
        await smartToken3.transferOwnership(converter3.address);
        await smartToken4.transferOwnership(converter4.address);
        await smartToken5.transferOwnership(converter5.address);
        await smartToken6.transferOwnership(converter6.address);
        await smartToken7.transferOwnership(converter7.address);
        await converter1.acceptTokenOwnership();
        await converter2.acceptTokenOwnership();
        await converter3.acceptTokenOwnership();
        await converter4.acceptTokenOwnership();
        await converter5.acceptTokenOwnership();
        await converter6.acceptTokenOwnership();
        await converter7.acceptTokenOwnership();

        await converterRegistry.addConverter(converter1.address);
        await converterRegistry.addConverter(converter2.address);
        await converterRegistry.addConverter(converter3.address);
        await converterRegistry.addConverter(converter4.address);
        await converterRegistry.addConverter(converter5.address);
        await converterRegistry.addConverter(converter6.address);
        await converterRegistry.addConverter(converter7.address);
    });

    it('verifies that the owner can update the anchor token', async () => {
        await pathFinder.setAnchorToken(anchorToken, {from: accounts[0]});
        assert.equal(await pathFinder.anchorToken(), anchorToken);
    });

    it('should throw when a non owner tries to update the anchor token', async () => {
        await utils.catchRevert(pathFinder.setAnchorToken(anchorToken, {from: accounts[1]}));
    });

    it('should return an empty path if the source-token has no path to the anchor-token', async () => {
        const sourceToken = utils.zeroAddress;
        const targetToken = smartToken1.address;
        const expected = await generatePath(sourceToken, targetToken, anchorToken, converterRegistry);
        const actual = await pathFinder.generatePath(sourceToken, targetToken);
        assert.equal(actual + expected, []);
    });

    it('should return an empty path if the target-token has no path to the anchor-token', async () => {
        const sourceToken = smartToken1.address;
        const targetToken = utils.zeroAddress;
        const expected = await generatePath(sourceToken, targetToken, anchorToken, converterRegistry);
        const actual = await pathFinder.generatePath(sourceToken, targetToken);
        assert.equal(actual + expected, []);
    });

    const variables = ["etherToken", ..."123456789ABCDE".split("").map(c => "smartToken" + c)];
    for (const sourceVariable of variables) {
        for (const targetVariable of variables) {
            it(`from ${sourceVariable} to ${targetVariable}`, async () => {
                const sourceToken = eval(`${sourceVariable}.address`);
                const targetToken = eval(`${targetVariable}.address`);
                const expected = await generatePath(sourceToken, targetToken, anchorToken, converterRegistry);
                const actual = await pathFinder.generatePath(sourceToken, targetToken);
                assert.equal(`${actual}`, `${expected}`);
                await print(sourceToken, targetToken, actual);
            });
        }
    }
});
