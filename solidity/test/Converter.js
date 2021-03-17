const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { expectRevert, expectEvent, constants, BN, balance, time } = require('@openzeppelin/test-helpers');
const { expect } = require('../../chai-local');

const { NATIVE_TOKEN_ADDRESS, registry } = require('./helpers/Constants');

const { ZERO_ADDRESS } = constants;

const BancorNetwork = contract.fromArtifact('BancorNetwork');
const BancorFormula = contract.fromArtifact('BancorFormula');
const ContractRegistry = contract.fromArtifact('ContractRegistry');
const TestStandardToken = contract.fromArtifact('TestStandardToken');
const TestNonStandardToken = contract.fromArtifact('TestNonStandardToken');
const ConverterFactory = contract.fromArtifact('ConverterFactory');
const ConverterUpgrader = contract.fromArtifact('ConverterUpgrader');
const ConverterRegistry = contract.fromArtifact('ConverterRegistry');
const ConverterRegistryData = contract.fromArtifact('ConverterRegistryData');

const LiquidityPoolV1Converter = contract.fromArtifact('LiquidityPoolV1Converter');
const StandardPoolConverter = contract.fromArtifact('StandardPoolConverter');
const FixedRatePoolConverter = contract.fromArtifact('FixedRatePoolConverter');
const LiquidityPoolV1ConverterFactory = contract.fromArtifact('LiquidityPoolV1ConverterFactory');
const StandardPoolConverterFactory = contract.fromArtifact('StandardPoolConverterFactory');
const FixedRatePoolConverterFactory = contract.fromArtifact('FixedRatePoolConverterFactory');
const DSToken = contract.fromArtifact('DSToken');

describe('Converter', () => {
    const createConverter = async (
        type,
        anchorAddress,
        registryAddress = contractRegistry.address,
        maxConversionFee = 0
    ) => {
        switch (type) {
            case 1:
                return LiquidityPoolV1Converter.new(anchorAddress, registryAddress, maxConversionFee);
            case 3:
                return StandardPoolConverter.new(anchorAddress, registryAddress, maxConversionFee);
            case 4:
                return FixedRatePoolConverter.new(anchorAddress, registryAddress, maxConversionFee);
        }
    };

    const getConverterName = (type) => {
        switch (type) {
            case 1:
                return 'LiquidityPoolV1Converter';
            case 3:
                return 'StandardPoolConverter';
            case 4:
                return 'FixedRatePoolConverter';
        }

        return 'Unknown';
    };

    const getConverterReserveAddresses = (type, isETHReserve) => {
        switch (type) {
            case 1:
                return [getReserve1Address(isETHReserve), reserveToken2.address];
            case 3:
            case 4:
                return [getReserve1Address(isETHReserve), reserveToken2.address];
        }

        return 'Unknown';
    };

    const getConverterReserveWeights = (type) => {
        switch (type) {
            case 1:
                return [250000, 150000];
            case 3:
            case 4:
                return [500000, 500000];
        }

        return 'Unknown';
    };

    const getConverterTargetAmountAndFeeError = (type) => {
        switch (type) {
            case 1:
                return 'ERR_SAME_SOURCE_TARGET';
            case 3:
            case 4:
                return 'ERR_INVALID_RESERVES';
        }

        return 'Unknown';
    };

    const initConverter = async (type, activate, isETHReserve, maxConversionFee = 0) => {
        await createAnchor();
        const reserveAddresses = getConverterReserveAddresses(type, isETHReserve);
        const reserveWeights = getConverterReserveWeights(type);

        const converter = await createConverter(type, anchorAddress, contractRegistry.address, maxConversionFee);

        for (let i = 0; i < reserveAddresses.length; i++) {
            await converter.addReserve(reserveAddresses[i], reserveWeights[i]);
        }

        if (type == 4) {
            await converter.setRate(1, 1);
        }

        await reserveToken2.transfer(converter.address, 8000);
        await anchor.issue(owner, 20000);

        if (isETHReserve) {
            await converter.send(5000);
        } else {
            await reserveToken.transfer(converter.address, 5000);
        }

        if (activate) {
            await anchor.transferOwnership(converter.address);
            await converter.acceptAnchorOwnership();
        }

        return converter;
    };

    const createAnchor = async () => {
        anchor = await DSToken.new('Pool1', 'POOL1', 2);
        anchorAddress = anchor.address;
    };

    const getReserve1Address = (isETH) => {
        return isETH ? NATIVE_TOKEN_ADDRESS : reserveToken.address;
    };

    const getBalance = async (token, address, account) => {
        if (address === NATIVE_TOKEN_ADDRESS) {
            return balance.current(account);
        }

        return token.balanceOf.call(account);
    };

    const convert = async (path, amount, minReturn, options) => {
        return bancorNetwork.convertByPath2.call(path, amount, minReturn, ZERO_ADDRESS, options);
    };

    let bancorNetwork;
    let factory;
    let anchor;
    let anchorAddress;
    let contractRegistry;
    let reserveToken;
    let reserveToken2;
    let upgrader;
    const owner = defaultSender;
    const nonOwner = accounts[1];
    const receiver = accounts[3];

    const MIN_RETURN = new BN(1);
    const WEIGHT_10_PERCENT = new BN(100000);
    const MAX_CONVERSION_FEE = new BN(200000);

    before(async () => {
        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await ContractRegistry.new();

        const bancorFormula = await BancorFormula.new();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        factory = await ConverterFactory.new();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await LiquidityPoolV1ConverterFactory.new()).address);
        await factory.registerTypedConverterFactory((await StandardPoolConverterFactory.new()).address);
        await factory.registerTypedConverterFactory((await FixedRatePoolConverterFactory.new()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await BancorNetwork.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await ConverterUpgrader.new(contractRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        reserveToken = await TestStandardToken.new('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await TestNonStandardToken.new('ERC Token 2', 'ERC2', 18, 2000000000);
    });

    for (const type of [1, 3, 4]) {
        it('verifies that converterType returns the correct type', async () => {
            const converter = await initConverter(type, true, true);
            const converterType = await converter.converterType.call();
            expect(converterType).to.be.bignumber.equal(new BN(type));
        });

        it('verifies that sending ether to the converter succeeds if it has ETH reserve', async () => {
            const converter = await initConverter(type, true, true);
            await converter.send(100);
        });

        it('should revert when sending ether to the converter fails if it has no ETH reserve', async () => {
            const converter = await initConverter(type, true, false);
            await expectRevert(converter.send(100), 'ERR_INVALID_RESERVE');
        });

        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
            describe(`${getConverterName(type)}${isETHReserve === 0 ? '' : ' (with ETH reserve)'}:`, () => {
                it('verifies the converter data after construction', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    const anchor = await converter.anchor.call();
                    expect(anchor).to.eql(anchorAddress);

                    const registry = await converter.registry.call();
                    expect(registry).to.eql(contractRegistry.address);

                    const maxConversionFee = await converter.maxConversionFee.call();
                    expect(maxConversionFee).to.be.bignumber.equal(new BN(0));
                });

                it('should revert when attempting to construct a converter with no anchor', async () => {
                    await expectRevert(createConverter(type, ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to construct a converter with no contract registry', async () => {
                    await expectRevert(createConverter(type, anchorAddress, ZERO_ADDRESS), 'ERR_INVALID_ADDRESS');
                });

                it('should revert when attempting to construct a converter with invalid conversion fee', async () => {
                    await expectRevert(
                        createConverter(type, anchorAddress, contractRegistry.address, 1000001),
                        'ERR_INVALID_CONVERSION_FEE'
                    );
                });

                it('verifies that the converter registry can create a new converter', async () => {
                    const converterRegistry = await ConverterRegistry.new(contractRegistry.address);
                    const converterRegistryData = await ConverterRegistryData.new(contractRegistry.address);

                    await contractRegistry.registerAddress(registry.CONVERTER_REGISTRY, converterRegistry.address);
                    await contractRegistry.registerAddress(
                        registry.CONVERTER_REGISTRY_DATA,
                        converterRegistryData.address
                    );

                    await converterRegistry.newConverter(
                        type,
                        'test',
                        'TST',
                        2,
                        1000,
                        getConverterReserveAddresses(type, isETHReserve),
                        getConverterReserveWeights(type)
                    );
                });

                if (type != 3 && type != 4) {
                    it('verifies the owner can update the conversion whitelist contract address', async () => {
                        const converter = await initConverter(type, false, isETHReserve);
                        const prevWhitelist = await converter.conversionWhitelist.call();

                        await converter.setConversionWhitelist(receiver);

                        const newWhitelist = await converter.conversionWhitelist.call();
                        expect(prevWhitelist).not.to.eql(newWhitelist);
                    });

                    it('should revert when a non owner attempts update the conversion whitelist contract address', async () => {
                        const converter = await initConverter(type, false, isETHReserve);

                        await expectRevert(
                            converter.setConversionWhitelist(receiver, { from: nonOwner }),
                            'ERR_ACCESS_DENIED'
                        );
                    });

                    it('verifies the owner can remove the conversion whitelist contract address', async () => {
                        const converter = await initConverter(type, false, isETHReserve);
                        await converter.setConversionWhitelist(receiver);

                        let whitelist = await converter.conversionWhitelist.call();
                        expect(whitelist).to.eql(receiver);

                        await converter.setConversionWhitelist(ZERO_ADDRESS);
                        whitelist = await converter.conversionWhitelist.call();

                        expect(whitelist).to.eql(ZERO_ADDRESS);
                    });
                }

                it('verifies the owner can update the fee', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    const newFee = MAX_CONVERSION_FEE.sub(new BN(10));
                    await converter.setConversionFee(newFee);

                    const conversionFee = await converter.conversionFee.call();
                    expect(conversionFee).to.be.bignumber.equal(newFee);
                });

                it('should revert when attempting to update the fee to an invalid value', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    await expectRevert(
                        converter.setConversionFee(MAX_CONVERSION_FEE.add(new BN(1))),
                        'ERR_INVALID_CONVERSION_FEE'
                    );
                });

                it('should revert when a non owner attempts to update the fee', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    const newFee = new BN(30000);
                    await expectRevert(converter.setConversionFee(newFee, { from: nonOwner }), 'ERR_ACCESS_DENIED');
                });

                it('verifies that an event is fired when the owner updates the fee', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    const newFee = new BN(30000);

                    const res = await converter.setConversionFee(newFee);
                    expectEvent(res, 'ConversionFeeUpdate', { _prevFee: new BN(0), _newFee: newFee });
                });

                it('verifies that an event is fired when the owner updates the fee multiple times', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    let prevFee = new BN(0);
                    for (let i = 1; i <= 10; ++i) {
                        const newFee = new BN(10000 * i);

                        const res = await converter.setConversionFee(newFee);
                        expectEvent(res, 'ConversionFeeUpdate', { _prevFee: prevFee, _newFee: newFee });

                        prevFee = newFee;
                    }
                });

                if (type != 3 && type != 4) {
                    it('should revert when a non owner attempts to add a reserve', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expectRevert(
                            converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT, {
                                from: nonOwner
                            }),
                            'ERR_ACCESS_DENIED'
                        );
                    });

                    it('should revert when attempting to add a reserve with invalid address', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expectRevert(
                            converter.addReserve(ZERO_ADDRESS, WEIGHT_10_PERCENT),
                            'ERR_INVALID_EXTERNAL_ADDRESS.'
                        );
                    });

                    it('should revert when attempting to add a reserve with weight = 0', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expectRevert(
                            converter.addReserve(getReserve1Address(isETHReserve), 0),
                            'ERR_INVALID_RESERVE_WEIGHT'
                        );
                    });

                    it('should revert when attempting to add a reserve with weight greater than 100%', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expectRevert(
                            converter.addReserve(getReserve1Address(isETHReserve), 1000001),
                            'ERR_INVALID_RESERVE_WEIGHT'
                        );
                    });

                    it('should revert when attempting to add the anchor as a reserve', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expectRevert(
                            converter.addReserve(anchorAddress, WEIGHT_10_PERCENT),
                            'ERR_INVALID_RESERVE'
                        );
                    });

                    it('verifies that the correct reserve weight is returned', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);
                        await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                        const reserveWeight = await converter.reserveWeight.call(getReserve1Address(isETHReserve));
                        expect(reserveWeight).to.be.bignumber.equal(WEIGHT_10_PERCENT);
                    });

                    it('should revert when attempting to retrieve the balance for a reserve that does not exist', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);
                        await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                        await expectRevert(converter.reserveBalance.call(reserveToken2.address), 'ERR_INVALID_RESERVE');
                    });
                }

                it('verifies that the converter can accept the anchor ownership', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    await anchor.transferOwnership(converter.address);
                    await converter.acceptAnchorOwnership();

                    expect(await anchor.owner.call()).to.eql(converter.address);
                });

                it('should revert when attempting to accept an anchor ownership of a converter without any reserves', async () => {
                    await createAnchor();
                    const converter = await createConverter(type, anchorAddress);

                    await anchor.transferOwnership(converter.address);
                    await expectRevert(converter.acceptAnchorOwnership(), 'ERR_INVALID_RESERVE_COUNT');
                });

                it('verifies that the owner can transfer the anchor ownership if the owner is the upgrader contract', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, owner);

                    await converter.transferAnchorOwnership(nonOwner);

                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
                    const anchorAddress = await converter.anchor.call();
                    const token = await DSToken.at(anchorAddress);
                    const newOwner = await token.newOwner.call();
                    expect(newOwner).to.eql(nonOwner);
                });

                it('should revert when the owner attempts to transfer the anchor ownership', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expectRevert(converter.transferAnchorOwnership(nonOwner), 'ERR_ACCESS_DENIED');
                });

                it('should revert when a non owner attempts to transfer the anchor ownership', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expectRevert(
                        converter.transferAnchorOwnership(nonOwner, { from: nonOwner }),
                        'ERR_ACCESS_DENIED'
                    );
                });

                // eslint-disable-next-line max-len
                it('should revert when a the upgrader contract attempts to transfer the anchor ownership while the upgrader is not the owner', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, nonOwner);

                    await expectRevert(
                        converter.transferAnchorOwnership(nonOwner, { from: nonOwner }),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('verifies that isActive returns true when the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    const isActive = await converter.isActive.call();
                    expect(isActive).to.be.true();
                });

                it('verifies that isActive returns false when the converter is inactive', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    const isActive = await converter.isActive.call();
                    expect(isActive).to.be.false();
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const token = await TestStandardToken.new('ERC Token 3', 'ERC3', 18, 100000);

                    const value = new BN(1000);
                    await token.transfer(converter.address, value);

                    let converterBalance = await token.balanceOf.call(converter.address);
                    expect(converterBalance).to.be.bignumber.equal(value);

                    const value2 = new BN(10);
                    await converter.withdrawTokens(token.address, receiver, value2);

                    converterBalance = await token.balanceOf.call(converter.address);
                    expect(converterBalance).to.be.bignumber.equal(value.sub(value2));

                    const receivedBalance = await token.balanceOf.call(receiver);
                    expect(receivedBalance).to.be.bignumber.equal(value2);
                });

                it('verifies that the owner can withdraw a reserve token from the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const prevBalance = await getBalance(reserveToken, getReserve1Address(isETHReserve), receiver);
                    const converterBalance = await getBalance(
                        reserveToken,
                        getReserve1Address(isETHReserve),
                        converter.address
                    );
                    if (isETHReserve) {
                        await converter.withdrawETH(receiver);
                    } else {
                        await converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, converterBalance);
                    }

                    const balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), receiver);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(converterBalance));
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    const token = await TestStandardToken.new('ERC Token 3', 'ERC3', 18, 100000);
                    const value = new BN(1000);
                    await token.transfer(converter.address, value);

                    const prevBalance = await token.balanceOf.call(receiver);
                    const value2 = new BN(1);
                    await converter.withdrawTokens(token.address, receiver, value2);

                    const balance = await token.balanceOf.call(receiver);
                    expect(balance).to.be.bignumber.equal(prevBalance.add(value2));
                });

                it('should revert when the owner attempts to withdraw a reserve token while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    const value = new BN(1);
                    if (isETHReserve) {
                        await expectRevert(converter.withdrawETH(receiver), 'ERR_ACCESS_DENIED');
                    } else {
                        await expectRevert(
                            converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, value),
                            'ERR_ACCESS_DENIED'
                        );
                    }
                });

                it('should revert when a non owner attempts to withdraw a non reserve token while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const token = await TestStandardToken.new('ERC Token 3', 'ERC3', 18, 100000);

                    const value = new BN(255);
                    await token.transfer(converter.address, value);

                    const balance = await token.balanceOf.call(converter.address);
                    expect(balance).to.be.bignumber.equal(value);

                    const value2 = new BN(5);
                    await expectRevert(
                        converter.withdrawTokens(token.address, receiver, value2, { from: nonOwner }),
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when a non owner attempts to withdraw a reserve token while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const value = new BN(5);
                    if (isETHReserve) {
                        await expectRevert(converter.withdrawETH(receiver, { from: nonOwner }), 'ERR_ACCESS_DENIED');
                    } else {
                        await expectRevert(
                            converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, value, {
                                from: nonOwner
                            }),
                            'ERR_ACCESS_DENIED'
                        );
                    }
                });

                it('should revert when a non owner attempts to withdraw a reserve token while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    const value = new BN(5);
                    if (isETHReserve) {
                        await expectRevert(converter.withdrawETH(receiver, { from: nonOwner }), 'ERR_ACCESS_DENIED');
                    } else {
                        await expectRevert(
                            converter.withdrawTokens(getReserve1Address(isETHReserve), receiver, value, {
                                from: nonOwner
                            }),
                            'ERR_ACCESS_DENIED'
                        );
                    }
                });

                it('verifies that the owner can upgrade the converter while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter using the legacy upgrade function', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await converter.transferOwnership(upgrader.address);
                    await upgrader.upgradeOld(converter.address, web3.utils.utf8ToHex('0.9'));
                });

                it('should revert when a non owner attempts to upgrade the converter', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expectRevert(converter.upgrade({ from: nonOwner }), 'ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to get the target amount with an invalid source token adress', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expectRevert(
                        converter.targetAmountAndFee.call(ZERO_ADDRESS, getReserve1Address(isETHReserve), 500),
                        'ERR_INVALID_RESERVE'
                    );
                });

                it('should revert when attempting to get the target amount with an invalid target token address', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expectRevert(
                        converter.targetAmountAndFee.call(getReserve1Address(isETHReserve), ZERO_ADDRESS, 500),
                        'ERR_INVALID_RESERVE'
                    );
                });

                it('should revert when attempting to get the target amount with identical source/target addresses', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expectRevert(
                        converter.targetAmountAndFee.call(
                            getReserve1Address(isETHReserve),
                            getReserve1Address(isETHReserve),
                            500
                        ),
                        getConverterTargetAmountAndFeeError(type)
                    );
                });

                it('should revert when attempting to convert with an invalid source token address', async () => {
                    await initConverter(type, true, isETHReserve);
                    await expectRevert(
                        convert([ZERO_ADDRESS, anchorAddress, getReserve1Address(isETHReserve)], 500, MIN_RETURN),
                        'Address: call to non-contract'
                    );
                });

                it('should revert when attempting to convert with an invalid target token address', async () => {
                    await initConverter(type, true, isETHReserve);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.approve(bancorNetwork.address, amount, { from: owner });
                    }

                    await expectRevert(
                        convert([getReserve1Address(isETHReserve), anchorAddress, ZERO_ADDRESS], amount, MIN_RETURN, {
                            value
                        }),
                        'ERR_INVALID_RESERVE'
                    );
                });

                it('should revert when attempting to convert with identical source/target addresses', async () => {
                    await initConverter(type, true, isETHReserve);

                    const amount = new BN(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.approve(bancorNetwork.address, amount, { from: owner });
                    }

                    await expectRevert(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, getReserve1Address(isETHReserve)],
                            amount,
                            MIN_RETURN,
                            { value }
                        ),
                        'ERR_SAME_SOURCE_TARGET'
                    );
                });
            });
        }
    }
});
