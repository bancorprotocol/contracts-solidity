const chai = require('chai');
const { BigNumber } = require('ethers');

const { NATIVE_TOKEN_ADDRESS, ZERO_ADDRESS, registry } = require('../helpers/Constants');
const Contracts = require('../../components/Contracts').default;

chai.use(require('chai-arrays'));
const { expect } = chai;

const STANDARD_CONVERTER_TYPE = 3;
const STANDARD_POOL_CONVERTER_WEIGHT = 500_000;

let contractRegistry;
let converterFactory;
let converterRegistry;
let converterRegistryData;

describe('ConverterRegistry', () => {
    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        converterFactory = await Contracts.ConverterFactory.deploy();

        await converterFactory.registerTypedConverterFactory(
            (
                await Contracts.StandardPoolConverterFactory.deploy()
            ).address
        );
    });

    beforeEach(async () => {
        contractRegistry = await Contracts.ContractRegistry.deploy();
        converterRegistry = await Contracts.TestConverterRegistry.deploy(contractRegistry.address);
        converterRegistryData = await Contracts.ConverterRegistryData.deploy(contractRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, converterFactory.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY_DATA, converterRegistryData.address);
    });

    const testRemove = async (converter) => {
        const res = await converterRegistry.removeConverter(converter.address);

        return testEvents(res, converter, 'Removed');
    };

    const testEvents = async (res, converter, suffix) => {
        const anchor = await converter.token();
        const count = BigNumber.from(await converter.connectorTokenCount());

        await expect(res).to.emit(converterRegistry, `ConverterAnchor${suffix}`).withArgs(anchor);

        if (count.gt(BigNumber.from(1))) {
            await expect(res).to.emit(converterRegistry, `LiquidityPool${suffix}`).withArgs(anchor);
        } else {
            await expect(res).to.emit(converterRegistry, `ConvertibleToken${suffix}`).withArgs(anchor, anchor);
        }

        for (let i = 0; count.gt(BigNumber.from(i)); ++i) {
            const connectorToken = await converter.connectorTokens(i);
            await expect(res).to.emit(converterRegistry, `ConvertibleToken${suffix}`).withArgs(connectorToken, anchor);
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
            anchor1 = await Contracts.DSToken.deploy('Token1', 'TKN1', 18);
            anchor2 = await Contracts.DSToken.deploy('Token2', 'TKN2', 18);
            anchor3 = await Contracts.DSToken.deploy('Token3', 'TKN3', 18);
            anchor4 = await Contracts.DSToken.deploy('Token4', 'TKN4', 18);
            anchor5 = await Contracts.DSToken.deploy('Token5', 'TKN5', 18);
            anchor6 = await Contracts.DSToken.deploy('Token6', 'TKN6', 18);
            anchor7 = await Contracts.DSToken.deploy('Token7', 'TKN7', 18);
            anchor8 = await Contracts.DSToken.deploy('Token8', 'TKN8', 18);
            anchorA = await Contracts.DSToken.deploy('TokenA', 'TKNA', 18);
            anchorC = await Contracts.DSToken.deploy('TokenC', 'TKNC', 18);
            anchorE = await Contracts.DSToken.deploy('TokenE', 'TKNE', 18);

            converter1 = await Contracts.StandardPoolConverter.deploy(anchor2.address, contractRegistry.address, 0);
            converter2 = await Contracts.StandardPoolConverter.deploy(anchor3.address, contractRegistry.address, 0);
            converter3 = await Contracts.StandardPoolConverter.deploy(anchor4.address, contractRegistry.address, 0);
            converter4 = await Contracts.StandardPoolConverter.deploy(anchor5.address, contractRegistry.address, 0);
            converter5 = await Contracts.StandardPoolConverter.deploy(anchor6.address, contractRegistry.address, 0);
            converter6 = await Contracts.StandardPoolConverter.deploy(anchor7.address, contractRegistry.address, 0);

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
                await expect(converterRegistry.addConverter(converter1.address)).to.be.revertedWith('ERR_INVALID_ITEM');
                await expect(converterRegistry.addConverter(converter2.address)).to.be.revertedWith('ERR_INVALID_ITEM');
                await expect(converterRegistry.addConverter(converter3.address)).to.be.revertedWith('ERR_INVALID_ITEM');
                await expect(converterRegistry.addConverter(converter4.address)).to.be.revertedWith('ERR_INVALID_ITEM');
                await expect(converterRegistry.addConverter(converter5.address)).to.be.revertedWith('ERR_INVALID_ITEM');
                await expect(converterRegistry.addConverter(converter6.address)).to.be.revertedWith('ERR_INVALID_ITEM');
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchor4.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchor6.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchor8.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchorA.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor1.address, anchorC.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor2.address, anchorE.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor7.address);

                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor4.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor2.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor6.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor3.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchor8.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor4.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchorA.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor5.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchorC.address, anchor1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor6.address);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [anchorE.address, anchor2.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchor7.address);
            });

            it('should return a list of converters for a list of anchors', async () => {
                const tokens = [anchor2.address, anchor3.address, anchor4.address];
                const expected = [converter1.address, converter2.address, converter3.address];
                const actual = await converterRegistry.getConvertersByAnchors(tokens);
                expect(actual).to.equalTo(expected);
            });

            it('should remove converters', async () => {
                await removeConverters();
            });

            context('with unregistered converters', async () => {
                beforeEach(async () => {
                    await removeConverters();
                });

                it('should not allow to remove the same converter twice', async () => {
                    await expect(converterRegistry.removeConverter(converter1.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                    await expect(converterRegistry.removeConverter(converter2.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                    await expect(converterRegistry.removeConverter(converter3.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                    await expect(converterRegistry.removeConverter(converter4.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                    await expect(converterRegistry.removeConverter(converter5.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                    await expect(converterRegistry.removeConverter(converter6.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor4.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor6.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor8.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorA.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorC.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor2.address, anchorE.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor4.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor6.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor8.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchorA.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchorC.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchorE.address, anchor2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor4.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor6.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchor8.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorA.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor1.address, anchorC.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor2.address, anchorE.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor4.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor6.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchor8.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchorA.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchorC.address, anchor1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [anchorE.address, anchor2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
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
            const converter = await Contracts.StandardPoolConverter.attach(await converterRegistry.createdConverter());
            await testEvents(res, converter, 'Added');

            await converter.acceptOwnership();
        };

        let erc20Token1;
        let erc20Token2;

        beforeEach(async () => {
            erc20Token1 = await Contracts.TestStandardToken.deploy('TKN1', 'ET1', 1000000000);
            erc20Token2 = await Contracts.TestStandardToken.deploy('TKN2', 'ET2', 1000000000);
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
                const converterAnchors = await Promise.all(
                    anchors.map((anchor) => Contracts.IConverterAnchor.attach(anchor))
                );
                const converterAddresses = await Promise.all(converterAnchors.map((anchor) => anchor.owner()));
                converters = await Promise.all(
                    converterAddresses.map((address) => Contracts.StandardPoolConverter.attach(address))
                );
            });

            it('should not allow to add the same converter twice', async () => {
                for (const converter of converters) {
                    await expect(converterRegistry.addConverter(converter.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                }
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchors[0]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [erc20Token1.address, erc20Token2.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchors[1]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        STANDARD_CONVERTER_TYPE,
                        [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchors[2]);
            });

            it('should return a list of converters for a list of anchors', async () => {
                expect(await converterRegistry.getConvertersByAnchors(anchors)).to.have.members(
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
                        await expect(converterRegistry.removeConverter(converter.address)).to.be.revertedWith(
                            'ERR_INVALID_ITEM'
                        );
                    }
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [0x4000, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, 0x5200]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            STANDARD_CONVERTER_TYPE,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [0x6200, 0x6000]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            2,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [0x4000, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            2,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, 0x5200]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            2,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [0x6200, 0x6000]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            3,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            3,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            3,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
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
            const converter = await Contracts.StandardPoolConverter.attach(await converterRegistry.createdConverter());
            await testEvents(res, converter, 'Added');

            await converter.acceptOwnership();
        };

        let erc20Token1;
        let erc20Token2;

        beforeEach(async () => {
            erc20Token1 = await Contracts.TestStandardToken.deploy('TKN1', 'ET1', 1000000000);
            erc20Token2 = await Contracts.TestStandardToken.deploy('TKN2', 'ET2', 1000000000);
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
                const converterAnchors = await Promise.all(
                    anchors.map((anchor) => Contracts.IConverterAnchor.attach(anchor))
                );
                const converterAddresses = await Promise.all(converterAnchors.map((anchor) => anchor.owner()));
                converters = await Promise.all(
                    converterAddresses.map((address) => Contracts.StandardPoolConverter.attach(address))
                );
            });

            it('should not allow to add the same converter twice', async () => {
                for (const converter of converters) {
                    await expect(converterRegistry.addConverter(converter.address)).to.be.revertedWith(
                        'ERR_INVALID_ITEM'
                    );
                }
            });

            it('should find liquidity pool by its configuration', async () => {
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        3,
                        [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchors[0]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        3,
                        [erc20Token1.address, erc20Token2.address],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchors[1]);
                expect(
                    await converterRegistry.getLiquidityPoolByConfig(
                        3,
                        [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                        [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                    )
                ).to.equal(anchors[2]);
            });

            it('should return a list of converters for a list of anchors', async () => {
                expect(await converterRegistry.getConvertersByAnchors(anchors)).to.have.members(
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
                        await expect(converterRegistry.removeConverter(converter.address)).to.be.revertedWith(
                            'ERR_INVALID_ITEM'
                        );
                    }
                });

                it('should not be able to find liquidity pool by its configuration', async () => {
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            3,
                            [NATIVE_TOKEN_ADDRESS, erc20Token1.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            3,
                            [erc20Token1.address, erc20Token2.address],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                    expect(
                        await converterRegistry.getLiquidityPoolByConfig(
                            3,
                            [erc20Token2.address, NATIVE_TOKEN_ADDRESS],
                            [STANDARD_POOL_CONVERTER_WEIGHT, STANDARD_POOL_CONVERTER_WEIGHT]
                        )
                    ).to.equal(ZERO_ADDRESS);
                });
            });
        });
    });
});
