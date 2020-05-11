/* global artifacts, contract, before, it, assert, web3 */
/* eslint-disable prefer-reflect */

const utils = require('./helpers/Utils');
const ContractRegistryClient = require('./helpers/ContractRegistryClient');

const ERC20Token = artifacts.require('ERC20Token');
const EtherToken = artifacts.require('EtherToken');
const SmartToken = artifacts.require('SmartToken');
const BancorConverter = artifacts.require('BancorConverter');
const ContractRegistry = artifacts.require('ContractRegistry');
const BancorConverterFactory = artifacts.require('BancorConverterFactory');
const BancorConverterRegistry = artifacts.require('BancorConverterRegistry');
const BancorConverterRegistryData = artifacts.require('BancorConverterRegistryData');

const ETH_RESERVE_ADDRESS = '0x'.padEnd(42, 'e');

contract('BancorConverterRegistry', function(accounts) {
    let contractRegistry
    let converterFactory;
    let converterRegistry;
    let converterRegistryData;

    before(async function() {
        contractRegistry = await ContractRegistry.new();
        converterFactory = await BancorConverterFactory.new();
        converterRegistry = await BancorConverterRegistry.new(contractRegistry.address);
        converterRegistryData = await BancorConverterRegistryData.new(contractRegistry.address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_FACTORY      , converterFactory     .address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY     , converterRegistry    .address);
        await contractRegistry.registerAddress(ContractRegistryClient.BANCOR_CONVERTER_REGISTRY_DATA, converterRegistryData.address);
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

            converter1 = await BancorConverter.new(smartToken1.address, contractRegistry.address, 0, etherToken .address, 0x1000);
            converter2 = await BancorConverter.new(smartToken2.address, contractRegistry.address, 0, smartToken4.address, 0x2400);
            converter3 = await BancorConverter.new(smartToken3.address, contractRegistry.address, 0, smartToken6.address, 0x3600);
            converter4 = await BancorConverter.new(smartToken4.address, contractRegistry.address, 0, smartToken8.address, 0x4800);
            converter5 = await BancorConverter.new(smartToken5.address, contractRegistry.address, 0, smartTokenA.address, 0x5A00);
            converter6 = await BancorConverter.new(smartToken6.address, contractRegistry.address, 0, smartTokenC.address, 0x6C00);
            converter7 = await BancorConverter.new(smartToken7.address, contractRegistry.address, 0, smartTokenE.address, 0x7E00);

            await converter2.addReserve(smartToken1.address, 0x2100);
            await converter3.addReserve(smartToken1.address, 0x3100);
            await converter4.addReserve(smartToken1.address, 0x4100);
            await converter5.addReserve(smartToken1.address, 0x5100);
            await converter6.addReserve(smartToken1.address, 0x6100);
            await converter7.addReserve(smartToken2.address, 0x7200);

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
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [etherToken .address                     ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken4.address], [0x2400, 0x2100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken6.address], [0x3600, 0x3100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken8.address], [0x4800, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenA.address], [0x5A00, 0x5100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenC.address], [0x6C00, 0x6100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken2.address, smartTokenE.address], [0x7E00, 0x7200]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken4.address, smartToken1.address], [0x2100, 0x2400]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken6.address, smartToken1.address], [0x3100, 0x3600]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken8.address, smartToken1.address], [0x4100, 0x4800]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenA.address, smartToken1.address], [0x5100, 0x5A00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenC.address, smartToken1.address], [0x6100, 0x6C00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenE.address, smartToken2.address], [0x7200, 0x7E00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken4.address], [0x2100, 0x2400]), smartToken2.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken6.address], [0x3100, 0x3600]), smartToken3.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken8.address], [0x4100, 0x4800]), smartToken4.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenA.address], [0x5100, 0x5A00]), smartToken5.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenC.address], [0x6100, 0x6C00]), smartToken6.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken2.address, smartTokenE.address], [0x7200, 0x7E00]), smartToken7.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken4.address, smartToken1.address], [0x2400, 0x2100]), smartToken2.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken6.address, smartToken1.address], [0x3600, 0x3100]), smartToken3.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken8.address, smartToken1.address], [0x4800, 0x4100]), smartToken4.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenA.address, smartToken1.address], [0x5A00, 0x5100]), smartToken5.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenC.address, smartToken1.address], [0x6C00, 0x6100]), smartToken6.address);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenE.address, smartToken2.address], [0x7E00, 0x7200]), smartToken7.address);
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
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [etherToken .address                     ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken4.address], [0x2400, 0x2100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken6.address], [0x3600, 0x3100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken8.address], [0x4800, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenA.address], [0x5A00, 0x5100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenC.address], [0x6C00, 0x6100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken2.address, smartTokenE.address], [0x7E00, 0x7200]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken4.address, smartToken1.address], [0x2100, 0x2400]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken6.address, smartToken1.address], [0x3100, 0x3600]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken8.address, smartToken1.address], [0x4100, 0x4800]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenA.address, smartToken1.address], [0x5100, 0x5A00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenC.address, smartToken1.address], [0x6100, 0x6C00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenE.address, smartToken2.address], [0x7200, 0x7E00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken4.address], [0x2100, 0x2400]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken6.address], [0x3100, 0x3600]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartToken8.address], [0x4100, 0x4800]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenA.address], [0x5100, 0x5A00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken1.address, smartTokenC.address], [0x6100, 0x6C00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken2.address, smartTokenE.address], [0x7200, 0x7E00]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken4.address, smartToken1.address], [0x2400, 0x2100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken6.address, smartToken1.address], [0x3600, 0x3100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartToken8.address, smartToken1.address], [0x4800, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenA.address, smartToken1.address], [0x5A00, 0x5100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenC.address, smartToken1.address], [0x6C00, 0x6100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [smartTokenE.address, smartToken2.address], [0x7E00, 0x7200]), utils.zeroAddress);
        });

        it('should return a list of converters for a list of smart tokens', async () => {
            const tokens = [smartToken1.address, smartToken2.address, smartToken3.address];
            const expected = [converter1.address, converter2.address, converter3.address];
            const actual = await converterRegistry.getConvertersBySmartTokens(tokens);
            assert.deepEqual(actual, expected);
        });
    });

    describe('create converters internally:', function() {
        let converters;
        let smartTokens;
        let erc20Token1;
        let erc20Token2;

        before(async function() {
            erc20Token1 = await ERC20Token.new('ERC20Token1', 'ET1', 18, 1000000000);
            erc20Token2 = await ERC20Token.new('ERC20Token2', 'ET2', 18, 1000000000);

            await converterRegistry.newConverter(0, 'SmartToken1', 'ST1', 18, 0, [ETH_RESERVE_ADDRESS                     ], [0x1000        ]);
            await converterRegistry.newConverter(0, 'SmartToken2', 'ST2', 18, 0, [erc20Token1.address                     ], [0x2100        ]);
            await converterRegistry.newConverter(0, 'SmartToken2', 'ST3', 18, 0, [erc20Token2.address                     ], [0x3200        ]);
            await converterRegistry.newConverter(0, 'SmartToken3', 'ST4', 18, 0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]);
            await converterRegistry.newConverter(0, 'SmartToken4', 'ST5', 18, 0, [erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]);
            await converterRegistry.newConverter(0, 'SmartToken5', 'ST6', 18, 0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]);

            smartTokens = await converterRegistry.getSmartTokens();
            converters = await Promise.all(smartTokens.map(smartToken => SmartToken.at(smartToken).owner()));
            await Promise.all(converters.map(converter => BancorConverter.at(converter).acceptOwnership()));
        });

        it('function addConverter', async function() {
            for (const converter of converters)
                await utils.catchRevert(test(converterRegistry.addConverter, BancorConverter.at(converter), ''));
        });

        it('function getLiquidityPoolByReserveConfig', async function() {
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [ETH_RESERVE_ADDRESS                     ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token1.address                     ], [0x2100        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token2.address                     ], [0x3200        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]), smartTokens[3]);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]), smartTokens[4]);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]), smartTokens[5]);
        });

        it('function removeConverter', async function() {
            for (const converter of converters)
                await test(converterRegistry.removeConverter, BancorConverter.at(converter), 'Removed');
            for (const converter of converters)
                await utils.catchRevert(test(converterRegistry.removeConverter, BancorConverter.at(converter), ''));
        });

        it('function getLiquidityPoolByReserveConfig', async function() {
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [ETH_RESERVE_ADDRESS                     ], [0x1000        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token1.address                     ], [0x2100        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token2.address                     ], [0x3200        ]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]), utils.zeroAddress);
            assert.equal(await converterRegistry.getLiquidityPoolByReserveConfig(0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]), utils.zeroAddress);
        });

        it('should return a list of converters for a list of smart tokens', async () => {
            assert.deepEqual(await converterRegistry.getConvertersBySmartTokens(smartTokens), converters);
        });
    });
});

async function test(func, converter, suffix) {
    const response = await func(converter.address);
    const token    = await converter.token();
    const count    = await converter.connectorTokenCount();
    const log      = response.logs[0];
    const expected = `SmartToken${suffix}(${token})`;
    const actual   = `${log.event}(${log.args._smartToken})`;
    assert.equal(actual, expected);
    if (count.greaterThan(1)) {
        const log      = response.logs[1];
        const expected = `LiquidityPool${suffix}(${token})`;
        const actual   = `${log.event}(${log.args._liquidityPool})`;
        assert.equal(actual, expected);
    }
    else {
        const log      = response.logs[1];
        const expected = `ConvertibleToken${suffix}(${token},${token})`;
        const actual   = `${log.event}(${log.args._convertibleToken},${log.args._smartToken})`;
        assert.equal(actual, expected);
    }
    for (let i = 0; count.greaterThan(i); i++) {
        const connectorToken = await converter.connectorTokens(i);
        const log      = response.logs[2 + i];
        const expected = `ConvertibleToken${suffix}(${connectorToken},${token})`;
        const actual   = `${log.event}(${log.args._convertibleToken},${log.args._smartToken})`;
        assert.equal(actual, expected);
    }
}
