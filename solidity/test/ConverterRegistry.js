/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const ERC20Token = artifacts.require('ERC20Token');
const EtherToken = artifacts.require('EtherToken');
const SmartToken = artifacts.require('SmartToken');
const ContractRegistry = artifacts.require('ContractRegistry');
const ConverterFactory = artifacts.require('ConverterFactory');
const ConverterBase = artifacts.require('ConverterBase');
const IConverterAnchor = artifacts.require('IConverterAnchor');
const LiquidTokenConverter = artifacts.require('LiquidTokenConverter');
const LiquidityPoolV1Converter = artifacts.require('LiquidityPoolV1Converter');
const LiquidTokenConverterFactory = artifacts.require('LiquidTokenConverterFactory');
const LiquidityPoolV1ConverterFactory = artifacts.require('LiquidityPoolV1ConverterFactory');
const ConverterRegistry = artifacts.require('ConverterRegistry');
const ConverterRegistryData = artifacts.require('ConverterRegistryData');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

contract('ConverterRegistry', function(accounts) {
    let contractRegistry
    let converterFactory;
    let converterRegistry;
    let converterRegistryData;

    before(async function() {
        contractRegistry = await ContractRegistry.new();
        converterFactory = await ConverterFactory.new();
        await converterFactory.registerTypedConverterFactory((await LiquidTokenConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
        converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_FACTORY      , converterFactory     .address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_REGISTRY     , converterRegistry    .address);
        await contractRegistry.registerAddress(ContractRegistryClient.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
    });

    describe('create converters externally:', function() {
        let converter1;
        let converter2;
        let converter3;
        let converter4;
        let converter5;
        let converter6;
        let converter7;
        let etherToken;
        let anchor1;
        let anchor2;
        let anchor3;
        let anchor4;
        let anchor5;
        let anchor6;
        let anchor7;
        let anchor8;
        let anchor9;
        let anchorA;
        let anchorB;
        let anchorC;
        let anchorD;
        let anchorE;

        before(async function() {
            etherToken  = await EtherToken.new('Token0', 'TKN0');
            anchor1 = await SmartToken.new('Token1', 'TKN1', 18);
            anchor2 = await SmartToken.new('Token2', 'TKN2', 18);
            anchor3 = await SmartToken.new('Token3', 'TKN3', 18);
            anchor4 = await SmartToken.new('Token4', 'TKN4', 18);
            anchor5 = await SmartToken.new('Token5', 'TKN5', 18);
            anchor6 = await SmartToken.new('Token6', 'TKN6', 18);
            anchor7 = await SmartToken.new('Token7', 'TKN7', 18);
            anchor8 = await SmartToken.new('Token8', 'TKN8', 18);
            anchor9 = await SmartToken.new('Token9', 'TKN9', 18);
            anchorA = await SmartToken.new('TokenA', 'TKNA', 18);
            anchorB = await SmartToken.new('TokenB', 'TKNB', 18);
            anchorC = await SmartToken.new('TokenC', 'TKNC', 18);
            anchorD = await SmartToken.new('TokenD', 'TKND', 18);
            anchorE = await SmartToken.new('TokenE', 'TKNE', 18);

            converter1 = await LiquidTokenConverter.new(anchor1.address, contractRegistry.address, 0);
            converter2 = await LiquidityPoolV1Converter.new(anchor2.address, contractRegistry.address, 0);
            converter3 = await LiquidityPoolV1Converter.new(anchor3.address, contractRegistry.address, 0);
            converter4 = await LiquidityPoolV1Converter.new(anchor4.address, contractRegistry.address, 0);
            converter5 = await LiquidityPoolV1Converter.new(anchor5.address, contractRegistry.address, 0);
            converter6 = await LiquidityPoolV1Converter.new(anchor6.address, contractRegistry.address, 0);
            converter7 = await LiquidityPoolV1Converter.new(anchor7.address, contractRegistry.address, 0);

            await converter1.addReserve(etherToken.address, 0x1000);
            await converter2.addReserve(anchor4.address, 0x2400);
            await converter3.addReserve(anchor6.address, 0x3600);
            await converter4.addReserve(anchor8.address, 0x4800);
            await converter5.addReserve(anchorA.address, 0x5A00);
            await converter6.addReserve(anchorC.address, 0x6C00);
            await converter7.addReserve(anchorE.address, 0x7E00);

            await converter2.addReserve(anchor1.address, 0x2100);
            await converter3.addReserve(anchor1.address, 0x3100);
            await converter4.addReserve(anchor1.address, 0x4100);
            await converter5.addReserve(anchor1.address, 0x5100);
            await converter6.addReserve(anchor1.address, 0x6100);
            await converter7.addReserve(anchor2.address, 0x7200);

            await anchor1.transferOwnership(converter1.address);
            await anchor2.transferOwnership(converter2.address);
            await anchor3.transferOwnership(converter3.address);
            await anchor4.transferOwnership(converter4.address);
            await anchor5.transferOwnership(converter5.address);
            await anchor6.transferOwnership(converter6.address);
            await anchor7.transferOwnership(converter7.address);

            await converter1.acceptAnchorOwnership();
            await converter2.acceptAnchorOwnership();
            await converter3.acceptAnchorOwnership();
            await converter4.acceptAnchorOwnership();
            await converter5.acceptAnchorOwnership();
            await converter6.acceptAnchorOwnership();
            await converter7.acceptAnchorOwnership();
        });

        it('function addConverter', async function() {
            await test(converterRegistry.addConverter, converter1, 'Added');
            await test(converterRegistry.addConverter, converter2, 'Added');
            await test(converterRegistry.addConverter, converter3, 'Added');
            await test(converterRegistry.addConverter, converter4, 'Added');
            await test(converterRegistry.addConverter, converter5, 'Added');
            await test(converterRegistry.addConverter, converter6, 'Added');
            await test(converterRegistry.addConverter, converter7, 'Added');
            await utils.catchRevert(test(converterRegistry.addConverter, converter1, ''));
            await utils.catchRevert(test(converterRegistry.addConverter, converter2, ''));
            await utils.catchRevert(test(converterRegistry.addConverter, converter3, ''));
            await utils.catchRevert(test(converterRegistry.addConverter, converter4, ''));
            await utils.catchRevert(test(converterRegistry.addConverter, converter5, ''));
            await utils.catchRevert(test(converterRegistry.addConverter, converter6, ''));
            await utils.catchRevert(test(converterRegistry.addConverter, converter7, ''));
        });

        it('function getLiquidityPoolByReserveConfig', async function() {
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([etherToken .address             ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor4.address], [0x2400, 0x2100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor6.address], [0x3600, 0x3100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor8.address], [0x4800, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorA.address], [0x5A00, 0x5100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorC.address], [0x6C00, 0x6100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor2.address, anchorE.address], [0x7E00, 0x7200]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor4.address, anchor1.address], [0x2100, 0x2400]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor6.address, anchor1.address], [0x3100, 0x3600]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor8.address, anchor1.address], [0x4100, 0x4800]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorA.address, anchor1.address], [0x5100, 0x5A00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorC.address, anchor1.address], [0x6100, 0x6C00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorE.address, anchor2.address], [0x7200, 0x7E00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor4.address], [0x2100, 0x2400]), anchor2.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor6.address], [0x3100, 0x3600]), anchor3.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor8.address], [0x4100, 0x4800]), anchor4.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorA.address], [0x5100, 0x5A00]), anchor5.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorC.address], [0x6100, 0x6C00]), anchor6.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor2.address, anchorE.address], [0x7200, 0x7E00]), anchor7.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor4.address, anchor1.address], [0x2400, 0x2100]), anchor2.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor6.address, anchor1.address], [0x3600, 0x3100]), anchor3.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor8.address, anchor1.address], [0x4800, 0x4100]), anchor4.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorA.address, anchor1.address], [0x5A00, 0x5100]), anchor5.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorC.address, anchor1.address], [0x6C00, 0x6100]), anchor6.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorE.address, anchor2.address], [0x7E00, 0x7200]), anchor7.address);
        });

        it('function removeConverter', async function() {
            await test(converterRegistry.removeConverter, converter1, 'Removed');
            await test(converterRegistry.removeConverter, converter2, 'Removed');
            await test(converterRegistry.removeConverter, converter3, 'Removed');
            await test(converterRegistry.removeConverter, converter4, 'Removed');
            await test(converterRegistry.removeConverter, converter5, 'Removed');
            await test(converterRegistry.removeConverter, converter6, 'Removed');
            await test(converterRegistry.removeConverter, converter7, 'Removed');
            await utils.catchRevert(test(converterRegistry.removeConverter, converter1, ''));
            await utils.catchRevert(test(converterRegistry.removeConverter, converter2, ''));
            await utils.catchRevert(test(converterRegistry.removeConverter, converter3, ''));
            await utils.catchRevert(test(converterRegistry.removeConverter, converter4, ''));
            await utils.catchRevert(test(converterRegistry.removeConverter, converter5, ''));
            await utils.catchRevert(test(converterRegistry.removeConverter, converter6, ''));
            await utils.catchRevert(test(converterRegistry.removeConverter, converter7, ''));
        });

        it('function getLiquidityPoolByReserveConfig', async function() {
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([etherToken .address             ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor4.address], [0x2400, 0x2100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor6.address], [0x3600, 0x3100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor8.address], [0x4800, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorA.address], [0x5A00, 0x5100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorC.address], [0x6C00, 0x6100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor2.address, anchorE.address], [0x7E00, 0x7200]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor4.address, anchor1.address], [0x2100, 0x2400]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor6.address, anchor1.address], [0x3100, 0x3600]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor8.address, anchor1.address], [0x4100, 0x4800]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorA.address, anchor1.address], [0x5100, 0x5A00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorC.address, anchor1.address], [0x6100, 0x6C00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorE.address, anchor2.address], [0x7200, 0x7E00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor4.address], [0x2100, 0x2400]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor6.address], [0x3100, 0x3600]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchor8.address], [0x4100, 0x4800]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorA.address], [0x5100, 0x5A00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor1.address, anchorC.address], [0x6100, 0x6C00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor2.address, anchorE.address], [0x7200, 0x7E00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor4.address, anchor1.address], [0x2400, 0x2100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor6.address, anchor1.address], [0x3600, 0x3100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchor8.address, anchor1.address], [0x4800, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorA.address, anchor1.address], [0x5A00, 0x5100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorC.address, anchor1.address], [0x6C00, 0x6100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([anchorE.address, anchor2.address], [0x7E00, 0x7200]), utils.zeroAddress);
        });

        it('should return a list of converters for a list of anchors', async () => {
            const tokens = [anchor1.address, anchor2.address, anchor3.address];
            const expected = [converter1.address, converter2.address, converter3.address];
            const actual = await converterRegistry.getConvertersByAnchors(tokens);
            assert.deepEqual(actual, expected);
        });
    });

    describe('create converters internally:', function() {
        let converters;
        let anchors;
        let erc20Token1;
        let erc20Token2;

        before(async function() {
            erc20Token1 = await ERC20Token.new('ERC20Token1', 'ET1', 18, 1000000000);
            erc20Token2 = await ERC20Token.new('ERC20Token2', 'ET2', 18, 1000000000);

            await converterRegistry.newConverter(0, 'Liquid1', 'ST1', 18, 0, [ETH_RESERVE_ADDRESS                     ], [0x1000        ]);
            await converterRegistry.newConverter(0, 'Liquid2', 'ST2', 18, 0, [erc20Token1.address                     ], [0x2100        ]);
            await converterRegistry.newConverter(0, 'Liquid3', 'ST3', 18, 0, [erc20Token2.address                     ], [0x3200        ]);
            await converterRegistry.newConverter(1, 'Pool1'  , 'ST4', 18, 0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]);
            await converterRegistry.newConverter(1, 'Pool2'  , 'ST5', 18, 0, [erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]);
            await converterRegistry.newConverter(1, 'Pool3'  , 'ST6', 18, 0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]);

            anchors = await converterRegistry.getAnchors();
            converters = await Promise.all(anchors.map(anchor => IConverterAnchor.at(anchor).owner()));
            await Promise.all(converters.map(converter => ConverterBase.at(converter).acceptOwnership()));
        });

        it('function addConverter', async function() {
            for (const converter of converters)
                await utils.catchRevert(test(converterRegistry.addConverter, ConverterBase.at(converter), ''));
        });

        it('function getLiquidityPoolByReserveConfig', async function() {
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([ETH_RESERVE_ADDRESS                     ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token1.address                     ], [0x2100        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token2.address                     ], [0x3200        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]), anchors[3]);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]), anchors[4]);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]), anchors[5]);
        });

        it('function removeConverter', async function() {
            for (const converter of converters)
                await test(converterRegistry.removeConverter, ConverterBase.at(converter), 'Removed');
            for (const converter of converters)
                await utils.catchRevert(test(converterRegistry.removeConverter, ConverterBase.at(converter), ''));
        });

        it('function getLiquidityPoolByReserveConfig', async function() {
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([ETH_RESERVE_ADDRESS                     ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token1.address                     ], [0x2100        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token2.address                     ], [0x3200        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig([erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]), utils.zeroAddress);
        });

        it('should return a list of converters for a list of anchors', async () => {
            assert.deepEqual(await converterRegistry.getConvertersByAnchors(anchors), converters);
        });
    });
});

async function test(func, converter, suffix) {
    const response = await func(converter.address);
    const anchor   = await converter.anchor();
    const count    = await converter.connectorTokenCount();
    const log      = response.logs[0];
    const expected = `ConverterAnchor${suffix}(${anchor})`;
    const actual   = `${log.event}(${log.args._anchor})`;
    assert.equal(actual, expected);
    if (count.greaterThan(1)) {
        const log      = response.logs[2];
        const expected = `LiquidityPool${suffix}(${anchor})`;
        const actual   = `${log.event}(${log.args._liquidityPool})`;
        assert.equal(actual, expected);
    }
    else {
        const log      = response.logs[2];
        const expected = `ConvertibleToken${suffix}(${anchor},${anchor})`;
        const actual   = `${log.event}(${log.args._convertibleToken},${log.args._smartToken})`;
        assert.equal(actual, expected);
    }
    for (let i = 0; count.greaterThan(i); i++) {
        const connectorToken = await converter.connectorTokens(i);
        const log      = response.logs[3 + i];
        const expected = `ConvertibleToken${suffix}(${connectorToken},${anchor})`;
        const actual   = `${log.event}(${log.args._convertibleToken},${log.args._smartToken})`;
        assert.equal(actual, expected);
    }
}
