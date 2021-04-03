import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';

import Constants from './helpers/Constants';
import Contracts from './helpers/Contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ConverterType } from './helpers/Converter';

import {
    BancorNetwork,
    ContractRegistry,
    ConverterFactory,
    ConverterUpgrader,
    DSToken,
    TestNonStandardToken,
    TestStandardToken
} from '../typechain';

let bancorNetwork: BancorNetwork;
let contractRegistry: ContractRegistry;
let factory: ConverterFactory;
let anchor: DSToken;
let anchorAddress: string;
let reserveToken: TestStandardToken;
let reserveToken2: TestNonStandardToken;
let upgrader: ConverterUpgrader;

let accounts: SignerWithAddress[];
let owner: SignerWithAddress;
let nonOwner: SignerWithAddress;
let receiver: SignerWithAddress;

// TODO hardhat error
describe('Converter', () => {
    const createConverter = async (
        type: ConverterType,
        anchorAddress: string,
        registryAddress = contractRegistry.address,
        maxConversionFee: BigNumber = BigNumber.from(0)
    ) => {
        switch (type) {
            case 1:
                return await Contracts.LiquidityPoolV1Converter.deploy(
                    anchorAddress,
                    registryAddress,
                    maxConversionFee
                );
            case 3:
                return await Contracts.StandardPoolConverter.deploy(anchorAddress, registryAddress, maxConversionFee);
            case 4:
                return await Contracts.FixedRatePoolConverter.deploy(anchorAddress, registryAddress, maxConversionFee);
        }
    };

    const getConverterName = (type: ConverterType) => {
        switch (type) {
            case 1:
                return 'LiquidityPoolV1Converter';
            case 3:
                return 'StandardPoolConverter';
            case 4:
                return 'FixedRatePoolConverter';
        }
    };

    const getConverterReserveAddresses = (type: ConverterType, isETHReserve: Boolean | Number) => {
        switch (type) {
            case 1:
                return [getReserve1Address(isETHReserve), reserveToken2.address];
            case 3:
            case 4:
                return [getReserve1Address(isETHReserve), reserveToken2.address];
        }
    };

    const getConverterReserveWeights = (type: ConverterType) => {
        switch (type) {
            case 1:
                return [250000, 150000];
            case 3:
            case 4:
                return [500000, 500000];
        }
    };

    const getConverterTargetAmountAndFeeError = (type: ConverterType) => {
        switch (type) {
            case 1:
                return 'ERR_SAME_SOURCE_TARGET';
            case 3:
            case 4:
                return 'ERR_INVALID_RESERVES';
        }
    };

    const initConverter = async (
        type: ConverterType,
        activate: Boolean,
        isETHReserve: Boolean | Number,
        maxConversionFee: BigNumber = BigNumber.from(0)
    ) => {
        await createAnchor();
        const reserveAddresses = getConverterReserveAddresses(type, isETHReserve);
        const reserveWeights = getConverterReserveWeights(type);

        const converter = await createConverter(type, anchorAddress, contractRegistry.address, maxConversionFee);

        for (let i = 0; i < reserveAddresses.length; i++) {
            await converter.addReserve(reserveAddresses[i], reserveWeights[i]);
        }

        if (type === 4) {
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
        anchor = await Contracts.DSToken.deploy('Pool1', 'POOL1', 2);
        anchorAddress = anchor.address;
    };

    const getReserve1Address = (isETH: Boolean | Number) => {
        return isETH ? Constants.NATIVE_TOKEN_ADDRESS : reserveToken.address;
    };

    const convert = async (path: any, amount: BigNumber, minReturn: BigNumber, options = {}) => {
        if (options != {}) {
            return await bancorNetwork.convertByPath2(path, amount, minReturn, Constants.ZERO_ADDRESS, options);
        }
        return await bancorNetwork.convertByPath2(path, amount, minReturn, Constants.ZERO_ADDRESS);
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
        contractRegistry = await Contracts.ContractRegistry.deploy();

        const bancorFormula = await Contracts.BancorFormula.deploy();
        await bancorFormula.init();
        await contractRegistry.registerAddress(Constants.registry.BANCOR_FORMULA, bancorFormula.address);

        factory = await Contracts.ConverterFactory.deploy();
        await contractRegistry.registerAddress(Constants.registry.CONVERTER_FACTORY, factory.address);

        const networkSettings = await Contracts.NetworkSettings.deploy(owner.address, 0);
        await contractRegistry.registerAddress(Constants.registry.NETWORK_SETTINGS, networkSettings.address);

        await factory.registerTypedConverterFactory((await Contracts.LiquidityPoolV1ConverterFactory.deploy()).address);
        await factory.registerTypedConverterFactory((await Contracts.StandardPoolConverterFactory.deploy()).address);
        await factory.registerTypedConverterFactory((await Contracts.FixedRatePoolConverterFactory.deploy()).address);
    });

    beforeEach(async () => {
        bancorNetwork = await Contracts.BancorNetwork.deploy(contractRegistry.address);
        await contractRegistry.registerAddress(Constants.registry.BANCOR_NETWORK, bancorNetwork.address);

        upgrader = await Contracts.ConverterUpgrader.deploy(contractRegistry.address);
        await contractRegistry.registerAddress(Constants.registry.CONVERTER_UPGRADER, upgrader.address);

        reserveToken = await Contracts.TestStandardToken.deploy('ERC Token 1', 'ERC1', 18, 1000000000);
        reserveToken2 = await Contracts.TestNonStandardToken.deploy('ERC Token 2', 'ERC2', 18, 2000000000);
    });

    for (const type of [1 as ConverterType, 3 as ConverterType, 4 as ConverterType]) {
        it('verifies that converterType returns the correct type', async () => {
            const converter = await initConverter(type as ConverterType, true, true);
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
                    await expect(createConverter(type, Constants.ZERO_ADDRESS)).to.be.revertedWith(
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when attempting to construct a converter with no contract registry', async () => {
                    await expect(createConverter(type, anchorAddress, Constants.ZERO_ADDRESS)).to.be.revertedWith(
                        'ERR_INVALID_ADDRESS'
                    );
                });

                it('should revert when attempting to construct a converter with invalid conversion fee', async () => {
                    await expect(
                        createConverter(type, anchorAddress, contractRegistry.address, BigNumber.from(1000001))
                    ).to.be.revertedWith('ERR_INVALID_CONVERSION_FEE');
                });

                it('verifies that the converter registry can create a new converter', async () => {
                    const converterRegistry = await Contracts.ConverterRegistry.deploy(contractRegistry.address);
                    const converterRegistryData = await Contracts.ConverterRegistryData.deploy(
                        contractRegistry.address
                    );

                    await contractRegistry.registerAddress(
                        Constants.registry.CONVERTER_REGISTRY,
                        converterRegistry.address
                    );
                    await contractRegistry.registerAddress(
                        Constants.registry.CONVERTER_REGISTRY_DATA,
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

                if (type !== 3 && type !== 4) {
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

                        await converter.setConversionWhitelist(Constants.ZERO_ADDRESS);
                        whitelist = await converter.conversionWhitelist();

                        expect(whitelist).to.eql(Constants.ZERO_ADDRESS);
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

                if (type !== 3 && type !== 4) {
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
                            converter.addReserve(Constants.ZERO_ADDRESS, WEIGHT_10_PERCENT)
                        ).to.be.revertedWith('ERR_INVALID_EXTERNAL_ADDRESS');
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

                    await contractRegistry.registerAddress(Constants.registry.CONVERTER_UPGRADER, owner.address);

                    await converter.transferAnchorOwnership(nonOwner.address);

                    await contractRegistry.registerAddress(Constants.registry.CONVERTER_UPGRADER, upgrader.address);
                    const anchorAddress = await converter.anchor();
                    const token = await Contracts.DSToken.attach(anchorAddress);
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
                    await contractRegistry.registerAddress(Constants.registry.CONVERTER_UPGRADER, nonOwner.address);

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

                it('verifies that the owner can upgrade the converter while the converter is active', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await converter.upgrade();
                });

                it('verifies that the owner can upgrade the converter while the converter is not active', async () => {
                    const converter = await initConverter(type, false, isETHReserve);
                    await converter.upgrade();
                });

                it('should revert when a non owner attempts to upgrade the converter', async () => {
                    const converter = await initConverter(type, true, isETHReserve);
                    await expect(converter.connect(nonOwner).upgrade()).to.be.revertedWith('ERR_ACCESS_DENIED');
                });

                it('should revert when attempting to get the target amount with an invalid source token address', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(
                        converter.targetAmountAndFee(Constants.ZERO_ADDRESS, getReserve1Address(isETHReserve), 500)
                    ).to.be.revertedWith('ERR_INVALID_RESERVE');
                });

                it('should revert when attempting to get the target amount with an invalid target token address', async () => {
                    const converter = await initConverter(type, true, isETHReserve);

                    await expect(
                        converter.targetAmountAndFee(getReserve1Address(isETHReserve), Constants.ZERO_ADDRESS, 500)
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
                            [Constants.ZERO_ADDRESS, anchorAddress, getReserve1Address(isETHReserve)],
                            BigNumber.from(500),
                            MIN_RETURN
                        )
                    ).to.be.revertedWith('Address: call to non-contract');
                });

                it('should revert when attempting to convert with an invalid target token address', async () => {
                    await initConverter(type, true, isETHReserve);

                    const amount = BigNumber.from(500);
                    let value = BigNumber.from(0);
                    if (isETHReserve) {
                        value = amount;
                    } else {
                        await reserveToken.connect(owner).approve(bancorNetwork.address, amount);
                    }

                    await expect(
                        convert(
                            [getReserve1Address(isETHReserve), anchorAddress, Constants.ZERO_ADDRESS],
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
                    let value = BigNumber.from(0);
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
