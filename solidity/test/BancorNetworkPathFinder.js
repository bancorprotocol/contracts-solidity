/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const ERC20Token = artifacts.require('ERC20Token');
const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorConverter = artifacts.require('BancorConverter');
const BancorConverterFactory = artifacts.require('BancorConverterFactory');
const BancorConverterRegistry = artifacts.require('BancorConverterRegistry');
const BancorConverterRegistryData = artifacts.require('BancorConverterRegistryData');
const BancorNetworkPathFinder = artifacts.require('BancorNetworkPathFinder');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

const layout = {
    'reserves': [
        {'symbol': 'AAA', 'decimals': 18, 'supply': '1e24'},
        {'symbol': 'BBB', 'decimals': 18, 'supply': '1e24'},
        {'symbol': 'CCC', 'decimals': 18, 'supply': '1e24'},
        {'symbol': 'DDD', 'decimals': 18, 'supply': '1e24'},
    ],
    'converters': [
        {
            'symbol': 'BNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'ETH', 'weight': 500000, 'balance': '1e24'},
            ]
        },
        {
            'symbol': 'AAABNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'AAA', 'weight': 500000, 'balance': '1e21'},
                {'symbol': 'BNT', 'weight': 500000, 'balance': '1e21'},
            ]
        },
        {
            'symbol': 'BBBBNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'BBB', 'weight': 500000, 'balance': '1e21'},
                {'symbol': 'BNT', 'weight': 500000, 'balance': '1e21'},
            ]
        },
        {
            'symbol': 'CCCBNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'CCC', 'weight': 500000, 'balance': '1e21'},
                {'symbol': 'BNT', 'weight': 500000, 'balance': '1e21'},
            ]
        },
        {
            'symbol': 'AAABNTBNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'AAABNT', 'weight': 500000, 'balance': '1e18'},
                {'symbol': 'BNT', 'weight': 500000, 'balance': '1e21'},
            ]
        },
        {
            'symbol': 'BBBBNTBNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'BBBBNT', 'weight': 500000, 'balance': '1e18'},
                {'symbol': 'BNT', 'weight': 500000, 'balance': '1e21'},
            ]
        },
        {
            'symbol': 'DDDAAABNTBNT', 'decimals': 18, 'fee': 1000, 'reserves': [
                {'symbol': 'DDD', 'weight': 500000, 'balance': '1e21'},
                {'symbol': 'AAABNTBNT', 'weight': 500000, 'balance': '1e15'},
            ]
        },
    ]
};

async function getSymbol(tokenAddress) {
    if (tokenAddress == ETH_RESERVE_ADDRESS)
        return 'ETH';
    return await ERC20Token.at(tokenAddress).symbol();
}

async function printPath(sourceToken, targetToken, path) {
    const sourceSymbol = await getSymbol(sourceToken);
    const targetSymbol = await getSymbol(targetToken);
    const symbols = await Promise.all(path.map(token => getSymbol(token)));
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
    let contractRegistry
    let converterFactory;
    let converterRegistry;
    let converterRegistryData;
    let pathFinder;
    let anchorToken;

    const addresses = {ETH: ETH_RESERVE_ADDRESS};

    before(async function() {
        contractRegistry = await ContractRegistry.new();

        converterFactory      = await BancorConverterFactory     .new();
        converterRegistry     = await BancorConverterRegistry    .new(contractRegistry.address);
        converterRegistryData = await BancorConverterRegistryData.new(contractRegistry.address);
        pathFinder            = await BancorNetworkPathFinder    .new(contractRegistry.address);

        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_FACTORY      , converterFactory     .address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY     , converterRegistry    .address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        for (const reserve of layout.reserves) {
            const name     = reserve.symbol + ' ERC20 Token';
            const symbol   = reserve.symbol;
            const decimals = reserve.decimals;
            const supply   = reserve.supply;
            const token    = await ERC20Token.new(name, symbol, decimals, supply);
            await token.approve(converterRegistry.address, supply);
            addresses[reserve.symbol] = token.address;
        }

        for (const converter of layout.converters) {
            const name     = converter.symbol + ' Smart Token';
            const symbol   = converter.symbol;
            const decimals = converter.decimals;
            const fee      = converter.fee;
            const tokens   = converter.reserves.map(reserve => addresses[reserve.symbol]);
            const weights  = converter.reserves.map(reserve => reserve.weight);
            const amounts  = converter.reserves.map(reserve => reserve.balance);
            const value    = [...converter.reserves.filter(reserve => reserve.symbol == 'ETH'), {balance: '0'}][0].balance;
            if (converter.reserves.length == 1)
                await converterRegistry.newLiquidToken(name, symbol, decimals, fee, tokens[0], weights[0], amounts[0], {value: value});
            else
                await converterRegistry.newLiquidityPool(name, symbol, decimals, fee, tokens, weights, amounts, {value: value});
            const token = ERC20Token.at((await converterRegistry.getSmartTokens()).slice(-1)[0]);
            await token.approve(converterRegistry.address, await token.totalSupply());
            addresses[converter.symbol] = token.address;
        }

        const smartTokens = await converterRegistry.getSmartTokens();
        const bancorConverters = await Promise.all(smartTokens.map(smartToken => SmartToken.at(smartToken).owner()));
        await Promise.all(bancorConverters.map(bancorConverter => BancorConverter.at(bancorConverter).acceptOwnership()));

        anchorToken = addresses.ETH;
        await pathFinder.setAnchorToken(anchorToken);
    });

    it('should throw when a non owner tries to update the anchor token', async () => {
        await utils.catchRevert(pathFinder.setAnchorToken(accounts[0], {from: accounts[1]}));
        assert.equal(await pathFinder.anchorToken(), anchorToken);
    });

    it('should return an empty path if the source-token has no path to the anchor-token', async () => {
        const sourceToken = accounts[0];
        const targetToken = anchorToken;
        const expected = await generatePath(sourceToken, targetToken, anchorToken, converterRegistry);
        const actual = await pathFinder.generatePath(sourceToken, targetToken);
        assert.equal(actual + expected, []);
    });

    it('should return an empty path if the target-token has no path to the anchor-token', async () => {
        const sourceToken = anchorToken;
        const targetToken = accounts[0];
        const expected = await generatePath(sourceToken, targetToken, anchorToken, converterRegistry);
        const actual = await pathFinder.generatePath(sourceToken, targetToken);
        assert.equal(actual + expected, []);
    });

    const allSymbols = ['ETH', ...[...layout.reserves, ...layout.converters].map(record => record.symbol)];
    for (const sourceSymbol of allSymbols) {
        for (const targetSymbol of allSymbols) {
            it(`from ${sourceSymbol} to ${targetSymbol}`, async () => {
                const sourceToken = addresses[sourceSymbol];
                const targetToken = addresses[targetSymbol];
                const expected = await generatePath(sourceToken, targetToken, anchorToken, converterRegistry);
                const actual = await pathFinder.generatePath(sourceToken, targetToken);
                assert.equal(`${actual}`, `${expected}`);
                await printPath(sourceToken, targetToken, actual);
            });
        }
    }
});
