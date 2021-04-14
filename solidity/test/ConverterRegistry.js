const { contract } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { NATIVE_TOKEN_ADDRESS, registry } = require('./helpers/Constants');
const { ZERO_ADDRESS } = constants;

const TestStandardToken = contract.fromArtifact('TestStandardToken');
const DSToken = contract.fromArtifact('DSToken');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const IConverterAnchor = contract.fromArtifact('IConverterAnchor');
const StandardPoolConverter = contract.fromArtifact('StandardPoolConverter');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');
const ConverterRegistry = contract.fromArtifact('TestConverterRegistry');

const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_POOL_CONVERTER_WEIGHT = 500_000;

describe('ConverterRegistry', () => {
    let contractRegistry;
    let converterFactory;
    let converterRegistry;
    let converterRegistryData;

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        converterFactory = await ConverterFactory.new();

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

        expectEvent(res, `ConverterAnchor${suffix}`, { anchor });

        if (count.gt(new BN(1))) {
            expectEvent(res, `LiquidityPool${suffix}`, { liquidityPool: anchor });
        } else {
            expectEvent(res, `ConvertibleToken${suffix}`, { convertibleToken: anchor, smartToken: anchor });
        }

        for (let i = 0; count.gt(new BN(i)); ++i) {
            const connectorToken = await converter.connectorTokens.call(i);
            expectEvent(res, `ConvertibleToken${suffix}`, { convertibleToken: connectorToken, smartToken: anchor });
        }
    };

    describe('add new converters', () => {
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

            converter1 = await StandardPoolConverter.new(anchor2.address, contractRegistry.address, 0);
            converter2 = await StandardPoolConverter.new(anchor3.address, contractRegistry.address, 0);
            converter3 = await StandardPoolConverter.new(anchor4.address, contractRegistry.address, 0);
            converter4 = await StandardPoolConverter.new(anchor5.address, contractRegistry.address, 0);
            converter5 = await StandardPoolConverter.new(anchor6.address, contractRegistry.address, 0);
            converter6 = await StandardPoolConverter.new(anchor7.address, contractRegistry.address, 0);

            await converter1.addReserve(anchor4.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await converter1.addReserve(anchor1.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await anchor2.transferOwnership(converter1.address);
            await converter1.acceptAnchorOwnership();

            await converter2.addReserve(anchor6.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await converter2.addReserve(anchor1.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await anchor3.transferOwnership(converter2.address);
            await converter2.acceptAnchorOwnership();

            await converter3.addReserve(anchor8.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await converter3.addReserve(anchor1.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await anchor4.transferOwnership(converter3.address);
            await converter3.acceptAnchorOwnership();

            await converter4.addReserve(anchorA.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await converter4.addReserve(anchor1.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await anchor5.transferOwnership(converter4.address);
            await converter4.acceptAnchorOwnership();

            await converter5.addReserve(anchorC.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await converter5.addReserve(anchor1.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await anchor6.transferOwnership(converter5.address);
            await converter5.acceptAnchorOwnership();

            await converter6.addReserve(anchor2.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await converter6.addReserve(anchorE.address, STANDARD_POOL_CONVERTER_WEIGHT);
            await anchor7.transferOwnership(converter6.address);
            await converter6.acceptAnchorOwnership();
        });

        const addConverters = async () => {
            await testAdd(converter1);
            await testAdd(converter2);
            await testAdd(converter3);
            await testAdd(converter4);
            await testAdd(converter5);
            await testAdd(converter6);
        };

        const removeConverters = async () => {
            await testRemove(converter1);
            await testRemove(converter2);
            await testRemove(converter3);
            await testRemove(converter4);
            await testRemove(converter5);
            await testRemove(converter6);
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
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchor4.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchor6.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchor8.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchorA.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchorC.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor2.address, anchorE.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor7.address);

                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor4.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor6.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchor8.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchorA.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchorC.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [anchorE.address, anchor2.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchor7.address);
            });

            it('should return a list of converters for a list of anchors', async () => {
                const tokens = [anchor2.address, anchor3.address, anchor4.address];
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
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor4.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor6.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor8.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorA.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorC.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor2.address, anchorE.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor4.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor6.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor8.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchorA.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchorC.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchorE.address, anchor2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor4.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor6.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor8.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorA.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorC.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor2.address, anchorE.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor4.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor6.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchor8.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchorA.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchorC.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [anchorE.address, anchor2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
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
            const converter = await StandardPoolConverter.at(await converterRegistry.createdConverter.call());
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
            await testCreate(
                STANDARD_CONVERTER_TYPE,
                'Pool1',
                'ST1',
                18,
                0,
                [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
            );
            await testCreate(
                STANDARD_CONVERTER_TYPE,
                'Pool2',
                'ST2',
                18,
                0,
                [erc20Token1.address, erc20Token2.address],
                [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
            );
            await testCreate(
                STANDARD_CONVERTER_TYPE,
                'Pool3',
                'ST3',
                18,
                0,
                [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
            );
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
                converters = await Promise.all(converterAddresses.map((address) => StandardPoolConverter.at(address)));
            });

            it('should not allow to add the same converter twice', async () => {
                for (const converter of converters) {
                    await expectRevert(converterRegistry.addConverter(converter.address), 'ERR_INVALID_ITEM');
                }
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchors[0]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [erc20Token1.address, erc20Token2.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchors[1]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        STANDARD_CONVERTER_TYPE,
                        [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
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
                            STANDARD_CONVERTER_TYPE,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [0x4000, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, 0x5200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            STANDARD_CONVERTER_TYPE,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [0x6200, 0x6000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            2,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [0x4000, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            2,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, 0x5200]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            2,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [0x6200, 0x6000]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                });
            });
        });
    });

    describe('create new standard converters of type 3', () => {
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
            const converter = await StandardPoolConverter.at(await converterRegistry.createdConverter.call());
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
            await testCreate(
                STANDARD_CONVERTER_TYPE,
                'Pool1',
                'ST4',
                18,
                0,
                [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
            );
            await testCreate(
                STANDARD_CONVERTER_TYPE,
                'Pool2',
                'ST5',
                18,
                0,
                [erc20Token1.address, erc20Token2.address],
                [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
            );
            await testCreate(
                STANDARD_CONVERTER_TYPE,
                'Pool3',
                'ST6',
                18,
                0,
                [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
            );
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
                converters = await Promise.all(converterAddresses.map((address) => StandardPoolConverter.at(address)));
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
                        [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchors[0]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [erc20Token1.address, erc20Token2.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.eql(anchors[1]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig.call(
                        3,
                        [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
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
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig.call(
                            3,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.eql(ZERO_ADDRESS);
                });
            });
        });
    });
});
