const { expect } = require('chai');
const { expectRevert, expectEvent, constants } = require('@openzeppelin/test-helpers');

const { ETH_RESERVE_ADDRESS } = require('./helpers/Constants');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const ERC20Token = artifacts.require('ERC20Token');
const ContractRegistry = artifacts.require('ContractRegistry');
const IConverterAnchor = artifacts.require('IConverterAnchor');
const ConverterBase = artifacts.require('ConverterBase');
const ConverterFactory = artifacts.require('ConverterFactory');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const ConverterRegistry = artifacts.require('ConverterRegistry');
const ConverterRegistryData = artifacts.require('ConverterRegistryData');
const ConversionPathFinder = artifacts.require('ConversionPathFinder');

const ANCHOR_TOKEN_SYMBOL = 'ETH';

const LAYOUT = {
    reserves: [
        {symbol: 'AAA'},
        {symbol: 'BBB'},
        {symbol: 'CCC'},
        {symbol: 'DDD'},
    ],
    converters: [
        {symbol: 'BNT'         , reserves: [{symbol: 'ETH'   }                      ]},
        {symbol: 'AAABNT'      , reserves: [{symbol: 'AAA'   }, {symbol: 'BNT'      }]},
        {symbol: 'BBBBNT'      , reserves: [{symbol: 'BBB'   }, {symbol: 'BNT'      }]},
        {symbol: 'CCCBNT'      , reserves: [{symbol: 'CCC'   }, {symbol: 'BNT'      }]},
        {symbol: 'AAABNTBNT'   , reserves: [{symbol: 'AAABNT'}, {symbol: 'BNT'      }]},
        {symbol: 'BBBBNTBNT'   , reserves: [{symbol: 'BBBBNT'}, {symbol: 'BNT'      }]},
        {symbol: 'DDDAAABNTBNT', reserves: [{symbol: 'DDD'   }, {symbol: 'AAABNTBNT'}]},
    ]
};

const getSymbol = async (tokenAddress) => {
    if (tokenAddress == ETH_RESERVE_ADDRESS) {
        return 'ETH';
    }

    const token =  await ERC20Token.at(tokenAddress);
    return token.symbol.call();
};

const printPath = async (sourceToken, targetToken, path) => {
    const sourceSymbol = await getSymbol(sourceToken);
    const targetSymbol = await getSymbol(targetToken);
    const symbols = await Promise.all(path.map(token => getSymbol(token)));
    console.log(`path from ${sourceSymbol} to ${targetSymbol} = [${symbols}]`);
};

const findPath = async (sourceToken, targetToken, anchorToken, converterRegistry) => {
    const sourcePath = await getPath(sourceToken, anchorToken, converterRegistry);
    const targetPath = await getPath(targetToken, anchorToken, converterRegistry);
    return getShortestPath(sourcePath, targetPath);
};

const getPath = async (token, anchorToken, converterRegistry) => {
    if (token == anchorToken) {
        return [token];
    }

    const isAnchor = await converterRegistry.isAnchor(token);
    const anchors = isAnchor ? [token] : await converterRegistry.getConvertibleTokenAnchors(token);
    for (const anchor of anchors) {
        const converterAnchor = await IConverterAnchor.at(anchor);
        const converterAnchorOwner = await converterAnchor.owner.call();
        const converter = await ConverterBase.at(converterAnchorOwner);
        const connectorTokenCount = await converter.connectorTokenCount();
        for (let i = 0; i < connectorTokenCount; i++) {
            const connectorToken = await converter.connectorTokens(i);
            if (connectorToken !== token) {
                const path = await getPath(connectorToken, anchorToken, converterRegistry);
                if (path.length > 0) {
                    return [token, anchor, ...path];
                }
            }
        }
    }

    return [];
};

const getShortestPath = (sourcePath, targetPath) => {
    if (sourcePath.length === 0 || targetPath.length === 0) {
        return [];
    }

    let i = sourcePath.length - 1;
    let j = targetPath.length - 1;
    while (i >= 0 && j >= 0 && sourcePath[i] == targetPath[j]) {
        i--;
        j--;
    }

    const path = [];
    for (let m = 0; m <= i + 1; m++) {
        path.push(sourcePath[m]);
    }
    for (let n = j; n >= 0; n--) {
        path.push(targetPath[n]);
    }

    let length = 0;
    for (let p = 0; p < path.length; p += 1) {
        for (let q = p + 2; q < path.length - p % 2; q += 2) {
            if (path[p] == path[q]) {
                p = q;
            }
        }
        path[length++] = path[p];
    }

    return path.slice(0, length);
}

contract('ConversionPathFinder', accounts => {
    let contractRegistry
    let converterFactory;
    let converterRegistry;
    let converterRegistryData;
    let pathFinder;
    let anchorToken;
    const nonOwner = accounts[1];

    const addresses = {ETH: ETH_RESERVE_ADDRESS};

    beforeEach(async function() {
        contractRegistry = await ContractRegistry.new();

        converterFactory = await ConverterFactory.new();
        converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);
        pathFinder = await ConversionPathFinder.new(contractRegistry.address);

        await converterFactory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);

        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_REGISTRY_DATA, converterRegistryData.address);

        for (const reserve of LAYOUT.reserves) {
            const erc20Token = await ERC20Token.new('name', reserve.symbol, 0, 0);
            addresses[reserve.symbol] = erc20Token.address;
        }

        for (const converter of LAYOUT.converters) {
            const tokens = converter.reserves.map(reserve => addresses[reserve.symbol]);
            await converterRegistry.newConverter(tokens.length == 1 ? 0 : 1, 'name', converter.symbol, 0, 0, tokens, tokens.map(token => 1));
            const anchor = await IConverterAnchor.at((await converterRegistry.getAnchors()).slice(-1)[0]);
            const converterBase = await ConverterBase.at(await anchor.owner());
            await converterBase.acceptOwnership();
            addresses[converter.symbol] = anchor.address;
        }

        anchorToken = addresses[ANCHOR_TOKEN_SYMBOL];
        await pathFinder.setAnchorToken(anchorToken);
    });

    it('should revert when a non owner tries to update the anchor token', async () => {
        await expectRevert(pathFinder.setAnchorToken(accounts[0], {from: nonOwner}), 'ERR_ACCESS_DENIED');
    });

    it('should return an empty path if the source-token has no path to the anchor-token', async () => {
        const sourceToken = accounts[0];
        const targetToken = anchorToken;
        const expected = await findPath(sourceToken, targetToken, anchorToken, converterRegistry);
        const actual = await pathFinder.findPath(sourceToken, targetToken);
        expect(expected).to.be.empty();
        expect(actual).to.be.empty();
    });

    it('should return an empty path if the target-token has no path to the anchor-token', async () => {
        const sourceToken = anchorToken;
        const targetToken = accounts[0];
        const expected = await findPath(sourceToken, targetToken, anchorToken, converterRegistry);
        const actual = await pathFinder.findPath(sourceToken, targetToken);
        expect(expected).to.be.empty();
        expect(actual).to.be.empty();
    });

    const allSymbols = ['ETH', ...[...LAYOUT.reserves, ...LAYOUT.converters].map(record => record.symbol)];
    for (const sourceSymbol of allSymbols) {
        for (const targetSymbol of allSymbols) {
            it(`from ${sourceSymbol} to ${targetSymbol}`, async () => {
                const sourceToken = addresses[sourceSymbol];
                const targetToken = addresses[targetSymbol];
                const expected = await findPath(sourceToken, targetToken, anchorToken, converterRegistry);
                const actual = await pathFinder.findPath(sourceToken, targetToken);
                expect(actual).to.be.deep.equal(expected);

                await printPath(sourceToken, targetToken, actual);
            });
        }
    }
});
