const { expect } = require('chai');

const { BigNumber } = require('ethers');

const { ETH_RESERVE_ADDRESS, registry } = require('./helpers/Constants');

const BancorNetwork = ethers.getContractFactory('BancorNetwork');
const BancorFormula = ethers.getContractFactory('BancorFormula');
const ContractRegistry = ethers.getContractFactory('ContractRegistry');
const TestStandardToken = ethers.getContractFactory('TestStandardToken');
const TestNonStandardToken = ethers.getContractFactory('TestNonStandardToken');
const ConverterFactory = ethers.getContractFactory('ConverterFactory');
const ConverterUpgrader = ethers.getContractFactory('ConverterUpgrader');
const ConverterRegistry = ethers.getContractFactory('ConverterRegistry');
const ConverterRegistryData = ethers.getContractFactory('ConverterRegistryData');

const LiquidityPoolV1Converter = ethers.getContractFactory('LiquidityPoolV1Converter');
const StandardPoolConverter = ethers.getContractFactory('StandardPoolConverter');
const FixedRatePoolConverter = ethers.getContractFactory('FixedRatePoolConverter');
const LiquidityPoolV1ConverterFactory = ethers.getContractFactory('LiquidityPoolV1ConverterFactory');
const StandardPoolConverterFactory = ethers.getContractFactory('StandardPoolConverterFactory');
const FixedRatePoolConverterFactory = ethers.getContractFactory('FixedRatePoolConverterFactory');
const DSToken = ethers.getContractFactory('DSToken');

let bancorNetwork;
let factory;
let anchor;
let anchorAddress;
let contractRegistry;
let reserveToken;
let reserveToken2;
let upgrader;

let owner;
let nonOwner;
let receiver;

// TODO AssertionError: Expected transaction to be reverted with
describe('Converter', () => {
    const createConverter = async (
        type,
        anchorAddress,
        registryAddress = contractRegistry.address,
        maxConversionFee = 0
    ) => {
        switch (type) {
            case 1:
                return await (await LiquidityPoolV1Converter).deploy(anchorAddress, registryAddress, maxConversionFee);
            case 3:
                return await (await StandardPoolConverter).deploy(anchorAddress, registryAddress, maxConversionFee);
            case 4:
                return await (await FixedRatePoolConverter).deploy(anchorAddress, registryAddress, maxConversionFee);
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
        await anchor.issue(owner.address, 20000);

        if (isETHReserve) {
            await owner.sendTransaction({ to: converter.address, value: 5000 });
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
        anchor = await (await DSToken).deploy('Pool1', 'POOL1', 2);
        anchorAddress = anchor.address;
    };

    const getReserve1Address = (isETH) => {
        return isETH ? ETH_RESERVE_ADDRESS : reserveToken.address;
    };

    const getBalance = async (token, address, account) => {
        if (address === ETH_RESERVE_ADDRESS) {
            return ethers.provider.getBalance(account);
        }

        return token.balanceOf(account);
    };

    const convert = async (path, amount, minReturn, options = undefined) => {
        if (options != undefined) {
            return await bancorNetwork.convertByPath2(path, amount, minReturn, ethers.constants.AddressZero, options);
        }
        return await bancorNetwork.convertByPath2(path, amount, minReturn, ethers.constants.AddressZero);
    };

    const MIN_RETURN = BigNumber.from(1);
    const WEIGHT_10_PERCENT = BigNumber.from(100000);
    const MAX_CONVERSION_FEE = BigNumber.from(200000);

    before(async () => {
        accounts = await ethers.getSigners();

        owner = accounts[0];
        nonOwner = accounts[1];
        receiver = accounts[3];

        // The following contracts are unaffected by the underlying tests, this can be shared.
        contractRegistry = await (await ContractRegistry).deploy();

        const bancorFormula = await (await BancorFormula).deploy();
        await bancorFormula.init();
        await contractRegistry.registerAddress(registry.BANCOR_FORMULA, bancorFormula.address);

        factory = await (await ConverterFactory).deploy();
        await contractRegistry.registerAddress(registry.CONVERTER_FACTORY, factory.address);

        await factory.registerTypedConverterFactory((await (await LiquidityPoolV1ConverterFactory).deploy()).address);
        await factory.registerTypedConverterFactory((await (await StandardPoolConverterFactory).deploy()).address);
        await factory.registerTypedConverterFactory((await (await FixedRatePoolConverterFactory).deploy()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await (await BancorNetwork).deploy(contractRegistry.address);
        await contractRegistry.registerAddress(registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await (await ConverterUpgrader).deploy(contractRegistry.address);
        await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);

        reserveToken = await (await TestStandardToken).deploy('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await (await TestNonStandardToken).deploy('ERC Token 2', 'ERC2', 18, 2000000000);
    });

    for (const type of [1, 3, 4]) {
        it('verifies that converterType returns the correct type', async () => {
            const converter = await initConverter(type, true, true);
            const converterType = await converter.converterType();
            expect(converterType).to.be.equal(BigNumber.from(type));
        });

        it('verifies that sending ether to the converter succeeds if it has ETH reserve', async () => {
            const converter = await initConverter(type, true, true);
            await owner.sendTransaction({ to: converter.address, value: 100 });
        });

        it('should revert when sending ether to the converter fails if it has no ETH reserve', async () => {
            const converter = await initConverter(type, true, false);
            await expect(owner.sendTransaction({ to: converter.address, value: 100 })).to.be.revertedWith(
                'ERR_INVALID_RESERVE'
            );
        });

        for (let isETHReserve = 0; isETHReserve < 2; isETHReserve++) {
            describe(`${getConverterName(type)}${isETHReserve === 0 ? '' : ' (with ETH reserve)'}:`, () => {
                it('verifies the converter data after construction', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    const anchor = await converter.anchor();
                    expect(anchor).to.eql(anchorAddress);

                    const registry = await converter.registry();
                    expect(registry).to.eql(contractRegistry.address);

                    const maxConversionFee = await converter.maxConversionFee();
                    expect(maxConversionFee).to.be.equal(BigNumber.from(0));
                });

                it('should revert when attempting to construct a converter with no anchor', async () => {
                    await expect(createConverter(type, ethers.constants.AddressZero)).to.be.revertedWith(
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when attempting to construct a converter with no contract registry', async () => {
                    await expect(createConverter(type, anchorAddress, ethers.constants.AddressZero)).to.be.revertedWith(
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when attempting to construct a converter with invalid conversion fee', async () => {
                    await expect(
                        createConverter(type, anchorAddress, contractRegistry.address, 1000001)
                    ).to.be.revertedWith('ERR_INVALID_CONVERSION_FEE');
                });

                it('verifies that the converter registry can create a new converter', async () => {
                    const converterRegistry = await (await ConverterRegistry).deploy(contractRegistry.address);
                    const converterRegistryData = await (await ConverterRegistryData).deploy(contractRegistry.address);

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
                        const prevWhitelist = await converter.conversionWhitelist();

                        await converter.setConversionWhitelist(receiver.address);

                        const newWhitelist = await converter.conversionWhitelist();
                        expect(prevWhitelist).not.to.eql(newWhitelist);
                    });

                    it('should revert when a non owner attempts update the conversion whitelist contract address', async () => {
                        const converter = await initConverter(type, false, isETHReserve);

                        await expect(
                            converter.connect(nonOwner).setConversionWhitelist(receiver.address)
                        ).to.be.revertedWith('ERR_ACCESS_DENIED');
                    });

                    it('verifies the owner can remove the conversion whitelist contract address', async () => {
                        const converter = await initConverter(type, false, isETHReserve);
                        await converter.setConversionWhitelist(receiver.address);

                        let whitelist = await converter.conversionWhitelist();
                        expect(whitelist).to.eql(receiver.address);

                        await converter.setConversionWhitelist(ethers.constants.AddressZero);
                        whitelist = await converter.conversionWhitelist();

                        expect(whitelist).to.eql(ethers.constants.AddressZero);
                    });

                    it('should revert when the owner attempts update the conversion whitelist contract address with the converter address', async () => {
                        const converter = await initConverter(type, false, isETHReserve);

                        await expect(converter.setConversionWhitelist(converter.address)).to.be.revertedWith(
                            'ERR_ADDRESS_IS_SELF'
                        );
                    });
                }

                it('verifies the owner can update the fee', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    const newFee = MAX_CONVERSION_FEE.sub(BigNumber.from(10));
                    await converter.setConversionFee(newFee);

                    const conversionFee = await converter.conversionFee();
                    expect(conversionFee).to.be.equal(newFee);
                });

                it('should revert when attempting to update the fee to an invalid value', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    await expect(
                        converter.setConversionFee(MAX_CONVERSION_FEE.add(BigNumber.from(1)))
                    ).to.be.revertedWith('ERR_INVALID_CONVERSION_FEE');
                });

                it('should revert when a non owner attempts to update the fee', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    const newFee = BigNumber.from(30000);
                    await expect(converter.connect(nonOwner).setConversionFee(newFee)).to.be.revertedWith(
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('verifies that an event is fired when the owner updates the fee', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    const newFee = BigNumber.from(30000);

                    expect(await converter.setConversionFee(newFee))
                        .to.emit(converter, 'ConversionFeeUpdate')
                        .withArgs(BigNumber.from(0), newFee);
                });

                it('verifies that an event is fired when the owner updates the fee multiple times', async () => {
                    const converter = await initConverter(type, false, isETHReserve, MAX_CONVERSION_FEE);

                    let prevFee = BigNumber.from(0);
                    for (let i = 1; i <= 10; ++i) {
                        const newFee = BigNumber.from(10000 * i);

                        expect(await converter.setConversionFee(newFee))
                            .to.emit(converter, 'ConversionFeeUpdate')
                            .withArgs(prevFee, newFee);

                        prevFee = newFee;
                    }
                });

                if (type != 3 && type != 4) {
                    it('should revert when a non owner attempts to add a reserve', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expect(
                            converter.connect(nonOwner).addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT)
                        ).to.be.revertedWith('ERR_ACCESS_DENIED');
                    });

                    it('should revert when attempting to add a reserve with invalid address', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expect(
                            converter.addReserve(ethers.constants.AddressZero, WEIGHT_10_PERCENT)
                        ).to.be.revertedWith('ERR_INVALID_ADDRESS');
                    });

                    it('should revert when attempting to add a reserve with weight = 0', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expect(converter.addReserve(getReserve1Address(isETHReserve), 0)).to.be.revertedWith(
                            'ERR_INVALID_RESERVE_WEIGHT'
                        );
                    });

                    it('should revert when attempting to add a reserve with weight greater than 100%', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expect(
                            converter.addReserve(getReserve1Address(isETHReserve), 1000001)
                        ).to.be.revertedWith('ERR_INVALID_RESERVE_WEIGHT');
                    });

                    it('should revert when attempting to add the anchor as a reserve', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expect(converter.addReserve(anchorAddress, WEIGHT_10_PERCENT)).to.be.revertedWith(
                            'ERR_INVALID_RESERVE'
                        );
                    });

                    it('should revert when attempting to add the converter as a reserve', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);

                        await expect(converter.addReserve(converter.address, WEIGHT_10_PERCENT)).to.be.revertedWith(
                            'ERR_ADDRESS_IS_SELF'
                        );
                    });

                    it('verifies that the correct reserve weight is returned', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);
                        await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                        const reserveWeight = await converter.reserveWeight(getReserve1Address(isETHReserve));
                        expect(reserveWeight).to.be.equal(WEIGHT_10_PERCENT);
                    });

                    it('should revert when attempting to retrieve the balance for a reserve that does not exist', async () => {
                        await createAnchor();
                        const converter = await createConverter(type, anchorAddress);
                        await converter.addReserve(getReserve1Address(isETHReserve), WEIGHT_10_PERCENT);

                        await expect(converter.reserveBalance(reserveToken2.address)).to.be.revertedWith(
                            'ERR_INVALID_RESERVE'
                        );
                    });
                }

                it('verifies that the converter can accept the anchor ownership', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    await anchor.transferOwnership(converter.address);
                    await converter.acceptAnchorOwnership();

                    expect(await anchor.owner()).to.eql(converter.address);
                });

                it('should revert when attempting to accept an anchor ownership of a converter without any reserves', async () => {
                    await createAnchor();
                    const converter = await createConverter(type, anchorAddress);

                    await anchor.transferOwnership(converter.address);
                    await expect(converter.acceptAnchorOwnership()).to.be.revertedWith('ERR_INVALID_RESERVE_COUNT');
                });

                it('verifies that the owner can transfer the anchor ownership if the owner is the upgrader contract', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, owner.address);

                    await converter.transferAnchorOwnership(nonOwner.address);

                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, upgrader.address);
                    const anchorAddress = await converter.anchor();
                    const token = await (await DSToken).attach(anchorAddress);
                    const newOwner = await token.newOwner();
                    expect(newOwner).to.eql(nonOwner.address);
                });

                it('should revert when the owner attempts to transfer the anchor ownership', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(converter.transferAnchorOwnership(nonOwner.address)).to.be.revertedWith(
                        'ERR_ACCESS_DENIED'
                    );
                });

                it('should revert when a non owner attempts to transfer the anchor ownership', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(
                        converter.connect(nonOwner).transferAnchorOwnership(nonOwner.address)
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                // eslint-disable-next-line max-len
                it('should revert when a the upgrader contract attempts to transfer the anchor ownership while the upgrader is not the owner', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await contractRegistry.registerAddress(registry.CONVERTER_UPGRADER, nonOwner.address);

                    await expect(
                        converter.connect(nonOwner).transferAnchorOwnership(nonOwner.address)
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('verifies that isActive returns true when the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    const isActive = await converter.isActive();
                    expect(isActive).to.be.true;
                });

                it('verifies that isActive returns false when the converter is inactive', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    const isActive = await converter.isActive();
                    expect(isActive).to.be.false;
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const token = await (await TestStandardToken).deploy('ERC Token 3', 'ERC3', 18, 100000);

                    const value = BigNumber.from(1000);
                    await token.transfer(converter.address, value);

                    let converterBalance = await token.balanceOf(converter.address);
                    expect(converterBalance).to.be.equal(value);

                    const value2 = BigNumber.from(10);
                    await converter.withdrawTokens(token.address, receiver.address, value2);

                    converterBalance = await token.balanceOf(converter.address);
                    expect(converterBalance).to.be.equal(value.sub(value2));

                    const receivedBalance = await token.balanceOf(receiver.address);
                    expect(receivedBalance).to.be.equal(value2);
                });

                it('verifies that the owner can withdraw a reserve token from the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const prevBalance = await getBalance(
                        reserveToken,
                        getReserve1Address(isETHReserve),
                        receiver.address
                    );
                    const converterBalance = await getBalance(
                        reserveToken,
                        getReserve1Address(isETHReserve),
                        converter.address
                    );
                    if (isETHReserve) {
                        await converter.withdrawETH(receiver.address);
                    } else {
                        await converter.withdrawTokens(
                            getReserve1Address(isETHReserve),
                            receiver.address,
                            converterBalance
                        );
                    }

                    const balance = await getBalance(reserveToken, getReserve1Address(isETHReserve), receiver.address);
                    expect(balance).to.be.equal(prevBalance.add(converterBalance));
                });

                it('verifies that the owner can withdraw a non reserve token from the converter while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    const token = await (await TestStandardToken).deploy('ERC Token 3', 'ERC3', 18, 100000);
                    const value = BigNumber.from(1000);
                    await token.transfer(converter.address, value);

                    const prevBalance = await token.balanceOf(receiver.address);
                    const value2 = BigNumber.from(1);
                    await converter.withdrawTokens(token.address, receiver.address, value2);

                    const balance = await token.balanceOf(receiver.address);
                    expect(balance).to.be.equal(prevBalance.add(value2));
                });

                it('should revert when the owner attempts to withdraw a reserve token while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    const value = BigNumber.from(1);
                    if (isETHReserve) {
                        await expect(converter.withdrawETH(receiver.address)).to.be.revertedWith('ERR_ACCESS_DENIED');
                    } else {
                        await expect(
                            converter.withdrawTokens(getReserve1Address(isETHReserve), receiver.address, value)
                        ).to.be.revertedWith('ERR_ACCESS_DENIED');
                    }
                });

                it('should revert when a non owner attempts to withdraw a non reserve token while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const token = await (await TestStandardToken).deploy('ERC Token 3', 'ERC3', 18, 100000);

                    const value = BigNumber.from(255);
                    await token.transfer(converter.address, value);

                    const balance = await token.balanceOf(converter.address);
                    expect(balance).to.be.equal(value);

                    const value2 = BigNumber.from(5);
                    await expect(
                        converter.connect(nonOwner).withdrawTokens(token.address, receiver.address, value2)
                    ).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when a non owner attempts to withdraw a reserve token while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);

                    const value = BigNumber.from(5);
                    if (isETHReserve) {
                        await expect(converter.connect(nonOwner).withdrawETH(receiver.address)).to.be.revertedWith(
                            'ERR_ACCESS_DENIED'
                        );
                    } else {
                        await expect(
                            converter
                                .connect(nonOwner)
                                .withdrawTokens(getReserve1Address(isETHReserve), receiver.address, value)
                        ).to.be.revertedWith('ERR_ACCESS_DENIED');
                    }
                });

                it('should revert when a non owner attempts to withdraw a reserve token while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    const value = BigNumber.from(5);
                    if (isETHReserve) {
                        await expect(converter.connect(nonOwner).withdrawETH(receiver.address)).to.be.revertedWith(
                            'ERR_ACCESS_DENIED'
                        );
                    } else {
                        await expect(
                            converter
                                .connect(nonOwner)
                                .withdrawTokens(getReserve1Address(isETHReserve), receiver.address, value)
                        ).to.be.revertedWith('ERR_ACCESS_DENIED');
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
                    await upgrader.upgradeOld(converter.address, ethers.utils.formatBytes32String('0.9'));
                });

                it('should revert when a non owner attempts to upgrade the converter', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await expect(converter.connect(nonOwner).upgrade()).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to get the target amount with an invalid source token adress', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(
                        converter.targetAmountAndFee(
                            ethers.constants.AddressZero,
                            getReserve1Address(isETHReserve),
                            500
                        )
                    ).to.be.revertedWith('ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to get the target amount with an invalid target token address', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(
                        converter.targetAmountAndFee(
                            getReserve1Address(isETHReserve),
                            ethers.constants.AddressZero,
                            500
                        )
                    ).to.be.revertedWith('ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to get the target amount with identical source/target addresses', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(
                        converter.targetAmountAndFee(
                            getReserve1Address(isETHReserve),
                            getReserve1Address(isETHReserve),
                            500
                        )
                    ).to.be.revertedWith(getConverterTargetAmountAndFeeError(type));
                });

                it('should revert when attempting to convert with an invalid source token address', async () => {
                    await initConverter(type, true, isETHReserve);
                    await expect(
                        convert(
                            [ethers.constants.AddressZero, anchorAddress, getReserve1Address(isETHReserve)],
                            500,
                            MIN_RETURN
                        )
                    ).to.be.revertedWith('Address: call to non-contract');
                });

                it('should revert when attempting to convert with an invalid target token address', async () => {
                    await initConverter(type, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(owner).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, ethers.constants.AddressZero],
                            amount,
                            MIN_RETURN,
                            {
                                value: value
                            }
                        )
                    ).to.be.revertedWith('ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to convert with identical source/target addresses', async () => {
                    await initConverter(type, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    let value = 0;
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(owner).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, getReserve1Address(isETHReserve)],
                            amount,
                            MIN_RETURN,
                            { value: value }
                        )
                    ).to.be.revertedWith('ERR_SAME_SOURCE_TARGET');
                });
            });
        }
    }
});
