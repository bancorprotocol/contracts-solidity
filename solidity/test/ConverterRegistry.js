const { accounts, contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const TestStandardToken = contract.fromArtifact('TestStandardToken');
const DSToken = contract.fromArtifact('DSToken');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterBase = contract.fromArtifact('ConverterBase');
const IConverterAnchor = contract.fromArtifact('IConverterAnchor');
const LiquidityPoolV1Converter = contract.fromArtifact('LiquidityPoolV1Converter');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('LiquidityPoolV1ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterRegistry = contract.fromArtifact('TestConverterRegistry');
const ConverterHelper = require('./helpers/Converter');

describe('ConverterRegistry', () => {
    let contractRegistry;
    let converterFactory;
    let converterRegistry;
    let converterRegistryData;

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        converterFactory = await ConverterFactory.new();

        await converterFactory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
        await converterFactory.registerTypedConverterFactory((await StandardPoolConverterFactory.new()).address);
    });

    beforeEach(async () => {
        contractRegistry = await ContractRegistry.new();

        converterRegistry = await ConverterRegistry.new(contractRegistry.address);
        converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
    });

    const testRemove = async (converter) => {
        const res = await converterRegistry.removeConverter(converter.address);

        return testEvents(res, converter, 'Removed');
    };

    const testEvents = async (res, converter, suffix) => {
        const anchor = await converter.token.call();
        const count = await converter.connectorTokenCount.call();

        expectEvent(res, `ConverterAnchor${suffix}`, { _anchor: anchor });

        if (count.gt(new BN(1))) {
            expectEvent(res, `LiquidityPool${suffix}`, { _liquidityPool: anchor });
        } else {
            expectEvent(res, `ConvertibleToken${suffix}`, { _convertibleToken: anchor, _smartToken: anchor });
        }

        for (let i = 0; count.gt(new BN(i)); ++i) {
            const connectorToken = await converter.connectorTokens.call(i);
            expectEvent(res, `ConvertibleToken${suffix}`, { _convertibleToken: connectorToken, _smartToken: anchor });
        }
    };

    describe('add old converters', () => {
        const testAdd = async (converter) => {
            const res = await converterRegistry.addConverter(converter.address);

            return testEvents(res, converter, 'Added');
        };

        let converter1;
        let converter2;
        let converter3;
        let converter4;
        let converter5;
        let converter6;
        let converter7;
        let token0;
        let token1;
        let token2;
        let token3;
        let token4;
        let token5;
        let token6;
        let token7;
        let token8;
        let tokenA;
        let tokenC;
        let tokenE;

        beforeEach(async () => {
            token0 = await DSToken.new('Token0', 'TKN0', 18);
            token1 = await DSToken.new('Token1', 'TKN1', 18);
            token2 = await DSToken.new('Token2', 'TKN2', 18);
            token3 = await DSToken.new('Token3', 'TKN3', 18);
            token4 = await DSToken.new('Token4', 'TKN4', 18);
            token5 = await DSToken.new('Token5', 'TKN5', 18);
            token6 = await DSToken.new('Token6', 'TKN6', 18);
            token7 = await DSToken.new('Token7', 'TKN7', 18);
            token8 = await DSToken.new('Token8', 'TKN8', 18);
            tokenA = await DSToken.new('TokenA', 'TKNA', 18);
            tokenC = await DSToken.new('TokenC', 'TKNC', 18);
            tokenE = await DSToken.new('TokenE', 'TKNE', 18);

            converter1 = await ConverterHelper.new(
                0,
                token1.address,
                contractRegistry.address,
                0,
                token0.address,
                0x1000,
                23
            );
            converter2 = await ConverterHelper.new(
                0,
                token2.address,
                contractRegistry.address,
                0,
                token4.address,
                0x2400,
                23
            );
            converter3 = await ConverterHelper.new(
                0,
                token3.address,
                contractRegistry.address,
                0,
                token6.address,
                0x3600,
                23
            );
            converter4 = await ConverterHelper.new(
                0,
                token4.address,
                contractRegistry.address,
                0,
                token8.address,
                0x4800,
                23
            );
            converter5 = await ConverterHelper.new(
                0,
                token5.address,
                contractRegistry.address,
                0,
                tokenA.address,
                0x5a00,
                23
            );
            converter6 = await ConverterHelper.new(
                0,
                token6.address,
                contractRegistry.address,
                0,
                tokenC.address,
                0x6c00,
                23
            );
            converter7 = await ConverterHelper.new(
                0,
                token7.address,
                contractRegistry.address,
                0,
                tokenE.address,
                0x7e00,
                23
            );

            await converter2.addReserve(token1.address, 0x2100);
            await converter3.addReserve(token1.address, 0x3100);
            await converter4.addReserve(token1.address, 0x4100);
            await converter5.addReserve(token1.address, 0x5100);
            await converter6.addReserve(token1.address, 0x6100);
            await converter7.addReserve(token2.address, 0x7200);

            await token1.issue(accounts[0], 1);
            await token2.issue(accounts[0], 1);
            await token3.issue(accounts[0], 1);
            await token4.issue(accounts[0], 1);
            await token5.issue(accounts[0], 1);
            await token6.issue(accounts[0], 1);
            await token7.issue(accounts[0], 1);

            await token1.transferOwnership(converter1.address);
            await token2.transferOwnership(converter2.address);
            await token3.transferOwnership(converter3.address);
            await token4.transferOwnership(converter4.address);
            await token5.transferOwnership(converter5.address);
            await token6.transferOwnership(converter6.address);
            await token7.transferOwnership(converter7.address);

            await converter1.acceptTokenOwnership();
            await converter2.acceptTokenOwnership();
            await converter3.acceptTokenOwnership();
            await converter4.acceptTokenOwnership();
            await converter5.acceptTokenOwnership();
            await converter6.acceptTokenOwnership();
            await converter7.acceptTokenOwnership();
        });

        const addConverters = async () => {
            await testAdd(converter1);
            await testAdd(converter2);
            await testAdd(converter3);
            await testAdd(converter4);
            await testAdd(converter5);
            await testAdd(converter6);
            await testAdd(converter7);
        };

        const removeConverters = async () => {
            await testRemove(converter1);
            await testRemove(converter2);
            await testRemove(converter3);
            await testRemove(converter4);
            await testRemove(converter5);
            await testRemove(converter6);
            await testRemove(converter7);
        };

        it('should add converters', async () => {
            await addConverters();
        });

        context('with registered converters', async () => {
            beforeEach(async () => {
                await addConverters();
            });

            it('should not allow to add the same converter twice', async () => {
                await expectRevert(converterRegistry.addConverter(converter1.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter2.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter3.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter4.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter5.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter6.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter7.address), 'ERR_INVALID_ITEM');
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, token4.address],
                        [0x2400, 0x2100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, token6.address],
                        [0x3600, 0x3100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, tokenA.address],
                        [0x5a00, 0x5100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, token8.address],
                        [0x4800, 0x4100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, tokenC.address],
                        [0x6c00, 0x6100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token2.address, tokenE.address],
                        [0x7e00, 0x7200]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token4.address, token1.address],
                        [0x2100, 0x2400]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token6.address, token1.address],
                        [0x3100, 0x3600]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token8.address, token1.address],
                        [0x4100, 0x4800]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [tokenA.address, token1.address],
                        [0x5100, 0x5a00]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [tokenC.address, token1.address],
                        [0x6100, 0x6c00]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [tokenE.address, token2.address],
                        [0x7200, 0x7e00]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, token4.address],
                        [0x2100, 0x2400]
                    )
                ).to.eql(token2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, token6.address],
                        [0x3100, 0x3600]
                    )
                ).to.eql(token3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, token8.address],
                        [0x4100, 0x4800]
                    )
                ).to.eql(token4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, tokenA.address],
                        [0x5100, 0x5a00]
                    )
                ).to.eql(token5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token1.address, tokenC.address],
                        [0x6100, 0x6c00]
                    )
                ).to.eql(token6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token2.address, tokenE.address],
                        [0x7200, 0x7e00]
                    )
                ).to.eql(token7.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token4.address, token1.address],
                        [0x2400, 0x2100]
                    )
                ).to.eql(token2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token6.address, token1.address],
                        [0x3600, 0x3100]
                    )
                ).to.eql(token3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [token8.address, token1.address],
                        [0x4800, 0x4100]
                    )
                ).to.eql(token4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [tokenA.address, token1.address],
                        [0x5a00, 0x5100]
                    )
                ).to.eql(token5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [tokenC.address, token1.address],
                        [0x6c00, 0x6100]
                    )
                ).to.eql(token6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [tokenE.address, token2.address],
                        [0x7e00, 0x7200]
                    )
                ).to.eql(token7.address);
            });

            it('should return a list of converters for a list of tokens', async () => {
                const tokens = [token1.address, token2.address, token3.address];
                const expected = [converter1.address, converter2.address, converter3.address];
                const actual = await converterRegistry.getConvertersByAnchors.call(tokens);
                expect(actual).to.deep.eql(expected);
            });

            it('should remove converters', async () => {
                await removeConverters();
            });

            context('with unregistered converters', async () => {
                beforeEach(async () => {
                    await removeConverters();
                });

                it('should not allow to remove the same converter twice', async () => {
                    await expectRevert(converterRegistry.removeConverter(converter1.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter2.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter3.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter4.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter5.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter6.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter7.address), 'ERR_INVALID_ITEM');
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, token4.address],
                            [0x2400, 0x2100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, token6.address],
                            [0x3600, 0x3100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, token8.address],
                            [0x4800, 0x4100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, tokenA.address],
                            [0x5a00, 0x5100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, tokenC.address],
                            [0x6c00, 0x6100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token2.address, tokenE.address],
                            [0x7e00, 0x7200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token4.address, token1.address],
                            [0x2100, 0x2400]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token6.address, token1.address],
                            [0x3100, 0x3600]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token8.address, token1.address],
                            [0x4100, 0x4800]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [tokenA.address, token1.address],
                            [0x5100, 0x5a00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [tokenC.address, token1.address],
                            [0x6100, 0x6c00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [tokenE.address, token2.address],
                            [0x7200, 0x7e00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, token4.address],
                            [0x2100, 0x2400]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, token6.address],
                            [0x3100, 0x3600]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, token8.address],
                            [0x4100, 0x4800]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, tokenA.address],
                            [0x5100, 0x5a00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token1.address, tokenC.address],
                            [0x6100, 0x6c00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token2.address, tokenE.address],
                            [0x7200, 0x7e00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token4.address, token1.address],
                            [0x2400, 0x2100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token6.address, token1.address],
                            [0x3600, 0x3100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [token8.address, token1.address],
                            [0x4800, 0x4100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [tokenA.address, token1.address],
                            [0x5a00, 0x5100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [tokenC.address, token1.address],
                            [0x6c00, 0x6100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [tokenE.address, token2.address],
                            [0x7e00, 0x7200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                });
            });
        });
    });

    describe('add new converters', () => {
        const testAdd = async (converter) => {
            const res = await converterRegistry.addConverter(converter.address);

            return testEvents(res, converter, 'Added');
        };

        let converter2;
        let converter3;
        let converter4;
        let converter5;
        let converter6;
        let converter7;
        let anchor1;
        let anchor2;
        let anchor3;
        let anchor4;
        let anchor5;
        let anchor6;
        let anchor7;
        let anchor8;
        let anchorA;
        let anchorC;
        let anchorE;

        beforeEach(async () => {
            anchor1 = await DSToken.new('Token1', 'TKN1', 18);
            anchor2 = await DSToken.new('Token2', 'TKN2', 18);
            anchor3 = await DSToken.new('Token3', 'TKN3', 18);
            anchor4 = await DSToken.new('Token4', 'TKN4', 18);
            anchor5 = await DSToken.new('Token5', 'TKN5', 18);
            anchor6 = await DSToken.new('Token6', 'TKN6', 18);
            anchor7 = await DSToken.new('Token7', 'TKN7', 18);
            anchor8 = await DSToken.new('Token8', 'TKN8', 18);
            anchorA = await DSToken.new('TokenA', 'TKNA', 18);
            anchorC = await DSToken.new('TokenC', 'TKNC', 18);
            anchorE = await DSToken.new('TokenE', 'TKNE', 18);

            converter2 = await LiquidityPoolV1Converter.new(anchor2.address, contractRegistry.address, 0);
            converter3 = await LiquidityPoolV1Converter.new(anchor3.address, contractRegistry.address, 0);
            converter4 = await LiquidityPoolV1Converter.new(anchor4.address, contractRegistry.address, 0);
            converter5 = await LiquidityPoolV1Converter.new(anchor5.address, contractRegistry.address, 0);
            converter6 = await LiquidityPoolV1Converter.new(anchor6.address, contractRegistry.address, 0);
            converter7 = await LiquidityPoolV1Converter.new(anchor7.address, contractRegistry.address, 0);

            await converter2.addReserve(anchor4.address, 0x2400);
            await converter3.addReserve(anchor6.address, 0x3600);
            await converter4.addReserve(anchor8.address, 0x4800);
            await converter5.addReserve(anchorA.address, 0x5a00);
            await converter6.addReserve(anchorC.address, 0x6c00);
            await converter7.addReserve(anchorE.address, 0x7e00);

            await converter2.addReserve(anchor1.address, 0x2100);
            await converter3.addReserve(anchor1.address, 0x3100);
            await converter4.addReserve(anchor1.address, 0x4100);
            await converter5.addReserve(anchor1.address, 0x5100);
            await converter6.addReserve(anchor1.address, 0x6100);
            await converter7.addReserve(anchor2.address, 0x7200);

            await anchor2.transferOwnership(converter2.address);
            await anchor3.transferOwnership(converter3.address);
            await anchor4.transferOwnership(converter4.address);
            await anchor5.transferOwnership(converter5.address);
            await anchor6.transferOwnership(converter6.address);
            await anchor7.transferOwnership(converter7.address);

            await converter2.acceptAnchorOwnership();
            await converter3.acceptAnchorOwnership();
            await converter4.acceptAnchorOwnership();
            await converter5.acceptAnchorOwnership();
            await converter6.acceptAnchorOwnership();
            await converter7.acceptAnchorOwnership();
        });

        const addConverters = async () => {
            await testAdd(converter2);
            await testAdd(converter3);
            await testAdd(converter4);
            await testAdd(converter5);
            await testAdd(converter6);
            await testAdd(converter7);
        };

        const removeConverters = async () => {
            await testRemove(converter2);
            await testRemove(converter3);
            await testRemove(converter4);
            await testRemove(converter5);
            await testRemove(converter6);
            await testRemove(converter7);
        };

        it('should add converters', async () => {
            await addConverters();
        });

        context('with registered converters', async () => {
            beforeEach(async () => {
                await addConverters();
            });

            it('should not allow to add the same converter twice', async () => {
                await expectRevert(converterRegistry.addConverter(converter2.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter3.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter4.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter5.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter6.address), 'ERR_INVALID_ITEM');
                await expectRevert(converterRegistry.addConverter(converter7.address), 'ERR_INVALID_ITEM');
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchor4.address],
                        [0x2400, 0x2100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchor6.address],
                        [0x3600, 0x3100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchorA.address],
                        [0x5a00, 0x5100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchor8.address],
                        [0x4800, 0x4100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchorC.address],
                        [0x6c00, 0x6100]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor2.address, anchorE.address],
                        [0x7e00, 0x7200]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor4.address, anchor1.address],
                        [0x2100, 0x2400]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor6.address, anchor1.address],
                        [0x3100, 0x3600]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor8.address, anchor1.address],
                        [0x4100, 0x4800]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchorA.address, anchor1.address],
                        [0x5100, 0x5a00]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchorC.address, anchor1.address],
                        [0x6100, 0x6c00]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchorE.address, anchor2.address],
                        [0x7200, 0x7e00]
                    )
                ).to.eql(ZERO_ADDRESS);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchor4.address],
                        [0x2100, 0x2400]
                    )
                ).to.eql(anchor2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchor6.address],
                        [0x3100, 0x3600]
                    )
                ).to.eql(anchor3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchor8.address],
                        [0x4100, 0x4800]
                    )
                ).to.eql(anchor4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchorA.address],
                        [0x5100, 0x5a00]
                    )
                ).to.eql(anchor5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor1.address, anchorC.address],
                        [0x6100, 0x6c00]
                    )
                ).to.eql(anchor6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor2.address, anchorE.address],
                        [0x7200, 0x7e00]
                    )
                ).to.eql(anchor7.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor4.address, anchor1.address],
                        [0x2400, 0x2100]
                    )
                ).to.eql(anchor2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor6.address, anchor1.address],
                        [0x3600, 0x3100]
                    )
                ).to.eql(anchor3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchor8.address, anchor1.address],
                        [0x4800, 0x4100]
                    )
                ).to.eql(anchor4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchorA.address, anchor1.address],
                        [0x5a00, 0x5100]
                    )
                ).to.eql(anchor5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchorC.address, anchor1.address],
                        [0x6c00, 0x6100]
                    )
                ).to.eql(anchor6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [anchorE.address, anchor2.address],
                        [0x7e00, 0x7200]
                    )
                ).to.eql(anchor7.address);
            });

            it('should return a list of converters for a list of anchors', async () => {
                const tokens = [anchor2.address, anchor3.address, anchor4.address];
                const expected = [converter2.address, converter3.address, converter4.address];
                const actual = await converterRegistry.getConvertersByAnchors.call(tokens);
                expect(actual).to.deep.eql(expected);
            });

            it('should remove converters', async () => {
                await removeConverters();
            });

            context('with unregistered converters', async () => {
                beforeEach(async () => {
                    await removeConverters();
                });

                it('should not allow to remove the same converter twice', async () => {
                    await expectRevert(converterRegistry.removeConverter(converter2.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter3.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter4.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter5.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter6.address), 'ERR_INVALID_ITEM');
                    await expectRevert(converterRegistry.removeConverter(converter7.address), 'ERR_INVALID_ITEM');
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchor4.address],
                            [0x2400, 0x2100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchor6.address],
                            [0x3600, 0x3100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchor8.address],
                            [0x4800, 0x4100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchorA.address],
                            [0x5a00, 0x5100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchorC.address],
                            [0x6c00, 0x6100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor2.address, anchorE.address],
                            [0x7e00, 0x7200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor4.address, anchor1.address],
                            [0x2100, 0x2400]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor6.address, anchor1.address],
                            [0x3100, 0x3600]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor8.address, anchor1.address],
                            [0x4100, 0x4800]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchorA.address, anchor1.address],
                            [0x5100, 0x5a00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchorC.address, anchor1.address],
                            [0x6100, 0x6c00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchorE.address, anchor2.address],
                            [0x7200, 0x7e00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchor4.address],
                            [0x2100, 0x2400]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchor6.address],
                            [0x3100, 0x3600]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchor8.address],
                            [0x4100, 0x4800]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchorA.address],
                            [0x5100, 0x5a00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor1.address, anchorC.address],
                            [0x6100, 0x6c00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor2.address, anchorE.address],
                            [0x7200, 0x7e00]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor4.address, anchor1.address],
                            [0x2400, 0x2100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor6.address, anchor1.address],
                            [0x3600, 0x3100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchor8.address, anchor1.address],
                            [0x4800, 0x4100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchorA.address, anchor1.address],
                            [0x5a00, 0x5100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchorC.address, anchor1.address],
                            [0x6c00, 0x6100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [anchorE.address, anchor2.address],
                            [0x7e00, 0x7200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                });
            });
        });
    });

    describe('create new converters', () => {
        const testCreate = async (type, name, symbol, decimals, maxConversionFee, reserveTokens, reserveWeights) => {
            const res = await converterRegistry.newConverter(
                type,
                name,
                symbol,
                decimals,
                maxConversionFee,
                reserveTokens,
                reserveWeights
            );
            const converter = await ConverterBase.at(await converterRegistry.createdConverter.call());
            await testEvents(res, converter, 'Added');

            await converter.acceptOwnership();
        };

        let erc20Token1;
        let erc20Token2;

        beforeEach(async () => {
            erc20Token1 = await TestStandardToken.new('TKN1', 'ET1', 18, 1000000000);
            erc20Token2 = await TestStandardToken.new('TKN2', 'ET2', 18, 1000000000);
        });

        const createConverters = async () => {
            await testCreate(1, 'Pool1', 'ST4', 18, 0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [0x4000, 0x4100]);
            await testCreate(1, 'Pool2', 'ST5', 18, 0, [erc20Token1.address, erc20Token2.address], [0x5100, 0x5200]);
            await testCreate(1, 'Pool3', 'ST6', 18, 0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [0x6200, 0x6000]);
            await testCreate(3, 'Pool7', 'STA', 18, 0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [500000, 500000]);
            await testCreate(3, 'Pool8', 'STB', 18, 0, [erc20Token1.address, erc20Token2.address], [500000, 500000]);
            await testCreate(3, 'Pool9', 'STC', 18, 0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [500000, 500000]);
        };

        it('should create converters', async () => {
            await createConverters();
        });

        context('with created converters', async () => {
            const removeConverters = async () => {
                for (const converter of converters) {
                    await testRemove(converter);
                }
            };

            let converters;
            let anchors;

            beforeEach(async () => {
                await createConverters();

                anchors = await converterRegistry.getAnchors();
                const converterAnchors = await Promise.all(anchors.map((anchor) => IConverterAnchor.at(anchor)));
                const converterAddresses = await Promise.all(converterAnchors.map((anchor) => anchor.owner.call()));
                converters = await Promise.all(converterAddresses.map((address) => ConverterBase.at(address)));
            });

            it('should not allow to add the same converter twice', async () => {
                for (const converter of converters) {
                    await expectRevert(converterRegistry.addConverter(converter.address), 'ERR_INVALID_ITEM');
                }
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [ETH_RESERVE_ADDRESS, erc20Token1.address],
                        [0x4000, 0x4100]
                    )
                ).to.eql(anchors[0]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [erc20Token1.address, erc20Token2.address],
                        [0x5100, 0x5200]
                    )
                ).to.eql(anchors[1]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        1,
                        [erc20Token2.address, ETH_RESERVE_ADDRESS],
                        [0x6200, 0x6000]
                    )
                ).to.eql(anchors[2]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [ETH_RESERVE_ADDRESS, erc20Token1.address],
                        [500000, 500000]
                    )
                ).to.eql(anchors[3]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [erc20Token1.address, erc20Token2.address],
                        [500000, 500000]
                    )
                ).to.eql(anchors[4]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [erc20Token2.address, ETH_RESERVE_ADDRESS],
                        [500000, 500000]
                    )
                ).to.eql(anchors[5]);
            });

            it('should return a list of converters for a list of anchors', async () => {
                expect(await converterRegistry.getConvertersByAnchors.call(anchors)).to.have.members(
                    converters.map((converter) => converter.address)
                );
            });

            it('should remove converters', async () => {
                await removeConverters();
            });

            context('with removed converters', async () => {
                beforeEach(async () => {
                    await removeConverters();
                });

                it('should not allow to remove the same converter twice', async () => {
                    for (const converter of converters) {
                        await expectRevert(converterRegistry.removeConverter(converter.address), 'ERR_INVALID_ITEM');
                    }
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [ETH_RESERVE_ADDRESS, erc20Token1.address],
                            [0x4000, 0x4100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [erc20Token1.address, erc20Token2.address],
                            [0x5100, 0x5200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            1,
                            [erc20Token2.address, ETH_RESERVE_ADDRESS],
                            [0x6200, 0x6000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            2,
                            [ETH_RESERVE_ADDRESS, erc20Token1.address],
                            [0x4000, 0x4100]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            2,
                            [erc20Token1.address, erc20Token2.address],
                            [0x5100, 0x5200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            2,
                            [erc20Token2.address, ETH_RESERVE_ADDRESS],
                            [0x6200, 0x6000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [ETH_RESERVE_ADDRESS, erc20Token1.address],
                            [500000, 500000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token1.address, erc20Token2.address],
                            [500000, 500000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token2.address, ETH_RESERVE_ADDRESS],
                            [500000, 500000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                });
            });
        });
    });

    describe('create new standard converters of type 1', () => {
        const testCreate = async (type, name, symbol, decimals, maxConversionFee, reserveTokens, reserveWeights) => {
            const res = await converterRegistry.newConverter(
                type,
                name,
                symbol,
                decimals,
                maxConversionFee,
                reserveTokens,
                reserveWeights
            );
            const converter = await ConverterBase.at(await converterRegistry.createdConverter.call());
            await testEvents(res, converter, 'Added');

            await converter.acceptOwnership();
        };

        let erc20Token1;
        let erc20Token2;

        beforeEach(async () => {
            erc20Token1 = await TestStandardToken.new('TKN1', 'ET1', 18, 1000000000);
            erc20Token2 = await TestStandardToken.new('TKN2', 'ET2', 18, 1000000000);
        });

        const createConverters = async () => {
            await testCreate(1, 'Pool1', 'ST4', 18, 0, [ETH_RESERVE_ADDRESS, erc20Token1.address], [500000, 500000]);
            await testCreate(1, 'Pool2', 'ST5', 18, 0, [erc20Token1.address, erc20Token2.address], [500000, 500000]);
            await testCreate(1, 'Pool3', 'ST6', 18, 0, [erc20Token2.address, ETH_RESERVE_ADDRESS], [500000, 500000]);
        };

        it('should create converters', async () => {
            await createConverters();
        });

        context('with created converters', async () => {
            const removeConverters = async () => {
                for (const converter of converters) {
                    await testRemove(converter);
                }
            };

            let converters;
            let anchors;

            beforeEach(async () => {
                await createConverters();

                anchors = await converterRegistry.getAnchors();
                const converterAnchors = await Promise.all(anchors.map((anchor) => IConverterAnchor.at(anchor)));
                const converterAddresses = await Promise.all(converterAnchors.map((anchor) => anchor.owner.call()));
                converters = await Promise.all(converterAddresses.map((address) => ConverterBase.at(address)));
            });

            it('should not allow to add the same converter twice', async () => {
                for (const converter of converters) {
                    await expectRevert(converterRegistry.addConverter(converter.address), 'ERR_INVALID_ITEM');
                }
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [ETH_RESERVE_ADDRESS, erc20Token1.address],
                        [500000, 500000]
                    )
                ).to.eql(anchors[0]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [erc20Token1.address, erc20Token2.address],
                        [500000, 500000]
                    )
                ).to.eql(anchors[1]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [erc20Token2.address, ETH_RESERVE_ADDRESS],
                        [500000, 500000]
                    )
                ).to.eql(anchors[2]);
            });

            it('should return a list of converters for a list of anchors', async () => {
                expect(await converterRegistry.getConvertersByAnchors.call(anchors)).to.have.members(
                    converters.map((converter) => converter.address)
                );
            });

            it('should remove converters', async () => {
                await removeConverters();
            });

            context('with removed converters', async () => {
                beforeEach(async () => {
                    await removeConverters();
                });

                it('should not allow to remove the same converter twice', async () => {
                    for (const converter of converters) {
                        await expectRevert(converterRegistry.removeConverter(converter.address), 'ERR_INVALID_ITEM');
                    }
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [ETH_RESERVE_ADDRESS, erc20Token1.address],
                            [500000, 500000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token1.address, erc20Token2.address],
                            [500000, 500000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token2.address, ETH_RESERVE_ADDRESS],
                            [500000, 500000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                });
            });
        });
    });
});
